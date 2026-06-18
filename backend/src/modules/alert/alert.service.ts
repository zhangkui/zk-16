import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere, In, Not } from 'typeorm';
import { Alert, AlertType, AlertLevel, AlertStatus } from './alert.entity';
import { Vehicle } from '../vehicle/vehicle.entity';
import { UserRole } from '../auth/user.entity';
import { CreateAlertDto, QueryAlertDto, HandleAlertDto } from './alert.dto';
import { KafkaService } from '../../kafka/kafka.service';

interface UserContext {
  id: string;
  role: string;
  companyId?: string;
  isCompanySuperAdmin?: boolean;
}

export interface AlertStatistics {
  total: number;
  pending: number;
  acknowledged: number;
  processed: number;
  closed: number;
  byType: Record<AlertType, number>;
  byLevel: Record<AlertLevel, number>;
  todayCount: number;
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    private readonly kafkaService: KafkaService,
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

  private normalizeDto(dto: any): any {
    const normalized = { ...dto };

    if (normalized.alertType && !normalized.type) {
      const typeMap: Record<string, AlertType> = {
        'speeding': AlertType.SPEEDING,
        'route_deviation': AlertType.ROUTE_DEVIATION,
        'fence_breach': AlertType.FENCE_BREACH,
        'fence_violation': AlertType.FENCE_BREACH,
        'time_violation': AlertType.TIME_VIOLATION,
        'timeout': AlertType.TIME_VIOLATION,
        'weight_overload': AlertType.WEIGHT_OVERLOAD,
        'stay_too_long': AlertType.STAY_TOO_LONG,
        'unapproved_vehicle': AlertType.UNAPPROVED_VEHICLE,
        'receipt_mismatch': AlertType.RECEIPT_MISMATCH,
      };
      if (typeMap[normalized.alertType]) {
        normalized.type = typeMap[normalized.alertType];
      }
    }

    if (normalized.level) {
      const levelMap: Record<string, AlertLevel> = {
        'info': AlertLevel.INFO,
        'low': AlertLevel.INFO,
        'warning': AlertLevel.WARNING,
        'medium': AlertLevel.WARNING,
        'danger': AlertLevel.DANGER,
        'high': AlertLevel.DANGER,
        'critical': AlertLevel.CRITICAL,
      };
      if (levelMap[normalized.level]) {
        normalized.level = levelMap[normalized.level];
      }
    }

    if (normalized.status) {
      const statusMap: Record<string, AlertStatus> = {
        'pending': AlertStatus.PENDING,
        'active': AlertStatus.PENDING,
        'acknowledged': AlertStatus.ACKNOWLEDGED,
        'processed': AlertStatus.PROCESSED,
        'processing': AlertStatus.PROCESSED,
        'ignored': AlertStatus.IGNORED,
        'closed': AlertStatus.CLOSED,
      };
      if (statusMap[normalized.status]) {
        normalized.status = statusMap[normalized.status];
      }
    }

    if (normalized.remark && !normalized.handleRemark) {
      normalized.handleRemark = normalized.remark;
    }

    if (normalized.processRemark && !normalized.handleRemark) {
      normalized.handleRemark = normalized.processRemark;
    }

    return normalized;
  }

  async createAlert(createAlertDto: CreateAlertDto): Promise<Alert> {
    const dto = this.normalizeDto(createAlertDto);
    const existingAlert = await this.alertRepository.findOne({
      where: {
        transportOrderId: dto.transportOrderId,
        type: dto.type as AlertType,
        status: In([AlertStatus.PENDING, AlertStatus.ACKNOWLEDGED]),
      },
      order: { alertTime: 'DESC' },
    });

    if (existingAlert) {
      const timeDiff = new Date(dto.alertTime).getTime() - existingAlert.alertTime.getTime();
      if (timeDiff < 5 * 60 * 1000) {
        existingAlert.repeatCount += 1;
        if (dto.longitude !== undefined) {
          existingAlert.longitude = dto.longitude;
        }
        if (dto.latitude !== undefined) {
          existingAlert.latitude = dto.latitude;
        }
        if (dto.deviationDistance !== undefined) {
          existingAlert.deviationDistance = dto.deviationDistance;
        }
        existingAlert.alertTime = new Date(dto.alertTime);
        return this.alertRepository.save(existingAlert);
      }
    }

    const alert = this.alertRepository.create({
      ...dto,
      alertTime: new Date(dto.alertTime),
      level: (dto.level as AlertLevel) || AlertLevel.WARNING,
      status: AlertStatus.PENDING,
    } as Partial<Alert>);

    const savedAlert = await this.alertRepository.save(alert as Alert);

    try {
      await this.kafkaService.sendAlert({
        id: savedAlert.id,
        ...dto,
      });
    } catch (error) {
      this.logger.error('发送告警到Kafka失败:', error);
    }

    return savedAlert;
  }

  async findAll(
    queryAlertDto: QueryAlertDto,
    user: UserContext,
  ): Promise<{ data: Alert[]; total: number; page: number; pageSize: number }> {
    const dto = this.normalizeDto(queryAlertDto);
    const {
      transportOrderId,
      plateNumber,
      type,
      level,
      status,
      timeFrom,
      timeTo,
      page = 1,
      pageSize = 20,
    } = dto;

    const queryBuilder = this.alertRepository.createQueryBuilder('alert');

    if (this.isCompanyAdmin(user)) {
      const companyPlateNumbers = await this.getCompanyPlateNumbers(user);
      if (companyPlateNumbers.length === 0) {
        return { data: [], total: 0, page, pageSize };
      }
      queryBuilder.andWhere('alert.plateNumber IN (:...plateNumbers)', { plateNumbers: companyPlateNumbers });
    }

    if (transportOrderId) {
      queryBuilder.andWhere('alert.transportOrderId = :transportOrderId', { transportOrderId });
    }

    if (plateNumber) {
      queryBuilder.andWhere('alert.plateNumber = :plateNumber', { plateNumber });
    }

    if (type) {
      queryBuilder.andWhere('alert.type = :type', { type });
    }

    if (level) {
      queryBuilder.andWhere('alert.level = :level', { level });
    }

    if (status) {
      queryBuilder.andWhere('alert.status = :status', { status });
    }

    if (timeFrom) {
      queryBuilder.andWhere('alert.alertTime >= :timeFrom', { timeFrom: new Date(timeFrom) });
    }

    if (timeTo) {
      queryBuilder.andWhere('alert.alertTime <= :timeTo', { timeTo: new Date(timeTo) });
    }

    queryBuilder.orderBy('alert.alertTime', 'DESC');
    queryBuilder.skip((page - 1) * pageSize);
    queryBuilder.take(pageSize);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total, page, pageSize };
  }

  async findOne(id: string, user: UserContext): Promise<Alert> {
    const alert = await this.alertRepository.findOne({ where: { id } });
    if (!alert) {
      throw new NotFoundException(`告警 ${id} 不存在`);
    }

    if (this.isCompanyAdmin(user)) {
      const vehicle = await this.vehicleRepository.findOne({ where: { plateNumber: alert.plateNumber } });
      if (!vehicle || vehicle.companyId !== user.companyId) {
        throw new ForbiddenException('无权访问该告警信息');
      }
    }

    return alert;
  }

  async acknowledge(id: string, handleAlertDto: HandleAlertDto, user: UserContext): Promise<Alert> {
    const dto = this.normalizeDto(handleAlertDto);
    const alert = await this.findOne(id, user);

    if (alert.status !== AlertStatus.PENDING) {
      throw new BadRequestException(`只有待处理状态的告警才能确认，当前状态: ${alert.status}`);
    }

    alert.status = AlertStatus.ACKNOWLEDGED;
    if (dto.handler) alert.handler = dto.handler;
    if (dto.handleRemark) alert.handleRemark = dto.handleRemark;
    alert.handleTime = new Date();

    return this.alertRepository.save(alert);
  }

  async processAlert(id: string, handleAlertDto: HandleAlertDto, user: UserContext): Promise<Alert> {
    const dto = this.normalizeDto(handleAlertDto);
    const alert = await this.findOne(id, user);

    if (![AlertStatus.PENDING, AlertStatus.ACKNOWLEDGED].includes(alert.status)) {
      throw new BadRequestException(
        `只有待处理或已确认状态的告警才能处理，当前状态: ${alert.status}`,
      );
    }

    alert.status = AlertStatus.PROCESSED;
    if (dto.handler) alert.handler = dto.handler;
    if (dto.handleRemark) alert.handleRemark = dto.handleRemark;
    alert.handleTime = new Date();

    return this.alertRepository.save(alert);
  }

  async closeAlert(id: string, handleAlertDto: HandleAlertDto, user: UserContext): Promise<Alert> {
    const dto = this.normalizeDto(handleAlertDto);
    const alert = await this.findOne(id, user);

    if (alert.status === AlertStatus.CLOSED) {
      throw new BadRequestException('告警已关闭');
    }

    alert.status = AlertStatus.CLOSED;
    if (dto.handler) alert.handler = dto.handler;
    if (dto.handleRemark) alert.handleRemark = dto.handleRemark;
    alert.handleTime = new Date();

    return this.alertRepository.save(alert);
  }

  async getAlertStatistics(queryAlertDto: QueryAlertDto, user: UserContext): Promise<AlertStatistics> {
    const dto = this.normalizeDto(queryAlertDto);
    const { transportOrderId, plateNumber, timeFrom, timeTo } = dto;

    const queryBuilderBase = this.alertRepository.createQueryBuilder('alert');

    if (this.isCompanyAdmin(user)) {
      const companyPlateNumbers = await this.getCompanyPlateNumbers(user);
      if (companyPlateNumbers.length === 0) {
        return {
          total: 0,
          pending: 0,
          acknowledged: 0,
          processed: 0,
          closed: 0,
          byType: {} as Record<AlertType, number>,
          byLevel: {} as Record<AlertLevel, number>,
          todayCount: 0,
        };
      }
      queryBuilderBase.andWhere('alert.plateNumber IN (:...plateNumbers)', { plateNumbers: companyPlateNumbers });
    }

    if (transportOrderId) {
      queryBuilderBase.andWhere('alert.transportOrderId = :transportOrderId', { transportOrderId });
    }

    if (plateNumber) {
      queryBuilderBase.andWhere('alert.plateNumber = :plateNumber', { plateNumber });
    }

    const timeRangeQb = queryBuilderBase.clone();
    if (timeFrom && timeTo) {
      timeRangeQb.andWhere('alert.alertTime BETWEEN :timeFrom AND :timeTo', {
        timeFrom: new Date(timeFrom),
        timeTo: new Date(timeTo),
      });
    } else if (timeFrom) {
      timeRangeQb.andWhere('alert.alertTime >= :timeFrom', { timeFrom: new Date(timeFrom) });
    } else if (timeTo) {
      timeRangeQb.andWhere('alert.alertTime <= :timeTo', { timeTo: new Date(timeTo) });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayQb = queryBuilderBase.clone();
    todayQb.andWhere('alert.alertTime BETWEEN :todayStart AND :todayEnd', {
      todayStart,
      todayEnd,
    });

    const countByStatus = async (status?: AlertStatus) => {
      const qb = timeRangeQb.clone();
      if (status) {
        qb.andWhere('alert.status = :status', { status });
      }
      return qb.getCount();
    };

    const [
      total,
      pending,
      acknowledged,
      processed,
      closed,
      todayCount,
    ] = await Promise.all([
      countByStatus(),
      countByStatus(AlertStatus.PENDING),
      countByStatus(AlertStatus.ACKNOWLEDGED),
      countByStatus(AlertStatus.PROCESSED),
      countByStatus(AlertStatus.CLOSED),
      todayQb.getCount(),
    ]);

    const byType: Record<AlertType, number> = {} as Record<AlertType, number>;
    const byLevel: Record<AlertLevel, number> = {} as Record<AlertLevel, number>;

    const typeQb = timeRangeQb.clone();
    const typeResults = await typeQb
      .select('alert.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('alert.type')
      .getRawMany();

    typeResults.forEach((r) => {
      byType[r.type] = parseInt(r.count, 10);
    });

    const levelQb = timeRangeQb.clone();
    const levelResults = await levelQb
      .select('alert.level', 'level')
      .addSelect('COUNT(*)', 'count')
      .groupBy('alert.level')
      .getRawMany();

    levelResults.forEach((r) => {
      byLevel[r.level] = parseInt(r.count, 10);
    });

    return {
      total,
      pending,
      acknowledged,
      processed,
      closed,
      byType,
      byLevel,
      todayCount,
    };
  }

  async getActiveAlerts(user: UserContext): Promise<Alert[]> {
    const queryBuilder = this.alertRepository.createQueryBuilder('alert');
    queryBuilder.where('alert.status NOT IN (:...statuses)', {
      statuses: [AlertStatus.CLOSED, AlertStatus.IGNORED],
    });

    if (this.isCompanyAdmin(user)) {
      const companyPlateNumbers = await this.getCompanyPlateNumbers(user);
      if (companyPlateNumbers.length === 0) {
        return [];
      }
      queryBuilder.andWhere('alert.plateNumber IN (:...plateNumbers)', { plateNumbers: companyPlateNumbers });
    }

    queryBuilder.orderBy('alert.alertTime', 'DESC');
    return queryBuilder.getMany();
  }
}
