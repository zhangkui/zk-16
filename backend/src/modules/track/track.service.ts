import { Injectable, Inject, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere, In, Brackets } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TrackPoint } from './track.entity';
import { TransportOrder, TransportOrderStatus } from '../transport-order/transport-order.entity';
import { Vehicle } from '../vehicle/vehicle.entity';
import { UserRole } from '../auth/user.entity';
import { CreateTrackPointDto, QueryTrackDto, QueryLatestPositionsDto } from './track.dto';
import { KafkaService } from '../../kafka/kafka.service';
import { AlertType, AlertLevel, Alert, AlertStatus } from '../alert/alert.entity';
import { Fence, FenceStatus, FenceType } from '../fence/fence.entity';
import { point, lineString } from '@turf/helpers';
import pointToLineDistance from '@turf/point-to-line-distance';
import { GeoHelper } from '../../common/helpers/geo.helper';

interface UserContext {
  id: string;
  role: string;
  companyId?: string;
  isCompanySuperAdmin?: boolean;
}

interface LatestPosition {
  plateNumber: string;
  longitude: number;
  latitude: number;
  speed: number;
  direction: number;
  altitude: number;
  accuracy: number;
  timestamp: Date;
  isDeviated: boolean;
  deviationDistance: number;
  transportOrderId?: string;
}

const DEVIATION_THRESHOLD = 50;
const LATEST_POSITION_TTL = 3600;

@Injectable()
export class TrackService {
  private readonly logger = new Logger(TrackService.name);
  private readonly LATEST_POSITION_KEY_PREFIX = 'track:latest:';

  constructor(
    @InjectRepository(TrackPoint)
    private readonly trackPointRepository: Repository<TrackPoint>,
    @InjectRepository(TransportOrder)
    private readonly transportOrderRepository: Repository<TransportOrder>,
    @InjectRepository(Fence)
    private readonly fenceRepository: Repository<Fence>,
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly kafkaService: KafkaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private isCompanyAdmin(user: UserContext): boolean {
    return (
      user.role === UserRole.COMPANY_SUPER_ADMIN ||
      user.role === UserRole.COMPANY_ADMIN
    );
  }

  private async getCompanyPlateNumbers(user: UserContext): Promise<string[]> {
    if (!this.isCompanyAdmin(user)) return [];
    const vehicles = await this.vehicleRepository.find({
      where: { companyId: user.companyId },
      select: ['plateNumber'],
    });
    return vehicles.map((v) => v.plateNumber);
  }

  private getCacheKey(plateNumber: string): string {
    return `${this.LATEST_POSITION_KEY_PREFIX}${plateNumber}`;
  }

  private async cacheLatestPosition(plateNumber: string, position: LatestPosition): Promise<void> {
    try {
      await this.cacheManager.set(
        this.getCacheKey(plateNumber),
        JSON.stringify(position),
        LATEST_POSITION_TTL,
      );
    } catch (error) {
      this.logger.error(`缓存最新位置失败 ${plateNumber}:`, error);
    }
  }

  private async getCachedLatestPosition(plateNumber: string): Promise<LatestPosition | null> {
    try {
      const cached = await this.cacheManager.get<string>(this.getCacheKey(plateNumber));
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.error(`读取缓存位置失败 ${plateNumber}:`, error);
      return null;
    }
  }

  private async findActiveTransportOrder(plateNumber: string): Promise<TransportOrder | null> {
    return this.transportOrderRepository
      .createQueryBuilder('order')
      .innerJoinAndSelect('order.vehicle', 'vehicle')
      .where('vehicle.plateNumber = :plateNumber', { plateNumber })
      .andWhere('order.status IN (:...statuses)', {
        statuses: [
          TransportOrderStatus.IN_TRANSIT,
          TransportOrderStatus.LOADING,
          TransportOrderStatus.UNLOADING,
        ],
      })
      .getOne();
  }

  private async findActiveFencesContainingPoint(lng: number, lat: number): Promise<Fence[]> {
    const queryBuilder = this.fenceRepository.createQueryBuilder('fence');
    queryBuilder.where('fence.status = :status', { status: FenceStatus.ACTIVE });
    queryBuilder.andWhere(
      new Brackets((qb) => {
        qb.where(GeoHelper.contains('fence.geom', lng, lat));
      }),
    );
    queryBuilder.setParameter('lng', lng);
    queryBuilder.setParameter('lat', lat);
    queryBuilder.orderBy('fence.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  private async getCachedFenceState(plateNumber: string): Promise<string[]> {
    try {
      const cached = await this.cacheManager.get<string>(`fence:state:${plateNumber}`);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      this.logger.error(`读取围栏状态缓存失败 ${plateNumber}:`, error);
      return [];
    }
  }

  private async setCachedFenceState(plateNumber: string, fenceIds: string[]): Promise<void> {
    try {
      await this.cacheManager.set(`fence:state:${plateNumber}`, JSON.stringify(fenceIds), 3600);
    } catch (error) {
      this.logger.error(`缓存围栏状态失败 ${plateNumber}:`, error);
    }
  }

  private async createFenceAlert(
    transportOrder: TransportOrder | null,
    plateNumber: string,
    fence: Fence,
    eventType: 'enter' | 'leave',
    longitude: number,
    latitude: number,
    timestamp: string,
  ): Promise<void> {
    const isRestrictedFence = fence.type === FenceType.RESTRICTED;
    const alertLevel = isRestrictedFence ? AlertLevel.DANGER : AlertLevel.WARNING;
    
    const eventText = eventType === 'enter' ? '进入' : '离开';
    const fenceTypeText = {
      [FenceType.LOADING]: '装载区',
      [FenceType.UNLOADING]: '卸载区',
      [FenceType.RESTRICTED]: '禁行区',
      [FenceType.PERMIT]: '许可区',
    }[fence.type] || '电子围栏';

    const title = `车辆${eventText}${fenceTypeText}`;
    const description = `车辆 ${plateNumber} ${eventText}围栏「${fence.name}」`;

    const existingAlert = await this.alertRepository.findOne({
      where: {
        transportOrderId: transportOrder?.id,
        plateNumber,
        type: AlertType.FENCE_BREACH,
        status: In([AlertStatus.PENDING, AlertStatus.ACKNOWLEDGED]),
        fenceName: fence.name,
      },
      order: { alertTime: 'DESC' },
    });

    if (existingAlert) {
      const timeDiff = new Date(timestamp).getTime() - existingAlert.alertTime.getTime();
      if (timeDiff < 5 * 60 * 1000) {
        existingAlert.repeatCount += 1;
        existingAlert.longitude = longitude;
        existingAlert.latitude = latitude;
        existingAlert.alertTime = new Date(timestamp);
        await this.alertRepository.save(existingAlert);
        return;
      }
    }

    const alert = this.alertRepository.create({
      transportOrderId: transportOrder?.id,
      plateNumber,
      type: AlertType.FENCE_BREACH,
      level: alertLevel,
      status: AlertStatus.PENDING,
      title,
      description,
      longitude,
      latitude,
      fenceName: fence.name,
      alertTime: new Date(timestamp),
      repeatCount: 1,
    } as Partial<Alert>);

    const savedAlert = await this.alertRepository.save(alert as Alert);

    try {
      await this.kafkaService.sendAlert({
        id: savedAlert.id,
        transportOrderId: transportOrder?.id,
        plateNumber,
        type: AlertType.FENCE_BREACH,
        level: alertLevel,
        title,
        description,
        longitude,
        latitude,
        fenceName: fence.name,
        alertTime: timestamp,
      });
    } catch (error) {
      this.logger.error('发送围栏告警到Kafka失败:', error);
    }
  }

  private async checkFenceBreach(
    plateNumber: string,
    longitude: number,
    latitude: number,
    timestamp: string,
    transportOrder: TransportOrder | null,
  ): Promise<void> {
    try {
      const currentFences = await this.findActiveFencesContainingPoint(longitude, latitude);
      const currentFenceIds = currentFences.map((f) => f.id);
      const previousFenceIds = await this.getCachedFenceState(plateNumber);

      const enteredFences = currentFences.filter((f) => !previousFenceIds.includes(f.id));
      const leftFenceIds = previousFenceIds.filter((id) => !currentFenceIds.includes(id));

      for (const fence of enteredFences) {
        if (fence.type === FenceType.RESTRICTED) {
          await this.createFenceAlert(transportOrder, plateNumber, fence, 'enter', longitude, latitude, timestamp);
        }
      }

      if (leftFenceIds.length > 0) {
        const leftFences = await this.fenceRepository.findByIds(leftFenceIds);
        for (const fence of leftFences) {
          if (fence.type === FenceType.RESTRICTED) {
            await this.createFenceAlert(transportOrder, plateNumber, fence, 'leave', longitude, latitude, timestamp);
          }
        }
      }

      await this.setCachedFenceState(plateNumber, currentFenceIds);
    } catch (error) {
      this.logger.error('检查围栏告警失败:', error);
    }
  }

  private calculateDeviation(
    lng: number,
    lat: number,
    plannedRoute: any,
  ): { isDeviated: boolean; deviationDistance: number } {
    if (!plannedRoute) {
      return { isDeviated: false, deviationDistance: 0 };
    }

    try {
      const pt = point([lng, lat]);

      let line: any;
      if (typeof plannedRoute === 'string') {
        line = lineString(JSON.parse(plannedRoute));
      } else if (plannedRoute.type === 'LineString') {
        line = lineString(plannedRoute.coordinates);
      } else {
        line = lineString(plannedRoute);
      }

      const distance = pointToLineDistance(pt, line, { units: 'meters' });

      return {
        isDeviated: distance > DEVIATION_THRESHOLD,
        deviationDistance: Math.round(distance * 100) / 100,
      };
    } catch (error) {
      this.logger.error('计算路线偏离失败:', error);
      return { isDeviated: false, deviationDistance: 0 };
    }
  }

  async create(createTrackPointDto: CreateTrackPointDto): Promise<TrackPoint> {
    const { longitude, latitude, plateNumber, timestamp } = createTrackPointDto;

    const transportOrder = await this.findActiveTransportOrder(plateNumber);

    let isDeviated = false;
    let deviationDistance = 0;

    if (transportOrder && transportOrder.plannedRoute) {
      const deviationResult = this.calculateDeviation(
        longitude,
        latitude,
        transportOrder.plannedRoute,
      );
      isDeviated = deviationResult.isDeviated;
      deviationDistance = deviationResult.deviationDistance;
    }

    const insertQb = this.trackPointRepository
      .createQueryBuilder()
      .insert()
      .into(TrackPoint)
      .values({
        plateNumber,
        gpsDeviceId: createTrackPointDto.gpsDeviceId,
        longitude,
        latitude,
        speed: createTrackPointDto.speed,
        direction: createTrackPointDto.direction,
        altitude: createTrackPointDto.altitude,
        accuracy: createTrackPointDto.accuracy,
        isDeviated,
        deviationDistance,
        timestamp: new Date(timestamp),
        transportOrderId: transportOrder?.id,
        location: () => `ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)`,
      })
      .setParameter('lng', longitude)
      .setParameter('lat', latitude)
      .returning('*');

    const insertResult = await insertQb.execute();
    const savedPoint = (insertResult.generatedMaps[0] || insertResult.identifiers[0]) as unknown as TrackPoint;

    const latestPosition: LatestPosition = {
      plateNumber,
      longitude,
      latitude,
      speed: createTrackPointDto.speed || 0,
      direction: createTrackPointDto.direction || 0,
      altitude: createTrackPointDto.altitude || 0,
      accuracy: createTrackPointDto.accuracy || 0,
      timestamp: new Date(timestamp),
      isDeviated,
      deviationDistance,
      transportOrderId: transportOrder?.id,
    };
    await this.cacheLatestPosition(plateNumber, latestPosition);

    this.emitTrackPointEvent(latestPosition, createTrackPointDto, transportOrder);

    try {
      await this.kafkaService.sendTrackPoint({
        ...savedPoint,
        location: undefined,
      });
    } catch (error) {
      this.logger.error('发送轨迹点到Kafka失败:', error);
    }

    if (isDeviated && transportOrder) {
      try {
        await this.kafkaService.sendAlert({
          transportOrderId: transportOrder.id,
          plateNumber,
          type: AlertType.ROUTE_DEVIATION,
          level: deviationDistance > 200 ? AlertLevel.DANGER : AlertLevel.WARNING,
          title: '车辆偏离规划路线',
          description: `车辆 ${plateNumber} 偏离规划路线，偏离距离约 ${deviationDistance} 米`,
          longitude,
          latitude,
          deviationDistance,
          alertTime: new Date(timestamp).toISOString(),
        });
      } catch (error) {
        this.logger.error('发送偏离告警到Kafka失败:', error);
      }
    }

    this.checkFenceBreach(plateNumber, longitude, latitude, timestamp, transportOrder);

    return savedPoint;
  }

  async batchCreate(points: CreateTrackPointDto[]): Promise<TrackPoint[]> {
    const results: TrackPoint[] = [];
    for (const point of points) {
      try {
        const saved = await this.create(point);
        results.push(saved);
      } catch (error) {
        this.logger.error(`批量保存轨迹点失败 ${point.plateNumber}:`, error);
      }
    }
    return results;
  }

  async getTrackByOrderId(
    transportOrderId: string,
    queryTrackDto: QueryTrackDto,
    user: UserContext,
  ): Promise<{ data: TrackPoint[]; total: number; page: number; pageSize: number }> {
    const { timeFrom, timeTo, page = 1, pageSize = 100 } = queryTrackDto;

    const queryBuilder = this.trackPointRepository.createQueryBuilder('track');
    queryBuilder.where('track.transportOrderId = :transportOrderId', { transportOrderId });

    if (this.isCompanyAdmin(user)) {
      const companyPlateNumbers = await this.getCompanyPlateNumbers(user);
      if (companyPlateNumbers.length === 0) {
        return { data: [], total: 0, page, pageSize };
      }
      queryBuilder.andWhere('track.plateNumber IN (:...plateNumbers)', { plateNumbers: companyPlateNumbers });
    }

    if (timeFrom && timeTo) {
      queryBuilder.andWhere('track.timestamp BETWEEN :timeFrom AND :timeTo', {
        timeFrom: new Date(timeFrom),
        timeTo: new Date(timeTo),
      });
    }

    queryBuilder.orderBy('track.timestamp', 'ASC');
    queryBuilder.skip((page - 1) * pageSize);
    queryBuilder.take(pageSize);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total, page, pageSize };
  }

  async queryTrack(
    queryTrackDto: QueryTrackDto,
    user: UserContext,
  ): Promise<{ data: TrackPoint[]; total: number; page: number; pageSize: number }> {
    const { transportOrderId, plateNumber, timeFrom, timeTo, page = 1, pageSize = 100 } = queryTrackDto;

    const queryBuilder = this.trackPointRepository.createQueryBuilder('track');

    if (transportOrderId) {
      queryBuilder.andWhere('track.transportOrderId = :transportOrderId', { transportOrderId });
    }

    if (plateNumber) {
      queryBuilder.andWhere('track.plateNumber = :plateNumber', { plateNumber });
    }

    if (this.isCompanyAdmin(user)) {
      const companyPlateNumbers = await this.getCompanyPlateNumbers(user);
      if (companyPlateNumbers.length === 0) {
        return { data: [], total: 0, page, pageSize };
      }
      queryBuilder.andWhere('track.plateNumber IN (:...plateNumbers)', { plateNumbers: companyPlateNumbers });
    }

    if (timeFrom) {
      queryBuilder.andWhere('track.timestamp >= :timeFrom', { timeFrom: new Date(timeFrom) });
    }

    if (timeTo) {
      queryBuilder.andWhere('track.timestamp <= :timeTo', { timeTo: new Date(timeTo) });
    }

    queryBuilder.orderBy('track.timestamp', 'ASC');
    queryBuilder.skip((page - 1) * pageSize);
    queryBuilder.take(pageSize);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total, page, pageSize };
  }

  async getLatestPosition(plateNumber: string, user: UserContext): Promise<LatestPosition> {
    if (this.isCompanyAdmin(user)) {
      const vehicle = await this.vehicleRepository.findOne({ where: { plateNumber } });
      if (!vehicle || vehicle.companyId !== user.companyId) {
        throw new ForbiddenException('无权访问该车辆轨迹数据');
      }
    }

    const cached = await this.getCachedLatestPosition(plateNumber);
    if (cached) {
      return cached;
    }

    const latestPoint = await this.trackPointRepository.findOne({
      where: { plateNumber },
      order: { timestamp: 'DESC' },
    });

    if (!latestPoint) {
      throw new NotFoundException(`未找到车辆 ${plateNumber} 的轨迹数据`);
    }

    const position: LatestPosition = {
      plateNumber: latestPoint.plateNumber,
      longitude: latestPoint.longitude,
      latitude: latestPoint.latitude,
      speed: latestPoint.speed,
      direction: latestPoint.direction,
      altitude: latestPoint.altitude,
      accuracy: latestPoint.accuracy,
      timestamp: latestPoint.timestamp,
      isDeviated: latestPoint.isDeviated,
      deviationDistance: latestPoint.deviationDistance,
      transportOrderId: latestPoint.transportOrderId,
    };

    await this.cacheLatestPosition(plateNumber, position);
    return position;
  }

  async getLatestPositionsByVehicles(
    queryDto: QueryLatestPositionsDto,
    user: UserContext,
  ): Promise<LatestPosition[]> {
    let { plateNumbers } = queryDto;

    if (this.isCompanyAdmin(user)) {
      const companyPlateNumbers = await this.getCompanyPlateNumbers(user);
      plateNumbers = plateNumbers.filter((p) => companyPlateNumbers.includes(p));
    }

    const results: LatestPosition[] = [];

    for (const plateNumber of plateNumbers) {
      try {
        const position = await this.getLatestPosition(plateNumber, user);
        results.push(position);
      } catch (error) {
        this.logger.warn(`获取车辆 ${plateNumber} 最新位置失败: ${error.message}`);
      }
    }

    return results;
  }

  private async getVehicleMonitorInfo(plateNumber: string): Promise<{
    companyId?: string;
    companyName?: string;
    vehicleType?: string;
    driverName?: string;
    driverPhone?: string;
    wasteType?: string;
    vehicleStatus?: string;
  } | null> {
    try {
      const cacheKey = `vehicle:info:${plateNumber}`;
      const cached = await this.cacheManager.get<string>(cacheKey);
      if (cached) return JSON.parse(cached);

      const vehicle = await this.vehicleRepository.findOne({
        where: { plateNumber },
        select: [
          'plateNumber',
          'companyId',
          'companyName',
          'vehicleType',
          'driverName',
          'driverPhone',
          'wasteType',
          'status',
        ],
      });

      const info = vehicle
        ? {
            companyId: vehicle.companyId,
            companyName: vehicle.companyName,
            vehicleType: vehicle.vehicleType,
            driverName: vehicle.driverName,
            driverPhone: vehicle.driverPhone,
            wasteType: vehicle.wasteType,
            vehicleStatus: vehicle.status,
          }
        : null;

      if (info) {
        await this.cacheManager.set(cacheKey, JSON.stringify(info), 600);
      }
      return info;
    } catch (error) {
      this.logger.error(`获取车辆信息失败 ${plateNumber}:`, error);
      return null;
    }
  }

  private emitTrackPointEvent(
    position: LatestPosition,
    dto: CreateTrackPointDto,
    transportOrder: TransportOrder | null,
  ): void {
    if (!this.eventEmitter) return;

    const timestampIso = new Date(position.timestamp).toISOString();

    setImmediate(async () => {
      try {
        const vehicleInfo = await this.getVehicleMonitorInfo(position.plateNumber);

        this.eventEmitter.emit('track.point.created', {
          plateNumber: position.plateNumber,
          longitude: Number(position.longitude),
          latitude: Number(position.latitude),
          speed: Number(position.speed ?? dto.speed ?? 0),
          direction: Number(position.direction ?? dto.direction ?? 0),
          altitude: Number(position.altitude ?? dto.altitude ?? 0),
          accuracy: Number(position.accuracy ?? dto.accuracy ?? 0),
          timestamp: timestampIso,
          isDeviated: position.isDeviated,
          deviationDistance: Number(position.deviationDistance ?? 0),
          transportOrderId: position.transportOrderId ?? transportOrder?.id,
          companyId: vehicleInfo?.companyId,
          companyName: vehicleInfo?.companyName,
          vehicleType: vehicleInfo?.vehicleType,
          driverName: vehicleInfo?.driverName,
          driverPhone: vehicleInfo?.driverPhone,
          wasteType: vehicleInfo?.wasteType,
          vehicleStatus: vehicleInfo?.vehicleStatus,
        });
      } catch (error) {
        this.logger.error(`推送实时车辆位置失败 ${position.plateNumber}:`, error);
      }
    });
  }

  async getMonitoringPositions(user: UserContext): Promise<any[]> {
    const vehicleQb = this.vehicleRepository.createQueryBuilder('vehicle');

    if (this.isCompanyAdmin(user)) {
      vehicleQb.where('vehicle.companyId = :companyId', { companyId: user.companyId });
    }

    const vehicles = await vehicleQb.getMany();
    const results: any[] = [];

    for (const vehicle of vehicles) {
      const position = await this.getCachedLatestPosition(vehicle.plateNumber);
      if (!position) continue;

      results.push({
        plateNumber: position.plateNumber,
        longitude: Number(position.longitude),
        latitude: Number(position.latitude),
        speed: Number(position.speed ?? 0),
        direction: Number(position.direction ?? 0),
        altitude: Number(position.altitude ?? 0),
        accuracy: Number(position.accuracy ?? 0),
        timestamp: new Date(position.timestamp).toISOString(),
        isDeviated: position.isDeviated,
        deviationDistance: Number(position.deviationDistance ?? 0),
        transportOrderId: position.transportOrderId,
        companyId: vehicle.companyId,
        companyName: vehicle.companyName,
        vehicleType: vehicle.vehicleType,
        driverName: vehicle.driverName,
        driverPhone: vehicle.driverPhone,
        wasteType: vehicle.wasteType,
        vehicleStatus: vehicle.status,
      });
    }

    return results;
  }
}
