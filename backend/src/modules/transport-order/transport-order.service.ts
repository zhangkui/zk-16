import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw, Between, Like, In } from 'typeorm';
import { TransportOrder, TransportOrderStatus } from './transport-order.entity';
import { Vehicle } from '../vehicle/vehicle.entity';
import { Fence, FenceType } from '../fence/fence.entity';
import {
  CreateTransportOrderDto,
  UpdateTransportOrderDto,
  QueryTransportOrderDto,
  UpdateStatusDto,
  RecordDeviationDto,
} from './transport-order.dto';

@Injectable()
export class TransportOrderService {
  constructor(
    @InjectRepository(TransportOrder)
    private readonly transportOrderRepository: Repository<TransportOrder>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    @InjectRepository(Fence)
    private readonly fenceRepository: Repository<Fence>,
  ) {}

  private normalizeDto(dto: any): any {
    const normalized = { ...dto };

    if (normalized.weight && !normalized.plannedWeight) {
      normalized.plannedWeight = normalized.weight;
    }

    if (normalized.expectedStartTime && !normalized.plannedDepartureTime) {
      normalized.plannedDepartureTime = normalized.expectedStartTime;
    }

    if (normalized.expectedEndTime && !normalized.plannedArrivalTime) {
      normalized.plannedArrivalTime = normalized.expectedEndTime;
    }

    if (normalized.status) {
      const statusMap: Record<string, TransportOrderStatus> = {
        'transporting': TransportOrderStatus.IN_TRANSIT,
        'in_transit': TransportOrderStatus.IN_TRANSIT,
        'pending': TransportOrderStatus.PENDING,
        'loading': TransportOrderStatus.LOADING,
        'unloading': TransportOrderStatus.UNLOADING,
        'completed': TransportOrderStatus.COMPLETED,
        'cancelled': TransportOrderStatus.CANCELLED,
        'violation': TransportOrderStatus.VIOLATION,
      };
      if (statusMap[normalized.status]) {
        normalized.status = statusMap[normalized.status];
      }
    }

    return normalized;
  }

  private async generateOrderNo(): Promise<string> {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const prefix = `WT${dateStr}`;

    const lastOrder = await this.transportOrderRepository.findOne({
      where: { orderNo: Raw((alias) => `${alias} LIKE :prefix`, { prefix: `${prefix}%` }) },
      order: { orderNo: 'DESC' },
    });

    let sequence = 1;
    if (lastOrder) {
      const lastSeq = parseInt(lastOrder.orderNo.slice(prefix.length), 10);
      sequence = lastSeq + 1;
    }

    return `${prefix}${String(sequence).padStart(6, '0')}`;
  }

  private async validateVehicleAndFences(
    vehicleId: string,
    loadingFenceId: string,
    unloadingFenceId: string,
  ): Promise<void> {
    const vehicle = await this.vehicleRepository.findOne({ where: { id: vehicleId } });
    if (!vehicle) {
      throw new NotFoundException(`车辆ID ${vehicleId} 不存在`);
    }

    const loadingFence = await this.fenceRepository.findOne({ where: { id: loadingFenceId } });
    if (!loadingFence) {
      throw new NotFoundException(`装货点围栏ID ${loadingFenceId} 不存在`);
    }
    if (loadingFence.type !== FenceType.LOADING && loadingFence.type !== FenceType.PERMIT) {
      throw new BadRequestException('装货点围栏类型不正确');
    }

    const unloadingFence = await this.fenceRepository.findOne({ where: { id: unloadingFenceId } });
    if (!unloadingFence) {
      throw new NotFoundException(`卸货点围栏ID ${unloadingFenceId} 不存在`);
    }
    if (unloadingFence.type !== FenceType.UNLOADING && unloadingFence.type !== FenceType.PERMIT) {
      throw new BadRequestException('卸货点围栏类型不正确');
    }
  }

  private validateStatusTransition(currentStatus: TransportOrderStatus, newStatus: TransportOrderStatus): void {
    if (currentStatus === newStatus) {
      return;
    }

    if (currentStatus === TransportOrderStatus.COMPLETED || currentStatus === TransportOrderStatus.CANCELLED) {
      throw new BadRequestException(`运输单已${currentStatus === TransportOrderStatus.COMPLETED ? '完成' : '取消'}，无法更新状态`);
    }

    const validTransitions: Record<TransportOrderStatus, TransportOrderStatus[]> = {
      [TransportOrderStatus.PENDING]: [TransportOrderStatus.IN_TRANSIT, TransportOrderStatus.CANCELLED],
      [TransportOrderStatus.IN_TRANSIT]: [TransportOrderStatus.LOADING, TransportOrderStatus.UNLOADING, TransportOrderStatus.CANCELLED, TransportOrderStatus.VIOLATION],
      [TransportOrderStatus.LOADING]: [TransportOrderStatus.IN_TRANSIT, TransportOrderStatus.CANCELLED],
      [TransportOrderStatus.UNLOADING]: [TransportOrderStatus.COMPLETED, TransportOrderStatus.CANCELLED],
      [TransportOrderStatus.COMPLETED]: [],
      [TransportOrderStatus.CANCELLED]: [],
      [TransportOrderStatus.VIOLATION]: [TransportOrderStatus.IN_TRANSIT, TransportOrderStatus.CANCELLED],
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(`不允许从状态 ${currentStatus} 转换到 ${newStatus}`);
    }
  }

  async create(createTransportOrderDto: CreateTransportOrderDto): Promise<TransportOrder> {
    const dto = this.normalizeDto(createTransportOrderDto);

    let vehicleId = dto.vehicleId;
    let loadingFenceId = dto.loadingFenceId;
    let unloadingFenceId = dto.unloadingFenceId;

    if (!vehicleId && dto.plateNumber) {
      const vehicle = await this.vehicleRepository.findOne({ where: { plateNumber: dto.plateNumber } });
      if (vehicle) {
        vehicleId = vehicle.id;
      }
    }

    if (!loadingFenceId) {
      const loadingFences = await this.fenceRepository.find({
        where: { type: FenceType.LOADING },
        take: 1,
      });
      if (loadingFences.length > 0) {
        loadingFenceId = loadingFences[0].id;
      }
    }

    if (!unloadingFenceId) {
      const unloadingFences = await this.fenceRepository.find({
        where: { type: FenceType.UNLOADING },
        take: 1,
      });
      if (unloadingFences.length > 0) {
        unloadingFenceId = unloadingFences[0].id;
      }
    }

    if (vehicleId && loadingFenceId && unloadingFenceId) {
      await this.validateVehicleAndFences(vehicleId, loadingFenceId, unloadingFenceId);
    }

    const orderNo = await this.generateOrderNo();

    const transportOrder = this.transportOrderRepository.create({
      ...dto,
      vehicleId: vehicleId || dto.vehicleId,
      loadingFenceId: loadingFenceId || dto.loadingFenceId,
      unloadingFenceId: unloadingFenceId || dto.unloadingFenceId,
      orderNo,
      status: TransportOrderStatus.PENDING,
      deviationCount: 0,
      totalDeviationDistance: 0,
      actualMileage: 0,
    } as Partial<TransportOrder>);

    return this.transportOrderRepository.save(transportOrder as TransportOrder);
  }

  async findAll(
    queryTransportOrderDto: QueryTransportOrderDto,
  ): Promise<{ data: TransportOrder[]; total: number; page: number; pageSize: number }> {
    const dto = this.normalizeDto(queryTransportOrderDto);
    const { orderNo, plateNumber, status, vehicleId, dateFrom, dateTo, page = 1, pageSize = 10 } = dto;

    const queryBuilder = this.transportOrderRepository
      .createQueryBuilder('transportOrder')
      .leftJoinAndSelect('transportOrder.vehicle', 'vehicle')
      .leftJoinAndSelect('transportOrder.loadingFence', 'loadingFence')
      .leftJoinAndSelect('transportOrder.unloadingFence', 'unloadingFence');

    if (orderNo) {
      queryBuilder.andWhere('transportOrder.orderNo LIKE :orderNo', { orderNo: `%${orderNo}%` });
    }

    if (plateNumber) {
      queryBuilder.andWhere('vehicle.plateNumber LIKE :plateNumber', { plateNumber: `%${plateNumber}%` });
    }

    if (status) {
      queryBuilder.andWhere('transportOrder.status = :status', { status });
    }

    if (vehicleId) {
      queryBuilder.andWhere('transportOrder.vehicleId = :vehicleId', { vehicleId });
    }

    if (dateFrom) {
      queryBuilder.andWhere('transportOrder.createdAt >= :dateFrom', { dateFrom: new Date(dateFrom) });
    }

    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      queryBuilder.andWhere('transportOrder.createdAt <= :dateTo', { dateTo: endDate });
    }

    queryBuilder.orderBy('transportOrder.createdAt', 'DESC');
    queryBuilder.skip((page - 1) * pageSize);
    queryBuilder.take(pageSize);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total, page, pageSize };
  }

  async findOne(id: string): Promise<TransportOrder> {
    const transportOrder = await this.transportOrderRepository.findOne({
      where: { id },
      relations: ['vehicle', 'loadingFence', 'unloadingFence'],
    });
    if (!transportOrder) {
      throw new NotFoundException(`运输单ID ${id} 不存在`);
    }
    return transportOrder;
  }

  async findByOrderNo(orderNo: string): Promise<TransportOrder> {
    const transportOrder = await this.transportOrderRepository.findOne({
      where: { orderNo },
      relations: ['vehicle', 'loadingFence', 'unloadingFence'],
    });
    if (!transportOrder) {
      throw new NotFoundException(`运输单号 ${orderNo} 不存在`);
    }
    return transportOrder;
  }

  async findActiveOrdersByVehicle(vehicleId: string): Promise<TransportOrder[]> {
    const activeStatuses = [
      TransportOrderStatus.PENDING,
      TransportOrderStatus.IN_TRANSIT,
      TransportOrderStatus.LOADING,
      TransportOrderStatus.UNLOADING,
      TransportOrderStatus.VIOLATION,
    ];

    return this.transportOrderRepository.find({
      where: {
        vehicleId,
        status: In(activeStatuses) as any,
      },
      relations: ['vehicle', 'loadingFence', 'unloadingFence'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(id: string, updateStatusDto: UpdateStatusDto): Promise<TransportOrder> {
    const transportOrder = await this.findOne(id);
    const dto = this.normalizeDto(updateStatusDto);
    const status = dto.status as TransportOrderStatus;
    const { remark } = dto;

    this.validateStatusTransition(transportOrder.status, status);

    const now = new Date();

    switch (status) {
      case TransportOrderStatus.IN_TRANSIT:
        if (!transportOrder.actualDepartureTime) {
          transportOrder.actualDepartureTime = now;
        }
        break;
      case TransportOrderStatus.LOADING:
        if (!transportOrder.arrivedLoadingTime) {
          transportOrder.arrivedLoadingTime = now;
        }
        break;
      case TransportOrderStatus.UNLOADING:
        if (!transportOrder.arrivedUnloadingTime) {
          transportOrder.arrivedUnloadingTime = now;
        }
        break;
      case TransportOrderStatus.COMPLETED:
        if (!transportOrder.unloadingCompleteTime) {
          transportOrder.unloadingCompleteTime = now;
        }
        break;
    }

    if (transportOrder.status === TransportOrderStatus.LOADING && status === TransportOrderStatus.IN_TRANSIT) {
      if (!transportOrder.loadingCompleteTime) {
        transportOrder.loadingCompleteTime = now;
      }
    }

    transportOrder.status = status;
    if (remark) {
      transportOrder.remark = remark;
    }

    return this.transportOrderRepository.save(transportOrder);
  }

  async recordDeviation(id: string, recordDeviationDto: RecordDeviationDto): Promise<TransportOrder> {
    const transportOrder = await this.findOne(id);

    if (
      transportOrder.status === TransportOrderStatus.COMPLETED ||
      transportOrder.status === TransportOrderStatus.CANCELLED
    ) {
      throw new BadRequestException('运输单已完成或取消，无法记录偏离');
    }

    transportOrder.deviationCount = (transportOrder.deviationCount || 0) + 1;
    transportOrder.totalDeviationDistance =
      (transportOrder.totalDeviationDistance || 0) + recordDeviationDto.distance;

    return this.transportOrderRepository.save(transportOrder);
  }

  async complete(id: string, actualWeight?: number): Promise<TransportOrder> {
    const transportOrder = await this.findOne(id);

    if (transportOrder.status !== TransportOrderStatus.UNLOADING) {
      throw new BadRequestException('只有在卸货中状态才能完成运输单');
    }

    if (!transportOrder.arrivedUnloadingTime) {
      throw new BadRequestException('尚未到达卸货点，无法完成运输单');
    }

    const now = new Date();
    transportOrder.status = TransportOrderStatus.COMPLETED;
    transportOrder.unloadingCompleteTime = now;

    if (actualWeight !== undefined) {
      transportOrder.actualWeight = actualWeight;
    }

    return this.transportOrderRepository.save(transportOrder);
  }

  async cancel(id: string, remark?: string): Promise<TransportOrder> {
    const transportOrder = await this.findOne(id);

    if (
      transportOrder.status === TransportOrderStatus.COMPLETED ||
      transportOrder.status === TransportOrderStatus.CANCELLED
    ) {
      throw new BadRequestException('运输单已完成或取消，无需重复操作');
    }

    transportOrder.status = TransportOrderStatus.CANCELLED;
    if (remark) {
      transportOrder.remark = remark;
    }

    return this.transportOrderRepository.save(transportOrder);
  }

  async update(id: string, updateTransportOrderDto: UpdateTransportOrderDto): Promise<TransportOrder> {
    const transportOrder = await this.findOne(id);

    const { vehicleId, loadingFenceId, unloadingFenceId, plannedRoute, ...otherData } = updateTransportOrderDto;

    if (vehicleId || loadingFenceId || unloadingFenceId) {
      await this.validateVehicleAndFences(
        vehicleId || transportOrder.vehicleId,
        loadingFenceId || transportOrder.loadingFenceId,
        unloadingFenceId || transportOrder.unloadingFenceId,
      );
    }

    Object.assign(transportOrder, otherData);

    if (vehicleId) transportOrder.vehicleId = vehicleId;
    if (loadingFenceId) transportOrder.loadingFenceId = loadingFenceId;
    if (unloadingFenceId) transportOrder.unloadingFenceId = unloadingFenceId;
    if (plannedRoute) transportOrder.plannedRoute = plannedRoute as any;

    return this.transportOrderRepository.save(transportOrder);
  }

  async remove(id: string): Promise<void> {
    const transportOrder = await this.findOne(id);
    await this.transportOrderRepository.remove(transportOrder);
  }
}
