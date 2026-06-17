export class GeoHelper {
  static makePoint(lng: number, lat: number, srid: number = 4326): string {
    const wkt = `POINT(${lng} ${lat})`;
    return `ST_SetSRID(ST_GeomFromText('${wkt}'), ${srid})`;
  }

  static makePointWkt(lng: number, lat: number): string {
    return `POINT(${lng} ${lat})`;
  }

  static makeCircle(lng: number, lat: number, radius: number, srid: number = 4326): string {
    const wkt = `POINT(${lng} ${lat})`;
    return `ST_Buffer(ST_SetSRID(ST_GeomFromText('${wkt}'), ${srid})::geography, ${radius})::geometry`;
  }

  static makePolygon(coordinates: { lng: number; lat: number }[], srid: number = 4326): string {
    const wkt = this.makePolygonWkt(coordinates);
    return `ST_SetSRID(ST_GeomFromText('${wkt}'), ${srid})`;
  }

  static makePolygonWkt(coordinates: { lng: number; lat: number }[]): string {
    if (coordinates.length < 3) {
      throw new Error('多边形至少需要3个坐标点');
    }
    const ring = [...coordinates, coordinates[0]];
    const points = ring.map((c) => `${c.lng} ${c.lat}`).join(', ');
    return `POLYGON((${points}))`;
  }

  static pointSql(srid: number = 4326): string {
    return `ST_SetSRID(ST_GeomFromText(:wkt), ${srid})`;
  }

  static polygonSql(srid: number = 4326): string {
    return `ST_SetSRID(ST_GeomFromText(:wkt), ${srid})`;
  }

  static asGeoJson(column: string): string {
    return `ST_AsGeoJSON(${column})`;
  }

  static contains(geomColumn: string, lng: number, lat: number, srid: number = 4326): string {
    return `ST_Contains(${geomColumn}, ST_SetSRID(ST_MakePoint(:lng, :lat), ${srid})) = true`;
  }

  static containsSelect(geomColumn: string, alias: string, srid: number = 4326): string {
    return `ST_Contains(${geomColumn}, ST_SetSRID(ST_MakePoint(:lng, :lat), ${srid})) AS ${alias}`;
  }

  static distance(geomColumn: string, lng: number, lat: number, srid: number = 4326): string {
    return `ST_Distance(${geomColumn}::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), ${srid})::geography)`;
  }
}
