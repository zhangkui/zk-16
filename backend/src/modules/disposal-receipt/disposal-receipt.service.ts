import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DisposalReceipt, DisposalReceiptStatus } from './disposal-receipt.entity';
import { TransportOrder } from '../transport-order/transport-order.entity';
import { Vehicle } from '../vehicle/vehicle.entity';
import { UserRole } from '../auth/user.entity';
import {
  CreateDisposalReceiptDto,
  UpdateDisposalReceiptDto,
  QueryDisposalReceiptDto,
  MatchReceiptDto,
} from './disposal-receipt.dto';

interface UserContext {
  id: string;
  role: string;
  companyId?: string;
  isCompanySuperAdmin?: boolean;
}

interface MatchDiff {
  plateNumber?: { receipt: string; transport: string };
  wasteType?: { receipt: string; transport: string };
  weight?: { receipt: number; transport: number; diffPercent: number };
  loadingDate?: { receipt: string; transport: string };
}

interface MatchResult {
  matched: boolean;
  matchScore: number;
  diff: MatchDiff;
  mismatchReason: string;
}

@Injectable()
export class DisposalReceiptService {
  constructor(
    @InjectRepository(DisposalReceipt)
    private readonly disposalReceiptRepository: Repository<DisposalReceipt>,
    @InjectRepository(TransportOrder)
    private readonly transportOrderRepository: Repository<TransportOrder>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
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

  async create(createDisposalReceiptDto: CreateDisposalReceiptDto): Promise<DisposalReceipt> {
    const existing = await this.disposalReceiptRepository.findOne({
      where: { receiptNo: createDisposalReceiptDto.receiptNo },
    });
    if (existing) {
      throw new ConflictException(`联单编号 ${createDisposalReceiptDto.receiptNo} 已存在`);
    }

    const receipt = this.disposalReceiptRepository.create({
      ...createDisposalReceiptDto,
      status: DisposalReceiptStatus.PENDING,
    });

    return this.disposalReceiptRepository.save(receipt);
  }

  async findAll(
    queryDisposalReceiptDto: QueryDisposalReceiptDto,
    user: UserContext,
  ): Promise<{ data: DisposalReceipt[]; total: number; page: number; pageSize: number }> {
    const {
      receiptNo,
      plateNumber,
      status,
      wasteType,
      loadingDateStart,
      loadingDateEnd,
      page = 1,
      pageSize = 10,
    } = queryDisposalReceiptDto;

    const queryBuilder = this.disposalReceiptRepository.createQueryBuilder('receipt');

    if (this.isCompanyAdmin(user)) {
      const companyPlateNumbers = await this.getCompanyPlateNumbers(user);
      if (companyPlateNumbers.length === 0) {
        return { data: [], total: 0, page, pageSize };
      }
      queryBuilder.andWhere('receipt.plateNumber IN (:...plateNumbers)', { plateNumbers: companyPlateNumbers });
    }

    if (receiptNo) {
      queryBuilder.andWhere('receipt.receiptNo LIKE :receiptNo', {
        receiptNo: `%${receiptNo}%`,
      });
    }

    if (plateNumber) {
      queryBuilder.andWhere('receipt.plateNumber LIKE :plateNumber', {
        plateNumber: `%${plateNumber}%`,
      });
    }

    if (status) {
      queryBuilder.andWhere('receipt.status = :status', { status });
    }

    if (wasteType) {
      queryBuilder.andWhere('receipt.wasteType LIKE :wasteType', {
        wasteType: `%${wasteType}%`,
      });
    }

    if (loadingDateStart) {
      queryBuilder.andWhere('receipt.loadingDate >= :loadingDateStart', { loadingDateStart });
    }

    if (loadingDateEnd) {
      queryBuilder.andWhere('receipt.loadingDate <= :loadingDateEnd', { loadingDateEnd });
    }

    queryBuilder.orderBy('receipt.createdAt', 'DESC');
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

  async findOne(id: string, user: UserContext): Promise<DisposalReceipt> {
    const receipt = await this.disposalReceiptRepository.findOne({ where: { id } });
    if (!receipt) {
      throw new NotFoundException(`处置联单ID ${id} 不存在`);
    }

    if (this.isCompanyAdmin(user)) {
      const vehicle = await this.vehicleRepository.findOne({ where: { plateNumber: receipt.plateNumber } });
      if (!vehicle || vehicle.companyId !== user.companyId) {
        throw new ForbiddenException('无权访问该处置联单信息');
      }
    }

    return receipt;
  }

  async findByReceiptNo(receiptNo: string, user: UserContext): Promise<DisposalReceipt> {
    const receipt = await this.disposalReceiptRepository.findOne({ where: { receiptNo } });
    if (!receipt) {
      throw new NotFoundException(`联单编号 ${receiptNo} 不存在`);
    }

    if (this.isCompanyAdmin(user)) {
      const vehicle = await this.vehicleRepository.findOne({ where: { plateNumber: receipt.plateNumber } });
      if (!vehicle || vehicle.companyId !== user.companyId) {
        throw new ForbiddenException('无权访问该处置联单信息');
      }
    }

    return receipt;
  }

  async getUnmatchedReceipts(user: UserContext): Promise<DisposalReceipt[]> {
    const queryBuilder = this.disposalReceiptRepository.createQueryBuilder('receipt');
    queryBuilder.where('receipt.status = :status', { status: DisposalReceiptStatus.PENDING });

    if (this.isCompanyAdmin(user)) {
      const companyPlateNumbers = await this.getCompanyPlateNumbers(user);
      if (companyPlateNumbers.length === 0) {
        return [];
      }
      queryBuilder.andWhere('receipt.plateNumber IN (:...plateNumbers)', { plateNumbers: companyPlateNumbers });
    }

    queryBuilder.orderBy('receipt.createdAt', 'DESC');
    return queryBuilder.getMany();
  }

  async getMatchStatistics(user: UserContext): Promise<{
    total: number;
    pending: number;
    matched: number;
    mismatched: number;
    expired: number;
    matchRate: number;
  }> {
    let companyPlateNumbers: string[] = [];
    if (this.isCompanyAdmin(user)) {
      companyPlateNumbers = await this.getCompanyPlateNumbers(user);
      if (companyPlateNumbers.length === 0) {
        return {
          total: 0,
          pending: 0,
          matched: 0,
          mismatched: 0,
          expired: 0,
          matchRate: 0,
        };
      }
    }

    const buildCountQuery = (status?: DisposalReceiptStatus) => {
      const qb = this.disposalReceiptRepository.createQueryBuilder('receipt');
      if (status) {
        qb.where('receipt.status = :status', { status });
      }
      if (this.isCompanyAdmin(user) && companyPlateNumbers.length > 0) {
        qb.andWhere('receipt.plateNumber IN (:...plateNumbers)', { plateNumbers: companyPlateNumbers });
      }
      return qb.getCount();
    };

    const [total, pending, matched, mismatched, expired] = await Promise.all([
      buildCountQuery(),
      buildCountQuery(DisposalReceiptStatus.PENDING),
      buildCountQuery(DisposalReceiptStatus.MATCHED),
      buildCountQuery(DisposalReceiptStatus.MISMATCHED),
      buildCountQuery(DisposalReceiptStatus.EXPIRED),
    ]);

    const processed = matched + mismatched;
    const matchRate = processed > 0 ? Number(((matched / processed) * 100).toFixed(2)) : 0;

    return {
      total,
      pending,
      matched,
      mismatched,
      expired,
      matchRate,
    };
  }

  private isWeightMatch(receiptWeight: number, transportWeight: number): boolean {
    if (!receiptWeight || !transportWeight) return false;
    const diff = Math.abs(receiptWeight - transportWeight);
    const diffPercent = (diff / transportWeight) * 100;
    return diffPercent <= 5;
  }

  private getWeightDiffPercent(receiptWeight: number, transportWeight: number): number {
    if (!receiptWeight || !transportWeight) return 100;
    const diff = Math.abs(receiptWeight - transportWeight);
    return Number(((diff / transportWeight) * 100).toFixed(2));
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    if (!date1 || !date2) return false;
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }

  private async performMatch(receipt: DisposalReceipt, transportOrder: TransportOrder): Promise<MatchResult> {
    const diff: MatchDiff = {};
    const mismatchReasons: string[] = [];
    let matchScore = 0;
    const totalChecks = 4;

    const vehicle = await this.vehicleRepository.findOne({
      where: { id: transportOrder.vehicleId },
    });
    const transportPlateNumber = vehicle?.plateNumber;

    if (receipt.plateNumber === transportPlateNumber) {
      matchScore++;
    } else {
      diff.plateNumber = {
        receipt: receipt.plateNumber,
        transport: transportPlateNumber || '未知',
      };
      mismatchReasons.push(`车牌不匹配：联单${receipt.plateNumber} vs 运输单${transportPlateNumber || '未知'}`);
    }

    if (receipt.wasteType === transportOrder.wasteType) {
      matchScore++;
    } else {
      diff.wasteType = {
        receipt: receipt.wasteType,
        transport: transportOrder.wasteType,
      };
      mismatchReasons.push(`垃圾类型不匹配：联单${receipt.wasteType} vs 运输单${transportOrder.wasteType}`);
    }

    const transportWeight = transportOrder.actualWeight || transportOrder.plannedWeight;
    const receiptWeight = receipt.actualWeight || receipt.receiptWeight;
    if (this.isWeightMatch(receiptWeight, transportWeight)) {
      matchScore++;
    } else {
      diff.weight = {
        receipt: receiptWeight,
        transport: transportWeight,
        diffPercent: this.getWeightDiffPercent(receiptWeight, transportWeight),
      };
      mismatchReasons.push(`重量误差超过5%：联单${receiptWeight}吨 vs 运输单${transportWeight}吨，误差${this.getWeightDiffPercent(receiptWeight, transportWeight)}%`);
    }

    const transportLoadingDate = transportOrder.loadingCompleteTime || transportOrder.actualDepartureTime;
    if (this.isSameDay(receipt.loadingDate, transportLoadingDate)) {
      matchScore++;
    } else {
      diff.loadingDate = {
        receipt: new Date(receipt.loadingDate).toISOString().split('T')[0],
        transport: transportLoadingDate ? new Date(transportLoadingDate).toISOString().split('T')[0] : '未知',
      };
      mismatchReasons.push(`装载日期不匹配：联单${new Date(receipt.loadingDate).toISOString().split('T')[0]} vs 运输单${transportLoadingDate ? new Date(transportLoadingDate).toISOString().split('T')[0] : '未知'}`);
    }

    const matched = matchScore === totalChecks;

    return {
      matched,
      matchScore,
      diff,
      mismatchReason: mismatchReasons.join('; '),
    };
  }

  async matchReceipt(id: string, matchReceiptDto: MatchReceiptDto, user: UserContext): Promise<DisposalReceipt> {
    const receipt = await this.findOne(id, user);

    if (receipt.status !== DisposalReceiptStatus.PENDING) {
      throw new BadRequestException('该联单已完成匹配，无需重复操作');
    }

    const transportOrder = await this.transportOrderRepository.findOne({
      where: { id: matchReceiptDto.transportOrderId },
    });
    if (!transportOrder) {
      throw new NotFoundException(`运输单ID ${matchReceiptDto.transportOrderId} 不存在`);
    }

    const matchResult = await this.performMatch(receipt, transportOrder);

    receipt.transportOrderId = transportOrder.id;
    receipt.status = matchResult.matched ? DisposalReceiptStatus.MATCHED : DisposalReceiptStatus.MISMATCHED;
    receipt.matchedBy = matchReceiptDto.matchedBy;
    receipt.matchedAt = new Date();
    receipt.matchDiff = matchResult.diff;
    receipt.mismatchReason = matchResult.matched ? null : matchResult.mismatchReason;

    return this.disposalReceiptRepository.save(receipt);
  }

  async update(id: string, updateDisposalReceiptDto: UpdateDisposalReceiptDto, user: UserContext): Promise<DisposalReceipt> {
    const receipt = await this.findOne(id, user);

    if (updateDisposalReceiptDto.receiptNo && updateDisposalReceiptDto.receiptNo !== receipt.receiptNo) {
      const existing = await this.disposalReceiptRepository.findOne({
        where: { receiptNo: updateDisposalReceiptDto.receiptNo },
      });
      if (existing) {
        throw new ConflictException(`联单编号 ${updateDisposalReceiptDto.receiptNo} 已存在`);
      }
    }

    Object.assign(receipt, updateDisposalReceiptDto);

    return this.disposalReceiptRepository.save(receipt);
  }

  async remove(id: string, user: UserContext): Promise<void> {
    const receipt = await this.findOne(id, user);
    await this.disposalReceiptRepository.remove(receipt);
  }
}
