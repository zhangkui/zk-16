import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { createReadStream, existsSync } from 'fs';
import { Evidence, EvidenceStatus } from './evidence.entity';
import {
  CreateEvidenceDto,
  QueryEvidenceDto,
  FixEvidenceDto,
  VerifyEvidenceDto,
} from './evidence.dto';

@Injectable()
export class EvidenceService {
  constructor(
    @InjectRepository(Evidence)
    private readonly evidenceRepository: Repository<Evidence>,
  ) {}

  async create(createEvidenceDto: CreateEvidenceDto): Promise<Evidence> {
    const evidence = this.evidenceRepository.create({
      ...createEvidenceDto,
      status: EvidenceStatus.COLLECTING,
    });
    return this.evidenceRepository.save(evidence);
  }

  async findAll(
    queryEvidenceDto: QueryEvidenceDto,
  ): Promise<{ data: Evidence[]; total: number; page: number; pageSize: number }> {
    const { alertId, transportOrderId, plateNumber, type, status, page = 1, pageSize = 10 } =
      queryEvidenceDto;

    const queryBuilder = this.evidenceRepository.createQueryBuilder('evidence');

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

  async findOne(id: string): Promise<Evidence> {
    const evidence = await this.evidenceRepository.findOne({ where: { id } });
    if (!evidence) {
      throw new NotFoundException(`证据ID ${id} 不存在`);
    }
    return evidence;
  }

  async getEvidencesByAlertId(alertId: string): Promise<Evidence[]> {
    return this.evidenceRepository.find({
      where: { alertId },
      order: { createdAt: 'DESC' },
    });
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

  async fixEvidence(id: string, fixEvidenceDto: FixEvidenceDto): Promise<Evidence> {
    const evidence = await this.findOne(id);

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

  async verifyEvidence(id: string, verifyEvidenceDto: VerifyEvidenceDto): Promise<Evidence> {
    const evidence = await this.findOne(id);

    if (evidence.status !== EvidenceStatus.FIXED) {
      throw new BadRequestException('只有已固化的证据才能进行审核操作');
    }

    evidence.status = EvidenceStatus.VERIFIED;
    evidence.verifiedBy = verifyEvidenceDto.verifiedBy;
    evidence.verifiedAt = new Date();
    evidence.verifyRemark = verifyEvidenceDto.verifyRemark;

    return this.evidenceRepository.save(evidence);
  }

  async archiveEvidence(id: string): Promise<Evidence> {
    const evidence = await this.findOne(id);

    if (evidence.status !== EvidenceStatus.VERIFIED) {
      throw new BadRequestException('只有已审核的证据才能进行归档操作');
    }

    evidence.status = EvidenceStatus.ARCHIVED;

    return this.evidenceRepository.save(evidence);
  }
}
