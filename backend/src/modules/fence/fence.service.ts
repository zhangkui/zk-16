import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw, Brackets } from 'typeorm';
import { Fence, FenceType, FenceStatus } from './fence.entity';
import { CreateFenceDto, UpdateFenceDto, QueryFenceDto, CheckPointDto } from './fence.dto';
import { GeoHelper } from '../../common/helpers/geo.helper';

@Injectable()
export class FenceService {
  private readonly logger = new Logger(FenceService.name);

  constructor(
    @InjectRepository(Fence)
    private readonly fenceRepository: Repository<Fence>,
  ) {}

  private normalizeDto(dto: any): any {
    const normalized = { ...dto };

    if (normalized.shapeType && ['polygon', 'circle'].includes(normalized.shapeType)) {
      (normalized as any)._shapeType = normalized.shapeType;
    } else if (normalized.type && ['polygon', 'circle'].includes(normalized.type)) {
      (normalized as any)._shapeType = normalized.type;
    }

    const fenceTypeAliasMap: Record<string, string> = {
      forbidden: FenceType.RESTRICTED,
      storage: FenceType.PERMIT,
    };

    if (normalized.fenceType) {
      normalized.fenceType = fenceTypeAliasMap[normalized.fenceType] || normalized.fenceType;
    }

    if (normalized.fenceType) {
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

    if (normalized.coordinates && Array.isArray(normalized.coordinates) && normalized.coordinates.length > 0) {
      if (Array.isArray(normalized.coordinates[0])) {
        normalized.coordinates = normalized.coordinates.map((c: number[]) => ({
          lng: c[1],
          lat: c[0],
        }));
      }
    }

    return normalized;
  }

  private parseGeoJsonCoordinates(geom: any): { lng: number; lat: number }[] | null {
    if (!geom) return null;

    try {
      let geoJson: any;
      if (typeof geom === 'string') {
        geoJson = JSON.parse(geom);
      } else if (geom.type) {
        geoJson = geom;
      } else {
        return null;
      }

      if (geoJson.type === 'Polygon' && geoJson.coordinates && geoJson.coordinates.length > 0) {
        const ring = geoJson.coordinates[0];
        return ring.map((coord: number[]) => ({
          lng: coord[0],
          lat: coord[1],
        }));
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private async enrichFenceWithCoordinates(fence: Fence): Promise<Fence & { coordinates?: { lng: number; lat: number }[] }> {
    const fenceWithExtra = fence as any;

    if (fence.radius && fence.radius > 0) {
      fenceWithExtra.coordinates = null;
      return fenceWithExtra;
    }

    try {
      const result = await this.fenceRepository
        .createQueryBuilder('fence')
        .select(GeoHelper.asGeoJson('fence.geom'), 'geojson')
        .where('fence.id = :id', { id: fence.id })
        .getRawOne();

      if (result?.geojson) {
        fenceWithExtra.coordinates = this.parseGeoJsonCoordinates(result.geojson);
      }
    } catch (error) {
      this.logger?.error?.('解析围栏坐标失败:', error);
    }

    return fenceWithExtra;
  }

  private async enrichFencesWithCoordinates(fences: Fence[]): Promise<any[]> {
    if (fences.length === 0) return [];

    const ids = fences.map((f) => f.id);
    
    try {
      const results = await this.fenceRepository
        .createQueryBuilder('fence')
        .select('fence.id', 'id')
        .addSelect(GeoHelper.asGeoJson('fence.geom'), 'geojson')
        .where('fence.id IN (:...ids)', { ids })
        .getRawMany();

      const coordMap = new Map<string, { lng: number; lat: number }[]>();
      results.forEach((r: any) => {
        const coords = this.parseGeoJsonCoordinates(r.geojson);
        if (coords) {
          coordMap.set(r.id, coords);
        }
      });

      return fences.map((fence) => ({
        ...fence,
        coordinates: (fence as any).radius > 0 ? null : coordMap.get(fence.id) || null,
      }));
    } catch (error) {
      this.logger?.error?.('批量解析围栏坐标失败:', error);
      return fences;
    }
  }

  async create(createFenceDto: CreateFenceDto): Promise<Fence> {
    const dto = this.normalizeDto(createFenceDto);
    const { coordinates, centerLng, centerLat, radius } = dto;

    let geomValue: any;
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
      geomValue = Raw(
        () => GeoHelper.makeCircle(centerLng, centerLat, radius),
      );
    } else if (coordinates && coordinates.length >= 3) {
      geomValue = Raw(() => GeoHelper.makePolygon(coordinates));

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
      geom: geomValue,
    } as any);

    return this.fenceRepository.save(fence) as unknown as Fence;
  }

  async findAll(queryFenceDto: QueryFenceDto): Promise<{ data: any[]; total: number; page: number; pageSize: number }> {
    const dto = this.normalizeDto(queryFenceDto);
    const { type, status, district, page = 1, pageSize = 20 } = dto;

    const queryBuilder = this.fenceRepository.createQueryBuilder('fence');

    if (type && Object.values(FenceType).includes(type as FenceType)) {
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
    const enrichedData = await this.enrichFencesWithCoordinates(data);

    return { data: enrichedData, total, page, pageSize };
  }

  async findOne(id: string): Promise<any> {
    const fence = await this.fenceRepository.findOne({ where: { id } });
    if (!fence) {
      throw new NotFoundException(`围栏 ${id} 不存在`);
    }
    return this.enrichFenceWithCoordinates(fence);
  }

  async getFencesByType(type: FenceType): Promise<any[]> {
    const fences = await this.fenceRepository.find({
      where: { type, status: FenceStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
    return this.enrichFencesWithCoordinates(fences);
  }

  async checkPointInFence(id: string, checkPointDto: CheckPointDto): Promise<{ inFence: boolean; fence: Fence }> {
    const fence = await this.findOne(id);
    const { lng, lat } = checkPointDto;

    const queryBuilder = this.fenceRepository.createQueryBuilder('fence');
    queryBuilder.select(GeoHelper.containsSelect('fence.geom', 'in_fence'), 'in_fence');
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
        qb.where(GeoHelper.contains('fence.geom', lng, lat));
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
        updateData.geom = Raw(() =>
          GeoHelper.makeCircle(finalCenterLng, finalCenterLat, finalRadius),
        );
        updateData.centerLng = finalCenterLng;
        updateData.centerLat = finalCenterLat;
        updateData.radius = finalRadius;
      }
    }

    if (coordinates && coordinates.length >= 3) {
      updateData.geom = Raw(() => GeoHelper.makePolygon(coordinates));

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

  async setStatus(id: string, enabled: boolean): Promise<Fence> {
    const newStatus = enabled ? FenceStatus.ACTIVE : FenceStatus.INACTIVE;
    await this.fenceRepository.update(id, { status: newStatus });
    return this.findOne(id);
  }
}
