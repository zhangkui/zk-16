import { Injectable, NotFoundException, BadRequestException, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Fence, FenceType, FenceStatus } from './fence.entity';
import { UserRole } from '../auth/user.entity';
import { CreateFenceDto, UpdateFenceDto, QueryFenceDto, CheckPointDto, UpdateFenceCoordinatesDto } from './fence.dto';
import { GeoHelper } from '../../common/helpers/geo.helper';

interface UserContext {
  id: string;
  role: string;
  companyId?: string;
  isCompanySuperAdmin?: boolean;
}

@Injectable()
export class FenceService {
  private readonly logger = new Logger(FenceService.name);

  constructor(
    @InjectRepository(Fence)
    private readonly fenceRepository: Repository<Fence>,
  ) {}

  private isCompanyAdmin(user: UserContext): boolean {
    return (
      user.role === UserRole.COMPANY_SUPER_ADMIN ||
      user.role === UserRole.COMPANY_ADMIN
    );
  }

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
        if (ring.length >= 4 &&
            ring[0][0] === ring[ring.length - 1][0] &&
            ring[0][1] === ring[ring.length - 1][1]) {
          return ring.slice(0, -1).map((coord: number[]) => ({
            lng: coord[0],
            lat: coord[1],
          }));
        }
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

  async create(createFenceDto: CreateFenceDto, user: UserContext): Promise<Fence> {
    const dto = this.normalizeDto(createFenceDto);
    const { coordinates, ...rest } = dto;

    const insertData: any = { ...rest };

    if (this.isCompanyAdmin(user)) {
      insertData.companyId = user.companyId;
    } else if (dto.companyId) {
      insertData.companyId = dto.companyId;
    }

    let wkt: string | null = null;
    if (coordinates && coordinates.length >= 3) {
      wkt = GeoHelper.makePolygonWkt(coordinates);

      const lngs = coordinates.map((c) => c.lng);
      const lats = coordinates.map((c) => c.lat);
      insertData.centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
      insertData.centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      insertData.radius = 0;
    }

    const qb = this.fenceRepository
      .createQueryBuilder()
      .insert()
      .into(Fence)
      .values({
        ...insertData,
        geom: wkt ? () => `ST_SetSRID(ST_GeomFromText(:wkt), 4326)` : undefined,
      })
      .returning('*');

    if (wkt) {
      qb.setParameter('wkt', wkt);
    }

    const result = await qb.execute();
    const savedId = result.identifiers[0].id;

    return this.findOne(savedId, user);
  }

  async findAll(queryFenceDto: QueryFenceDto, user: UserContext): Promise<{ data: any[]; total: number; page: number; pageSize: number }> {
    const dto = this.normalizeDto(queryFenceDto);
    const { type, status, district, companyId, page = 1, pageSize = 20 } = dto;

    const queryBuilder = this.fenceRepository.createQueryBuilder('fence');

    if (this.isCompanyAdmin(user)) {
      queryBuilder.andWhere('fence.companyId = :companyId', { companyId: user.companyId });
    } else if (companyId) {
      queryBuilder.andWhere('fence.companyId = :companyId', { companyId });
    }

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

  async findOne(id: string, user: UserContext): Promise<any> {
    const fence = await this.fenceRepository.findOne({ where: { id } });
    if (!fence) {
      throw new NotFoundException(`围栏 ${id} 不存在`);
    }

    if (this.isCompanyAdmin(user) && fence.companyId !== user.companyId) {
      throw new ForbiddenException('无权访问该围栏信息');
    }

    return this.enrichFenceWithCoordinates(fence);
  }

  async getFencesByType(type: FenceType, user: UserContext): Promise<any[]> {
    const queryBuilder = this.fenceRepository.createQueryBuilder('fence');
    queryBuilder.where('fence.type = :type', { type });
    queryBuilder.andWhere('fence.status = :status', { status: FenceStatus.ACTIVE });

    if (this.isCompanyAdmin(user)) {
      queryBuilder.andWhere('fence.companyId = :companyId', { companyId: user.companyId });
    }

    queryBuilder.orderBy('fence.createdAt', 'DESC');
    const fences = await queryBuilder.getMany();
    return this.enrichFencesWithCoordinates(fences);
  }

  private pointInPolygon(point: { lng: number; lat: number }, polygon: { lng: number; lat: number }[]): boolean {
    if (!polygon || polygon.length < 3) return false;

    let inside = false;
    const n = polygon.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = polygon[i].lng, yi = polygon[i].lat;
      const xj = polygon[j].lng, yj = polygon[j].lat;

      const intersect = ((yi > point.lat) !== (yj > point.lat)) &&
        (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }

    return inside;
  }

  async checkPointInFence(id: string, checkPointDto: CheckPointDto, user: UserContext): Promise<{ inFence: boolean; fence: any }> {
    const fence = await this.findOne(id, user);
    const { lng, lat } = checkPointDto;

    const inFence = this.pointInPolygon({ lng, lat }, fence.coordinates || []);

    return { inFence, fence };
  }

  async findFencesContainingPoint(checkPointDto: CheckPointDto, user: UserContext): Promise<any[]> {
    const { lng, lat } = checkPointDto;
    const point = { lng, lat };

    const queryBuilder = this.fenceRepository.createQueryBuilder('fence');
    queryBuilder.where('fence.status = :status', { status: FenceStatus.ACTIVE });

    if (this.isCompanyAdmin(user)) {
      queryBuilder.andWhere('fence.companyId = :companyId', { companyId: user.companyId });
    }

    queryBuilder.orderBy('fence.createdAt', 'DESC');
    const activeFences = await queryBuilder.getMany();

    const enriched = await this.enrichFencesWithCoordinates(activeFences);
    return enriched.filter((fence) => this.pointInPolygon(point, fence.coordinates || []));
  }

  async update(id: string, updateFenceDto: UpdateFenceDto, user: UserContext): Promise<Fence> {
    const dto = this.normalizeDto(updateFenceDto);
    const { coordinates, ...rest } = dto;

    const fence = await this.findOne(id, user);

    if (this.isCompanyAdmin(user) && dto.companyId && dto.companyId !== user.companyId) {
      throw new ForbiddenException('无权修改围栏所属公司');
    }

    const updateData: any = { ...rest };

    let wkt: string | null = null;
    if (coordinates && coordinates.length >= 3) {
      wkt = GeoHelper.makePolygonWkt(coordinates);

      const lngs = coordinates.map((c) => c.lng);
      const lats = coordinates.map((c) => c.lat);
      updateData.centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
      updateData.centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      updateData.radius = 0;
    }

    const qb = this.fenceRepository
      .createQueryBuilder()
      .update(Fence)
      .set({
        ...updateData,
        ...(wkt && { geom: () => `ST_SetSRID(ST_GeomFromText(:wkt), 4326)` }),
      })
      .where('id = :id', { id });

    if (wkt) {
      qb.setParameter('wkt', wkt);
    }

    await qb.execute();
    return this.findOne(id, user);
  }

  async updateCoordinates(id: string, updateCoordinatesDto: UpdateFenceCoordinatesDto, user: UserContext): Promise<Fence> {
    const dto = this.normalizeDto(updateCoordinatesDto);
    const { coordinates } = dto;

    if (!coordinates || coordinates.length < 3) {
      throw new BadRequestException('围栏至少需要3个坐标点');
    }

    const fence = await this.fenceRepository.findOne({ where: { id } });
    if (!fence) {
      throw new NotFoundException(`围栏 ${id} 不存在`);
    }

    if (this.isCompanyAdmin(user) && fence.companyId !== user.companyId) {
      throw new ForbiddenException('无权修改该围栏');
    }

    const wkt = GeoHelper.makePolygonWkt(coordinates);

    const lngs = coordinates.map((c) => c.lng);
    const lats = coordinates.map((c) => c.lat);
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;

    await this.fenceRepository
      .createQueryBuilder()
      .update(Fence)
      .set({
        geom: () => `ST_SetSRID(ST_GeomFromText(:wkt), 4326)`,
        centerLng,
        centerLat,
        radius: 0,
      })
      .where('id = :id', { id })
      .setParameter('wkt', wkt)
      .execute();

    return this.findOne(id, user);
  }

  async remove(id: string, user: UserContext): Promise<void> {
    const fence = await this.findOne(id, user);
    await this.fenceRepository.remove(fence);
  }

  async toggleStatus(id: string, user: UserContext): Promise<Fence> {
    const fence = await this.findOne(id, user);
    const newStatus = fence.status === FenceStatus.ACTIVE ? FenceStatus.INACTIVE : FenceStatus.ACTIVE;
    await this.fenceRepository.update(id, { status: newStatus });
    return this.findOne(id, user);
  }

  async setStatus(id: string, enabled: boolean, user: UserContext): Promise<Fence> {
    const fence = await this.findOne(id, user);
    const newStatus = enabled ? FenceStatus.ACTIVE : FenceStatus.INACTIVE;
    await this.fenceRepository.update(id, { status: newStatus });
    return this.findOne(id, user);
  }
}
