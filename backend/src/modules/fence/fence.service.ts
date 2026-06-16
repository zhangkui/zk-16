import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw, Brackets } from 'typeorm';
import { Fence, FenceType, FenceStatus } from './fence.entity';
import { CreateFenceDto, UpdateFenceDto, QueryFenceDto, CheckPointDto } from './fence.dto';

@Injectable()
export class FenceService {
  constructor(
    @InjectRepository(Fence)
    private readonly fenceRepository: Repository<Fence>,
  ) {}

  private normalizeDto(dto: any): any {
    const normalized = { ...dto };

    if (normalized.fenceType && !normalized.type) {
      normalized.type = normalized.fenceType;
    }

    if (normalized.enabled !== undefined && !normalized.status) {
      normalized.status = normalized.enabled ? FenceStatus.ACTIVE : FenceStatus.INACTIVE;
    }

    if (normalized.center && Array.isArray(normalized.center) && normalized.center.length >= 2) {
      if (!normalized.centerLat) normalized.centerLat = normalized.center[0];
      if (!normalized.centerLng) normalized.centerLng = normalized.center[1];
    }

    if (normalized.description && !normalized.remark) {
      normalized.remark = normalized.description;
    }

    return normalized;
  }

  async create(createFenceDto: CreateFenceDto): Promise<Fence> {
    const dto = this.normalizeDto(createFenceDto);
    const { coordinates, centerLng, centerLat, radius } = dto;

    let geomExpression: string;
    let finalCenterLng: number;
    let finalCenterLat: number;
    let finalRadius: number;

    if (radius && radius > 0) {
      if (centerLng === undefined || centerLat === undefined) {
        throw new BadRequestException('圆形围栏必须提供中心点经纬度');
      }
      finalCenterLng = centerLng;
      finalCenterLat = centerLat;
      finalRadius = radius;
      geomExpression = `ST_Buffer(ST_SetSRID(ST_MakePoint(${centerLng}, ${centerLat}), 4326)::geography, ${radius})::geometry`;
    } else if (coordinates && coordinates.length >= 3) {
      const ring = [...coordinates, coordinates[0]];
      const points = ring.map((c) => `${c.lng} ${c.lat}`).join(', ');
      geomExpression = `ST_SetSRID(ST_MakePolygon(ST_GeomFromText('LINESTRING(${points})')), 4326)`;

      const lngs = coordinates.map((c) => c.lng);
      const lats = coordinates.map((c) => c.lat);
      finalCenterLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
      finalCenterLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      finalRadius = 0;
    } else {
      throw new BadRequestException('必须提供多边形坐标点数组或圆形围栏参数(中心点+半径)');
    }

    const fence = this.fenceRepository.create({
      ...dto,
      centerLng: finalCenterLng,
      centerLat: finalCenterLat,
      radius: finalRadius,
      geom: Raw(() => geomExpression),
    } as any);

    return this.fenceRepository.save(fence) as unknown as Fence;
  }

  async findAll(queryFenceDto: QueryFenceDto): Promise<{ data: Fence[]; total: number; page: number; pageSize: number }> {
    const dto = this.normalizeDto(queryFenceDto);
    const { type, status, district, page = 1, pageSize = 20 } = dto;

    const queryBuilder = this.fenceRepository.createQueryBuilder('fence');

    if (type) {
      queryBuilder.andWhere('fence.type = :type', { type });
    }

    if (status) {
      queryBuilder.andWhere('fence.status = :status', { status });
    }

    if (district) {
      queryBuilder.andWhere('fence.district = :district', { district });
    }

    queryBuilder.orderBy('fence.createdAt', 'DESC');
    queryBuilder.skip((page - 1) * pageSize);
    queryBuilder.take(pageSize);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total, page, pageSize };
  }

  async findOne(id: string): Promise<Fence> {
    const fence = await this.fenceRepository.findOne({ where: { id } });
    if (!fence) {
      throw new NotFoundException(`围栏 ${id} 不存在`);
    }
    return fence;
  }

  async getFencesByType(type: FenceType): Promise<Fence[]> {
    return this.fenceRepository.find({
      where: { type, status: FenceStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
  }

  async checkPointInFence(id: string, checkPointDto: CheckPointDto): Promise<{ inFence: boolean; fence: Fence }> {
    const fence = await this.findOne(id);
    const { lng, lat } = checkPointDto;

    const queryBuilder = this.fenceRepository.createQueryBuilder('fence');
    queryBuilder.select('ST_Contains(fence.geom, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326))', 'in_fence');
    queryBuilder.where('fence.id = :id', { id });
    queryBuilder.setParameter('lng', lng);
    queryBuilder.setParameter('lat', lat);

    const result = await queryBuilder.getRawOne();
    const inFence = result?.in_fence === true || result?.in_fence === 't';

    return { inFence, fence };
  }

  async findFencesContainingPoint(checkPointDto: CheckPointDto): Promise<Fence[]> {
    const { lng, lat } = checkPointDto;

    const queryBuilder = this.fenceRepository.createQueryBuilder('fence');
    queryBuilder.where('fence.status = :status', { status: FenceStatus.ACTIVE });
    queryBuilder.andWhere(
      new Brackets((qb) => {
        qb.where('ST_Contains(fence.geom, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)) = true');
      }),
    );
    queryBuilder.setParameter('lng', lng);
    queryBuilder.setParameter('lat', lat);
    queryBuilder.orderBy('fence.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  async update(id: string, updateFenceDto: UpdateFenceDto): Promise<Fence> {
    const dto = this.normalizeDto(updateFenceDto);
    const fence = await this.findOne(id);
    const { coordinates, centerLng, centerLat, radius } = dto;

    const updateData: Partial<Fence> & { geom?: any } = { ...dto };

    if (radius !== undefined || centerLng !== undefined || centerLat !== undefined) {
      const finalRadius = radius ?? fence.radius;
      const finalCenterLng = centerLng ?? fence.centerLng;
      const finalCenterLat = centerLat ?? fence.centerLat;

      if (finalRadius > 0) {
        updateData.geom = Raw(
          () => `ST_Buffer(ST_SetSRID(ST_MakePoint(${finalCenterLng}, ${finalCenterLat}), 4326)::geography, ${finalRadius})::geometry`,
        );
        updateData.centerLng = finalCenterLng;
        updateData.centerLat = finalCenterLat;
        updateData.radius = finalRadius;
      }
    }

    if (coordinates && coordinates.length >= 3) {
      const ring = [...coordinates, coordinates[0]];
      const points = ring.map((c) => `${c.lng} ${c.lat}`).join(', ');
      updateData.geom = Raw(
        () => `ST_SetSRID(ST_MakePolygon(ST_GeomFromText('LINESTRING(${points})')), 4326)`,
      );

      const lngs = coordinates.map((c) => c.lng);
      const lats = coordinates.map((c) => c.lat);
      updateData.centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
      updateData.centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      updateData.radius = 0;
    }

    await this.fenceRepository.update(id, updateData as any);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const fence = await this.findOne(id);
    await this.fenceRepository.remove(fence);
  }

  async toggleStatus(id: string): Promise<Fence> {
    const fence = await this.findOne(id);
    const newStatus = fence.status === FenceStatus.ACTIVE ? FenceStatus.INACTIVE : FenceStatus.ACTIVE;
    await this.fenceRepository.update(id, { status: newStatus });
    return this.findOne(id);
  }
}
