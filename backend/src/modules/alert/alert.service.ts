import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere, In, Not } from 'typeorm';
import { Alert, AlertType, AlertLevel, AlertStatus } from './alert.entity';
import { CreateAlertDto, QueryAlertDto, HandleAlertDto } from './alert.dto';
import { KafkaService } from '../../kafka/kafka.service';

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
    private readonly kafkaService: KafkaService,
  ) {}

  async createAlert(createAlertDto: CreateAlertDto): Promise<Alert> {
    const existingAlert = await this.alertRepository.findOne({
      where: {
        transportOrderId: createAlertDto.transportOrderId,
        type: createAlertDto.type,
        status: In([AlertStatus.PENDING, AlertStatus.ACKNOWLEDGED]),
      },
      order: { alertTime: 'DESC' },
    });

    if (existingAlert) {
      const timeDiff = new Date(createAlertDto.alertTime).getTime() - existingAlert.alertTime.getTime();
      if (timeDiff < 5 * 60 * 1000) {
        existingAlert.repeatCount += 1;
        if (createAlertDto.longitude !== undefined) {
          existingAlert.longitude = createAlertDto.longitude;
        }
        if (createAlertDto.latitude !== undefined) {
          existingAlert.latitude = createAlertDto.latitude;
        }
        if (createAlertDto.deviationDistance !== undefined) {
          existingAlert.deviationDistance = createAlertDto.deviationDistance;
        }
        existingAlert.alertTime = new Date(createAlertDto.alertTime);
        return this.alertRepository.save(existingAlert);
      }
    }

    const alert = this.alertRepository.create({
      ...createAlertDto,
      alertTime: new Date(createAlertDto.alertTime),
      level: createAlertDto.level || AlertLevel.WARNING,
      status: AlertStatus.PENDING,
    });

    const savedAlert = await this.alertRepository.save(alert);

    try {
      await this.kafkaService.sendAlert({
        id: savedAlert.id,
        ...createAlertDto,
      });
    } catch (error) {
      this.logger.error('发送告警到Kafka失败:', error);
    }

    return savedAlert;
  }

  async findAll(
    queryAlertDto: QueryAlertDto,
  ): Promise<{ data: Alert[]; total: number; page: number; pageSize: number }> {
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
    } = queryAlertDto;

    const queryBuilder = this.alertRepository.createQueryBuilder('alert');

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

  async findOne(id: string): Promise<Alert> {
    const alert = await this.alertRepository.findOne({ where: { id } });
    if (!alert) {
      throw new NotFoundException(`告警 ${id} 不存在`);
    }
    return alert;
  }

  async acknowledge(id: string, handleAlertDto: HandleAlertDto): Promise<Alert> {
    const alert = await this.findOne(id);

    if (alert.status !== AlertStatus.PENDING) {
      throw new BadRequestException(`只有待处理状态的告警才能确认，当前状态: ${alert.status}`);
    }

    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.handler = handleAlertDto.handler;
    alert.handleRemark = handleAlertDto.handleRemark;
    alert.handleTime = new Date();

    return this.alertRepository.save(alert);
  }

  async processAlert(id: string, handleAlertDto: HandleAlertDto): Promise<Alert> {
    const alert = await this.findOne(id);

    if (![AlertStatus.PENDING, AlertStatus.ACKNOWLEDGED].includes(alert.status)) {
      throw new BadRequestException(
        `只有待处理或已确认状态的告警才能处理，当前状态: ${alert.status}`,
      );
    }

    alert.status = AlertStatus.PROCESSED;
    alert.handler = handleAlertDto.handler;
    if (handleAlertDto.handleRemark) {
      alert.handleRemark = handleAlertDto.handleRemark;
    }
    alert.handleTime = new Date();

    return this.alertRepository.save(alert);
  }

  async closeAlert(id: string, handleAlertDto: HandleAlertDto): Promise<Alert> {
    const alert = await this.findOne(id);

    if (alert.status === AlertStatus.CLOSED) {
      throw new BadRequestException('告警已关闭');
    }

    alert.status = AlertStatus.CLOSED;
    alert.handler = handleAlertDto.handler;
    if (handleAlertDto.handleRemark) {
      alert.handleRemark = handleAlertDto.handleRemark;
    }
    alert.handleTime = new Date();

    return this.alertRepository.save(alert);
  }

  async getAlertStatistics(queryAlertDto: QueryAlertDto): Promise<AlertStatistics> {
    const { transportOrderId, plateNumber, timeFrom, timeTo } = queryAlertDto;

    const baseWhere: FindOptionsWhere<Alert> = {};
    if (transportOrderId) baseWhere.transportOrderId = transportOrderId;
    if (plateNumber) baseWhere.plateNumber = plateNumber;

    const timeRangeWhere: FindOptionsWhere<Alert> = { ...baseWhere };
    if (timeFrom && timeTo) {
      timeRangeWhere.alertTime = Between(new Date(timeFrom), new Date(timeTo));
    } else if (timeFrom) {
      timeRangeWhere.alertTime = Between(new Date(timeFrom), new Date());
    } else if (timeTo) {
      timeRangeWhere.alertTime = Between(new Date(0), new Date(timeTo));
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [
      total,
      pending,
      acknowledged,
      processed,
      closed,
      todayCount,
    ] = await Promise.all([
      this.alertRepository.count({ where: timeRangeWhere }),
      this.alertRepository.count({ where: { ...timeRangeWhere, status: AlertStatus.PENDING } }),
      this.alertRepository.count({ where: { ...timeRangeWhere, status: AlertStatus.ACKNOWLEDGED } }),
      this.alertRepository.count({ where: { ...timeRangeWhere, status: AlertStatus.PROCESSED } }),
      this.alertRepository.count({ where: { ...timeRangeWhere, status: AlertStatus.CLOSED } }),
      this.alertRepository.count({
        where: {
          ...baseWhere,
          alertTime: Between(todayStart, todayEnd),
        },
      }),
    ]);

    const byType: Record<AlertType, number> = {} as Record<AlertType, number>;
    const byLevel: Record<AlertLevel, number> = {} as Record<AlertLevel, number>;

    const typeResults = await this.alertRepository
      .createQueryBuilder('alert')
      .select('alert.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where(timeRangeWhere as any)
      .groupBy('alert.type')
      .getRawMany();

    typeResults.forEach((r) => {
      byType[r.type] = parseInt(r.count, 10);
    });

    const levelResults = await this.alertRepository
      .createQueryBuilder('alert')
      .select('alert.level', 'level')
      .addSelect('COUNT(*)', 'count')
      .where(timeRangeWhere as any)
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

  async getActiveAlerts(): Promise<Alert[]> {
    return this.alertRepository.find({
      where: {
        status: Not(In([AlertStatus.CLOSED, AlertStatus.IGNORED])),
      },
      order: { alertTime: 'DESC' },
    });
  }
}
