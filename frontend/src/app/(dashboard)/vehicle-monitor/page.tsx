'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Tag,
  List,
  Space,
  Empty,
  message,
  Tooltip,
  Badge,
  Input,
} from 'antd';
import {
  ReloadOutlined,
  CarOutlined,
  ApiOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { io, Socket } from 'socket.io-client';
import { parseCookies } from 'nookies';
import dayjs from 'dayjs';
import { trackApi } from '@/services/api';
import { useAmap } from '@/hooks/useAmap';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

interface VehiclePosition {
  plateNumber: string;
  longitude: number;
  latitude: number;
  speed: number;
  direction: number;
  altitude?: number;
  accuracy?: number;
  timestamp: string;
  isDeviated?: boolean;
  deviationDistance?: number;
  transportOrderId?: string;
  companyId?: string;
  companyName?: string;
  vehicleType?: string;
  driverName?: string;
  driverPhone?: string;
  wasteType?: string;
  vehicleStatus?: string;
}

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  dump_truck: '厢式货车',
  mixer_truck: '罐式货车',
  flatbed: '自卸货车',
  container_truck: '冷藏车',
};

const COMPASS_DIRS = ['正北', '东北', '正东', '东南', '正南', '西南', '正西', '西北'];

interface MarkerEntry {
  marker: any;
  lastData: VehiclePosition;
  lastColor: string;
}

function escapeHtml(str: string): string {
  return String(str ?? '').replace(/[&<>"']/g, (ch) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return map[ch];
  });
}

function isOnline(timestamp: string): boolean {
  if (!timestamp) return false;
  return Date.now() - new Date(timestamp).getTime() < ONLINE_THRESHOLD_MS;
}

function getStatusInfo(v: VehiclePosition): { color: string; online: boolean; moving: boolean; label: string } {
  const online = isOnline(v.timestamp);
  const moving = online && (Number(v.speed) || 0) > 0;
  let color = '#8c8c8c';
  if (online) color = moving ? '#52c41a' : '#1677ff';
  if (v.isDeviated) color = '#ff4d4f';
  const label = v.isDeviated ? '偏离路线' : online ? (moving ? '移动中' : '在线静止') : '离线';
  return { color, online, moving, label };
}

function directionToCompass(dir: number): string {
  const idx = Math.round(((Number(dir) || 0) % 360) / 45) % 8;
  return COMPASS_DIRS[idx];
}

function vehicleTypeLabel(t?: string): string {
  if (!t) return '-';
  return VEHICLE_TYPE_LABELS[t] || t;
}

function buildMarkerContent(v: VehiclePosition, color: string): string {
  const plate = escapeHtml(v.plateNumber);
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;">
    <div style="background:${color};color:#fff;font-size:12px;font-weight:700;line-height:18px;padding:1px 8px;border-radius:9px;box-shadow:0 1px 4px rgba(0,0,0,0.45);white-space:nowrap;border:1px solid rgba(255,255,255,0.7);">${plate}</div>
    <div style="width:14px;height:14px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>
  </div>`;
}

function buildInfoHtml(v: VehiclePosition): string {
  const { color, label } = getStatusInfo(v);
  const compass = directionToCompass(v.direction);
  const time = v.timestamp ? dayjs(v.timestamp).format('YYYY-MM-DD HH:mm:ss') : '-';
  const rows = [
    ['车牌号', escapeHtml(v.plateNumber)],
    ['所属公司', escapeHtml(v.companyName || '-')],
    ['车辆状态', `<span style="color:${color};font-weight:600;">${label}</span>`],
    ['车速', `${Number(v.speed) || 0} km/h`],
    ['方向', `${compass}（${Number(v.direction) || 0}°）`],
    ['最后上报时间', time],
    ['车辆类型', escapeHtml(vehicleTypeLabel(v.vehicleType))],
    ['驾驶员', escapeHtml(v.driverName || '-')],
    ['联系电话', escapeHtml(v.driverPhone || '-')],
    ['废物类型', escapeHtml(v.wasteType || '-')],
  ];
  const rowsHtml = rows
    .map(
      ([k, val]) =>
        `<div style="display:flex;justify-content:space-between;gap:16px;padding:3px 0;font-size:13px;border-bottom:1px dashed #f0f0f0;">
          <span style="color:#888;">${k}</span>
          <span style="color:#333;text-align:right;">${val}</span>
        </div>`,
    )
    .join('');
  return `<div style="min-width:280px;max-width:340px;padding:4px 6px;">
    ${rowsHtml}
  </div>`;
}

export default function VehicleMonitorPage() {
  const { map, loaded, error } = useAmap('vehicle-monitor-map');
  const [vehicles, setVehicles] = useState<Record<string, VehiclePosition>>({});
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [selectedPlate, setSelectedPlate] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map());
  const infoWindowRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);
  const hasFitRef = useRef(false);

  useEffect(() => {
    mapInstanceRef.current = map;
  }, [map]);

  const fetchPositions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await trackApi.getMonitoringPositions();
      const list: VehiclePosition[] = res.data || [];
      const mapObj: Record<string, VehiclePosition> = {};
      list.forEach((v) => {
        if (v && v.plateNumber) mapObj[v.plateNumber] = v;
      });
      setVehicles(mapObj);
    } catch (err: any) {
      message.error(err.response?.data?.message || '获取车辆位置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const openInfo = useCallback((plate: string) => {
    const entry = markersRef.current.get(plate);
    const mapInstance = mapInstanceRef.current;
    if (!entry || !mapInstance) return;

    const data = entry.lastData;
    if (!infoWindowRef.current) {
      infoWindowRef.current = new window.AMap.InfoWindow({
        offset: new window.AMap.Pixel(0, -28),
        closeWhenClickMap: true,
      });
    }
    infoWindowRef.current.setContent(buildInfoHtml(data));
    const position = entry.marker.getPosition();
    infoWindowRef.current.open(mapInstance, position);
    mapInstance.setCenter(position);
    setSelectedPlate(plate);
  }, []);

  const syncMarkers = useCallback(() => {
    const mapInstance = mapInstanceRef.current;
    if (!mapInstance || !window.AMap) return;

    const currentPlates = Object.keys(vehicles);
    const seen = new Set<string>();

    currentPlates.forEach((plate) => {
      const v = vehicles[plate];
      seen.add(plate);
      const { color } = getStatusInfo(v);
      const existing = markersRef.current.get(plate);

      if (existing) {
        existing.marker.setPosition([Number(v.longitude), Number(v.latitude)]);
        existing.marker.setExtData(v);
        existing.lastData = v;
        if (existing.lastColor !== color) {
          existing.marker.setContent(buildMarkerContent(v, color));
          existing.lastColor = color;
        }
      } else {
        const marker = new window.AMap.Marker({
          position: [Number(v.longitude), Number(v.latitude)],
          content: buildMarkerContent(v, color),
          anchor: 'bottom-center',
          offset: new window.AMap.Pixel(0, -2),
          extData: v,
          zIndex: v.isDeviated ? 200 : 110,
        });
        marker.setMap(mapInstance);
        marker.on('click', () => openInfo(plate));
        markersRef.current.set(plate, { marker, lastData: v, lastColor: color });
      }
    });

    markersRef.current.forEach((entry, plate) => {
      if (!seen.has(plate)) {
        entry.marker.setMap(null);
        markersRef.current.delete(plate);
      }
    });

    if (!hasFitRef.current && currentPlates.length > 0) {
      const allMarkers = Array.from(markersRef.current.values()).map((e) => e.marker);
      if (allMarkers.length > 0) {
        mapInstance.setFitView(allMarkers, false, [80, 80, 80, 80]);
        hasFitRef.current = true;
      }
    }
  }, [vehicles, openInfo]);

  useEffect(() => {
    if (!loaded || !map) return;
    syncMarkers();
  }, [loaded, map, syncMarkers]);

  useEffect(() => {
    const cookies = parseCookies();
    const token = cookies['token'];
    if (!token) return;

    const socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect', () => setWsConnected(true));
    socket.on('disconnect', () => setWsConnected(false));
    socket.on('connect_error', () => setWsConnected(false));

    socket.on('vehicle:position', (data: VehiclePosition) => {
      if (!data || !data.plateNumber) return;
      setVehicles((prev) => ({
        ...prev,
        [data.plateNumber]: { ...prev[data.plateNumber], ...data },
      }));
    });

    return () => {
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const vehicleList = Object.values(vehicles)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .filter((v) => !filter || v.plateNumber.includes(filter) || (v.companyName || '').includes(filter));

  const onlineCount = Object.values(vehicles).filter((v) => isOnline(v.timestamp)).length;
  const movingCount = Object.values(vehicles).filter(
    (v) => isOnline(v.timestamp) && (Number(v.speed) || 0) > 0,
  ).length;
  const deviatedCount = Object.values(vehicles).filter((v) => v.isDeviated).length;

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <h2 style={{ margin: 0 }}>车辆监控</h2>
          <Badge
            status={wsConnected ? 'success' : 'default'}
            text={wsConnected ? '实时连接' : '未连接'}
            style={{ fontSize: 12 }}
          />
        </Space>
        <Space>
          <Tag color="green">在线 {onlineCount}</Tag>
          <Tag color="blue">移动中 {movingCount}</Tag>
          <Tag color="red">偏离 {deviatedCount}</Tag>
          <Tag>总计 {Object.keys(vehicles).length}</Tag>
          <Tooltip title="刷新位置">
            <a onClick={fetchPositions} style={{ fontSize: 18 }}>
              <ReloadOutlined spin={loading} />
            </a>
          </Tooltip>
        </Space>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={18}>
          <Card style={{ padding: 0 }} bodyStyle={{ padding: 0 }} loading={loading && Object.keys(vehicles).length === 0}>
            <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
              <div
                id="vehicle-monitor-map"
                style={{ height: 'calc(100vh - 220px)', minHeight: 520, width: '100%' }}
              />
              {error && (
                <div style={{ color: '#ff4d4f', padding: 16 }}>地图加载失败：{error}</div>
              )}
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  zIndex: 120,
                  background: 'rgba(255,255,255,0.92)',
                  padding: '6px 10px',
                  borderRadius: 6,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                  fontSize: 12,
                  pointerEvents: 'none',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>图例</div>
                <Space direction="vertical" size={2}>
                  <Space size={6}><span style={{ display: 'inline-block', width: 10, height: 10, background: '#52c41a', borderRadius: '50%' }} />在线移动</Space>
                  <Space size={6}><span style={{ display: 'inline-block', width: 10, height: 10, background: '#1677ff', borderRadius: '50%' }} />在线静止</Space>
                  <Space size={6}><span style={{ display: 'inline-block', width: 10, height: 10, background: '#ff4d4f', borderRadius: '50%' }} />偏离路线</Space>
                  <Space size={6}><span style={{ display: 'inline-block', width: 10, height: 10, background: '#8c8c8c', borderRadius: '50%' }} />离线</Space>
                </Space>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={6}>
          <Card
            title={
              <Space>
                <CarOutlined />
                <span>车辆列表</span>
              </Space>
            }
            style={{ height: 'calc(100vh - 220px)', minHeight: 520, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ padding: 8, overflowY: 'auto', flex: 1 }}
            extra={<ApiOutlined style={{ color: wsConnected ? '#52c41a' : '#bfbfbf' }} />}
          >
            <Input
              placeholder="搜索车牌/公司"
              allowClear
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            {vehicleList.length === 0 ? (
              <Empty description={loading ? '加载中...' : '暂无车辆位置'} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                size="small"
                dataSource={vehicleList}
                renderItem={(v) => {
                  const { color, label } = getStatusInfo(v);
                  return (
                    <List.Item
                      key={v.plateNumber}
                      onClick={() => openInfo(v.plateNumber)}
                      style={{
                        cursor: 'pointer',
                        padding: '8px 10px',
                        background: selectedPlate === v.plateNumber ? '#e6f4ff' : undefined,
                        borderRadius: 6,
                        marginBottom: 4,
                        border: '1px solid #f0f0f0',
                      }}
                    >
                      <div style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Space size={6}>
                            <span style={{ display: 'inline-block', width: 8, height: 8, background: color, borderRadius: '50%' }} />
                            <strong>{v.plateNumber}</strong>
                          </Space>
                          <Tag color={color} style={{ margin: 0, fontSize: 11 }}>{label}</Tag>
                        </div>
                        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                          <div><EnvironmentOutlined /> {v.companyName || '-'}</div>
                          <div>车速 {Number(v.speed) || 0} km/h · {directionToCompass(v.direction)}</div>
                          <div>{v.timestamp ? dayjs(v.timestamp).format('MM-DD HH:mm:ss') : '-'}</div>
                        </div>
                      </div>
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
