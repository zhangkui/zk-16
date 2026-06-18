import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { createReadStream, existsSync } from 'fs';
import { Evidence, EvidenceStatus } from './evidence.entity';
import { Vehicle } from '../vehicle/vehicle.entity';
import { UserRole } from '../auth/user.entity';
import {
  CreateEvidenceDto,
  QueryEvidenceDto,
  FixEvidenceDto,
  VerifyEvidenceDto,
} from './evidence.dto';

interface UserContext {
  id: string;
  role: string;
  companyId?: string;
  isCompanySuperAdmin?: boolean;
}

@Injectable()
export class EvidenceService {
  constructor(
    @InjectRepository(Evidence)
    private readonly evidenceRepository: Repository<Evidence>,
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

  async create(createEvidenceDto: CreateEvidenceDto, user: UserContext): Promise<Evidence> {
    if (this.isCompanyAdmin(user)) {
      const vehicle = await this.vehicleRepository.findOne({ where: { plateNumber: createEvidenceDto.plateNumber } });
      if (!vehicle || vehicle.companyId !== user.companyId) {
        throw new ForbiddenException('无权为非本公司车辆创建证据');
      }
    }
    const evidence = this.evidenceRepository.create({
      ...createEvidenceDto,
      status: EvidenceStatus.COLLECTING,
    });
    return this.evidenceRepository.save(evidence);
  }

  async findAll(
    queryEvidenceDto: QueryEvidenceDto,
    user: UserContext,
  ): Promise<{ data: Evidence[]; total: number; page: number; pageSize: number }> {
    const { alertId, transportOrderId, plateNumber, type, status, page = 1, pageSize = 10 } =
      queryEvidenceDto;

    const queryBuilder = this.evidenceRepository.createQueryBuilder('evidence');

    if (this.isCompanyAdmin(user)) {
      const companyPlateNumbers = await this.getCompanyPlateNumbers(user);
      if (companyPlateNumbers.length === 0) {
        return { data: [], total: 0, page, pageSize };
      }
      queryBuilder.andWhere('evidence.plateNumber IN (:...plateNumbers)', { plateNumbers: companyPlateNumbers });
    }

    if (alertId) {
      queryBuilder.andWhere('evidence.alertId = :alertId', { alertId });
    }

    if (transportOrderId) {
      queryBuilder.andWhere('evidence.transportOrderId = :transportOrderId', { transportOrderId });
    }

    if (plateNumber) {
      queryBuilder.andWhere('evidence.plateNumber LIKE :plateNumber', {
        plateNumber: `%${plateNumber}%`,
      });
    }

    if (type) {
      queryBuilder.andWhere('evidence.type = :type', { type });
    }

    if (status) {
      queryBuilder.andWhere('evidence.status = :status', { status });
    }

    queryBuilder.orderBy('evidence.createdAt', 'DESC');
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

  async findOne(id: string, user: UserContext): Promise<Evidence> {
    const evidence = await this.evidenceRepository.findOne({ where: { id } });
    if (!evidence) {
      throw new NotFoundException(`证据ID ${id} 不存在`);
    }

    if (this.isCompanyAdmin(user)) {
      const vehicle = await this.vehicleRepository.findOne({ where: { plateNumber: evidence.plateNumber } });
      if (!vehicle || vehicle.companyId !== user.companyId) {
        throw new ForbiddenException('无权访问该证据信息');
      }
    }

    return evidence;
  }

  async getEvidencesByAlertId(alertId: string, user: UserContext): Promise<Evidence[]> {
    const queryBuilder = this.evidenceRepository.createQueryBuilder('evidence');
    queryBuilder.where('evidence.alertId = :alertId', { alertId });

    if (this.isCompanyAdmin(user)) {
      const companyPlateNumbers = await this.getCompanyPlateNumbers(user);
      if (companyPlateNumbers.length === 0) {
        return [];
      }
      queryBuilder.andWhere('evidence.plateNumber IN (:...plateNumbers)', { plateNumbers: companyPlateNumbers });
    }

    queryBuilder.orderBy('evidence.createdAt', 'DESC');
    return queryBuilder.getMany();
  }

  private async calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!existsSync(filePath)) {
        return reject(new BadRequestException('文件不存在，无法计算哈希'));
      }

      const hash = createHash('sha256');
      const stream = createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }

  async fixEvidence(id: string, fixEvidenceDto: FixEvidenceDto, user: UserContext): Promise<Evidence> {
    const evidence = await this.findOne(id, user);

    if (evidence.status !== EvidenceStatus.COLLECTING) {
      throw new BadRequestException('只有采集中的证据才能进行固化操作');
    }

    let fileHash: string;
    try {
      fileHash = await this.calculateFileHash(evidence.filePath + evidence.fileName);
    } catch (error) {
      throw new BadRequestException(`计算文件哈希失败: ${error.message}`);
    }

    evidence.fileHash = fileHash;
    evidence.status = EvidenceStatus.FIXED;
    evidence.fixedBy = fixEvidenceDto.fixedBy;
    evidence.fixedAt = new Date();

    return this.evidenceRepository.save(evidence);
  }

  async verifyEvidence(id: string, verifyEvidenceDto: VerifyEvidenceDto, user: UserContext): Promise<Evidence> {
    const evidence = await this.findOne(id, user);

    if (evidence.status !== EvidenceStatus.FIXED) {
      throw new BadRequestException('只有已固化的证据才能进行审核操作');
    }

    evidence.status = EvidenceStatus.VERIFIED;
    evidence.verifiedBy = verifyEvidenceDto.verifiedBy;
    evidence.verifiedAt = new Date();
    evidence.verifyRemark = verifyEvidenceDto.verifyRemark;

    return this.evidenceRepository.save(evidence);
  }

  async archiveEvidence(id: string, user: UserContext): Promise<Evidence> {
    const evidence = await this.findOne(id, user);

    if (evidence.status !== EvidenceStatus.VERIFIED) {
      throw new BadRequestException('只有已审核的证据才能进行归档操作');
    }

    evidence.status = EvidenceStatus.ARCHIVED;

    return this.evidenceRepository.save(evidence);
  }
}
