import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw, Brackets } from 'typeorm';
import { Fence, FenceType, FenceStatus } from './fence.entity';
import { CreateFenceDto, UpdateFenceDto, QueryFenceDto, CheckPointDto, UpdateFenceCoordinatesDto } from './fence.dto';
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

  private async enrichFenceWithCoordinates(fence: Fence): Promise<Fence & { coordinates?: { lng: number; lat: number }[] | null }> {
    const fenceWithExtra = fence as any;

    try {
      const result = await this.fenceRepository
        .createQueryBuilder('fence')
        .select(GeoHelper.asGeoJson('fence.geom'), 'geojson')
        .where('fence.id = :id', { id: fence.id })
        .getRawOne();

      if (result?.geojson) {
        fenceWithExtra.coordinates = this.parseGeoJsonCoordinates(result.geojson);
      } else {
        fenceWithExtra.coordinates = null;
      }
    } catch (error) {
      this.logger?.error?.('解析围栏坐标失败:', error);
      fenceWithExtra.coordinates = null;
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

      const coordMap = new Map<string, { lng: number; lat: number }[] | null>();
      results.forEach((r: any) => {
        const coords = this.parseGeoJsonCoordinates(r.geojson);
        coordMap.set(r.id, coords || null);
      });

      return fences.map((fence) => ({
        ...fence,
        coordinates: coordMap.get(fence.id) ?? null,
      }));
    } catch (error) {
      this.logger?.error?.('批量解析围栏坐标失败:', error);
      return fences.map((fence) => ({ ...fence, coordinates: null }));
    }
  }

  async create(createFenceDto: CreateFenceDto): Promise<Fence> {
    const dto = this.normalizeDto(createFenceDto);
    const { coordinates } = dto;

    const createData: any = { ...dto };

    if (coordinates && coordinates.length >= 3) {
      createData.geom = Raw(() => GeoHelper.makePolygon(coordinates));

      const lngs = coordinates.map((c) => c.lng);
      const lats = coordinates.map((c) => c.lat);
      createData.centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
      createData.centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      createData.radius = 0;
    }

    const fence = this.fenceRepository.create(createData);

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
    const { coordinates } = dto;

    const updateData: Partial<Fence> & { geom?: any } = { ...dto };

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

  async updateCoordinates(id: string, updateCoordinatesDto: UpdateFenceCoordinatesDto): Promise<Fence> {
    const dto = this.normalizeDto(updateCoordinatesDto);
    const { coordinates } = dto;

    if (!coordinates || coordinates.length < 3) {
      throw new BadRequestException('围栏至少需要3个坐标点');
    }

    const fence = await this.fenceRepository.findOne({ where: { id } });
    if (!fence) {
      throw new NotFoundException(`围栏 ${id} 不存在`);
    }

    const updateData: any = {
      geom: Raw(() => GeoHelper.makePolygon(coordinates)),
    };

    const lngs = coordinates.map((c) => c.lng);
    const lats = coordinates.map((c) => c.lat);
    updateData.centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    updateData.centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    updateData.radius = 0;

    await this.fenceRepository.update(id, updateData);
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
