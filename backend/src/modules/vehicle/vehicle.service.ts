import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle, VehicleStatus, VehicleType } from './vehicle.entity';
import {
  CreateVehicleDto,
  UpdateVehicleDto,
  QueryVehicleDto,
  ApproveVehicleDto,
  RejectVehicleDto,
} from './vehicle.dto';

@Injectable()
export class VehicleService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
  ) {}

  private static readonly VEHICLE_TYPE_MAP: Record<string, VehicleType> = {
    '厢式货车': VehicleType.DUMP_TRUCK,
    '罐式货车': VehicleType.MIXER_TRUCK,
    '自卸货车': VehicleType.FLATBED,
    '冷藏车': VehicleType.CONTAINER_TRUCK,
  };

  private static readonly STATUS_MAP: Record<string, VehicleStatus> = {
    disabled: VehicleStatus.SUSPENDED,
  };

  private normalizeDto(dto: any): any {
    const normalized = { ...dto };
    if (normalized.company && !normalized.companyName) {
      normalized.companyName = normalized.company;
    }
    if (normalized.capacity && !normalized.loadCapacity) {
      normalized.loadCapacity = normalized.capacity;
    }
    if (normalized.remark && !normalized.auditRemark) {
      normalized.auditRemark = normalized.remark;
    }
    if (normalized.vehicleType && VehicleService.VEHICLE_TYPE_MAP[normalized.vehicleType]) {
      normalized.vehicleType = VehicleService.VEHICLE_TYPE_MAP[normalized.vehicleType];
    }
    if (normalized.status && VehicleService.STATUS_MAP[normalized.status]) {
      normalized.status = VehicleService.STATUS_MAP[normalized.status];
    }
    return normalized;
  }

  async create(createVehicleDto: CreateVehicleDto): Promise<Vehicle> {
    const dto = this.normalizeDto(createVehicleDto);
    const existing = await this.vehicleRepository.findOne({
      where: { plateNumber: dto.plateNumber },
    });
    if (existing) {
      throw new ConflictException(`车牌号 ${dto.plateNumber} 已存在`);
    }

    const vehicle = this.vehicleRepository.create({
      ...dto,
      status: VehicleStatus.PENDING,
    } as Partial<Vehicle>);

    return this.vehicleRepository.save(vehicle as Vehicle);
  }

  async findAll(queryVehicleDto: QueryVehicleDto): Promise<{ data: Vehicle[]; total: number; page: number; pageSize: number }> {
    const dto = this.normalizeDto(queryVehicleDto);
    const { plateNumber, status, companyName, page = 1, pageSize = 10 } = dto;

    const queryBuilder = this.vehicleRepository.createQueryBuilder('vehicle');

    if (plateNumber) {
      queryBuilder.andWhere('vehicle.plateNumber LIKE :plateNumber', {
        plateNumber: `%${plateNumber}%`,
      });
    }

    if (status) {
      queryBuilder.andWhere('vehicle.status = :status', { status });
    }

    if (companyName) {
      queryBuilder.andWhere('vehicle.companyName LIKE :companyName', {
        companyName: `%${companyName}%`,
      });
    }

    queryBuilder.orderBy('vehicle.createdAt', 'DESC');
    queryBuilder.skip((page - 1) * pageSize);
    queryBuilder.take(pageSize);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: string): Promise<Vehicle> {
    const vehicle = await this.vehicleRepository.findOne({ where: { id } });
    if (!vehicle) {
      throw new NotFoundException(`车辆ID ${id} 不存在`);
    }
    return vehicle;
  }

  async findByPlateNumber(plateNumber: string): Promise<Vehicle> {
    const vehicle = await this.vehicleRepository.findOne({ where: { plateNumber } });
    if (!vehicle) {
      throw new NotFoundException(`车牌号 ${plateNumber} 不存在`);
    }
    return vehicle;
  }

  async verify(plateNumber: string): Promise<{ valid: boolean; vehicle?: Vehicle; reason?: string }> {
    const vehicle = await this.vehicleRepository.findOne({ where: { plateNumber } });

    if (!vehicle) {
      return {
        valid: false,
        reason: '车辆未备案',
      };
    }

    if (vehicle.status !== VehicleStatus.APPROVED) {
      const statusMap = {
        [VehicleStatus.PENDING]: '车辆备案待审核',
        [VehicleStatus.REJECTED]: '车辆备案已被拒绝',
        [VehicleStatus.EXPIRED]: '车辆备案已过期',
        [VehicleStatus.SUSPENDED]: '车辆备案已暂停',
      };
      return {
        valid: false,
        vehicle,
        reason: statusMap[vehicle.status] || '车辆状态异常',
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryDate = new Date(vehicle.licenseExpiryDate);
    expiryDate.setHours(0, 0, 0, 0);

    if (expiryDate < today) {
      return {
        valid: false,
        vehicle,
        reason: '道路运输证已过期',
      };
    }

    return {
      valid: true,
      vehicle,
    };
  }

  async approve(id: string, approveVehicleDto: ApproveVehicleDto): Promise<Vehicle> {
    const dto = this.normalizeDto(approveVehicleDto);
    const vehicle = await this.findOne(id);

    if (vehicle.status === VehicleStatus.APPROVED) {
      throw new BadRequestException('该车辆已审核通过，无需重复审核');
    }

    vehicle.status = VehicleStatus.APPROVED;
    vehicle.auditRemark = dto.auditRemark;
    vehicle.auditor = dto.auditor;
    vehicle.auditTime = new Date();

    return this.vehicleRepository.save(vehicle);
  }

  async reject(id: string, rejectVehicleDto: RejectVehicleDto): Promise<Vehicle> {
    const dto = this.normalizeDto(rejectVehicleDto);
    const vehicle = await this.findOne(id);

    if (vehicle.status === VehicleStatus.REJECTED) {
      throw new BadRequestException('该车辆已审核拒绝，无需重复操作');
    }

    vehicle.status = VehicleStatus.REJECTED;
    vehicle.auditRemark = dto.auditRemark;
    vehicle.auditor = dto.auditor;
    vehicle.auditTime = new Date();

    return this.vehicleRepository.save(vehicle);
  }

  async update(id: string, updateVehicleDto: UpdateVehicleDto): Promise<Vehicle> {
    const dto = this.normalizeDto(updateVehicleDto);
    const vehicle = await this.findOne(id);

    if (dto.plateNumber && dto.plateNumber !== vehicle.plateNumber) {
      const existing = await this.vehicleRepository.findOne({
        where: { plateNumber: dto.plateNumber },
      });
      if (existing) {
        throw new ConflictException(`车牌号 ${dto.plateNumber} 已存在`);
      }
    }

    Object.assign(vehicle, dto);

    return this.vehicleRepository.save(vehicle);
  }

  async remove(id: string): Promise<void> {
    const vehicle = await this.findOne(id);
    await this.vehicleRepository.remove(vehicle);
  }
}
