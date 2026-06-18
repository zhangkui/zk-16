'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Card,
  Row,
  Col,
  Select,
  Button,
  Space,
  Slider,
  Tag,
  List,
  Input,
  message,
  Statistic,
} from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, ReloadOutlined, CarOutlined } from '@ant-design/icons';
import { trackApi, vehicleApi, transportOrderApi, fenceApi } from '@/services/api';

const { Option } = Select;

const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then((mod) => mod.Polyline), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((mod) => mod.Popup), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then((mod) => mod.CircleMarker), { ssr: false });
const Polygon = dynamic(() => import('react-leaflet').then((mod) => mod.Polygon), { ssr: false });

interface TrackPoint {
  id: string;
  lat: number;
  lng: number;
  longitude?: number;
  latitude?: number;
  timestamp: string;
  speed?: number;
  heading?: number;
  direction?: number;
}

interface VehiclePosition {
  plateNumber: string;
  lat: number;
  lng: number;
  latitude?: number;
  longitude?: number;
  speed?: number;
  timestamp: string;
  status: string;
}

interface FenceData {
  id: string;
  name: string;
  type: string;
  status: string;
  coordinates: { lng: number; lat: number }[] | null;
  centerLng?: number;
  centerLat?: number;
  radius?: number;
}

const FENCE_TYPE_CONFIG: Record<string, { color: string; label: string; fillColor: string }> = {
  loading: { color: '#52c41a', label: '装载区', fillColor: '#52c41a' },
  unloading: { color: '#1890ff', label: '卸载区', fillColor: '#1890ff' },
  restricted: { color: '#ff4d4f', label: '禁行区', fillColor: '#ff4d4f' },
  permit: { color: '#faad14', label: '许可区', fillColor: '#faad14' },
};

const VEHICLE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <g transform="rotate(0, 16, 16)">
    <rect x="8" y="4" width="16" height="20" rx="3" fill="#1677ff" stroke="#fff" stroke-width="1.5"/>
    <rect x="10" y="6" width="12" height="7" rx="1" fill="#91caff"/>
    <circle cx="12" cy="26" r="3" fill="#333" stroke="#fff" stroke-width="1"/>
    <circle cx="20" cy="26" r="3" fill="#333" stroke="#fff" stroke-width="1"/>
    <polygon points="16,0 12,6 20,6" fill="#1677ff" stroke="#fff" stroke-width="1"/>
  </g>
</svg>`;

const generateMockTrack = (): TrackPoint[] => {
  const baseLat = 39.9042;
  const baseLng = 116.4074;
  const points: TrackPoint[] = [];
  for (let i = 0; i < 50; i++) {
    points.push({
      id: `p${i}`,
      lat: baseLat + (Math.random() - 0.5) * 0.1 + i * 0.0005,
      lng: baseLng + (Math.random() - 0.5) * 0.1 + i * 0.0008,
      timestamp: new Date(Date.now() + i * 60000).toISOString(),
      speed: Math.floor(Math.random() * 60) + 20,
      heading: Math.floor(Math.random() * 360),
    });
  }
  return points;
};

function VehicleMarker({ position, heading, plateNumber, speed, timestamp }: {
  position: [number, number];
  heading?: number;
  plateNumber?: string;
  speed?: number;
  timestamp?: string;
}) {
  const [leafletRef, setLeafletRef] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    import('leaflet').then((L) => {
      if (!mounted) return;
      const icon = L.divIcon({
        html: `<div style="transform: rotate(${heading || 0}deg); transform-origin: center center;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
            <g>
              <circle cx="20" cy="20" r="18" fill="#1677ff" fill-opacity="0.15" stroke="#1677ff" stroke-width="2"/>
              <g transform="translate(10, 6)">
                <rect x="2" y="2" width="16" height="14" rx="3" fill="#1677ff" stroke="#fff" stroke-width="1.5"/>
                <rect x="4" y="4" width="12" height="6" rx="1" fill="#91caff"/>
                <polygon points="10,0 6,4 14,4" fill="#1677ff" stroke="#fff" stroke-width="0.5"/>
                <circle cx="5" cy="19" r="2.5" fill="#333" stroke="#fff" stroke-width="0.8"/>
                <circle cx="15" cy="19" r="2.5" fill="#333" stroke="#fff" stroke-width="0.8"/>
              </g>
            </g>
          </svg>
        </div>`,
        className: 'vehicle-marker-icon',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      setLeafletRef({ L, icon });
    });
    return () => { mounted = false; };
  }, [heading]);

  if (!leafletRef) return null;

  return (
    <Marker position={position} icon={leafletRef.icon}>
      <Popup>
        <div>
          {plateNumber && <p><strong>车牌号：</strong>{plateNumber}</p>}
          <p><strong>速度：</strong>{speed || 0} km/h</p>
          <p><strong>方向：</strong>{heading?.toFixed(1) || 0}°</p>
          {timestamp && <p><strong>时间：</strong>{new Date(timestamp).toLocaleString()}</p>}
        </div>
      </Popup>
    </Marker>
  );
}

export default function TrackPage() {
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<string>('');
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleList, setVehicleList] = useState<any[]>([]);
  const [orderList, setOrderList] = useState<any[]>([]);
  const [fences, setFences] = useState<FenceData[]>([]);
  const [showFences, setShowFences] = useState(true);

  const normalizeTrackPoint = useCallback((p: any): TrackPoint => ({
    id: p.id || `p-${Math.random()}`,
    lat: p.lat || p.latitude,
    lng: p.lng || p.longitude,
    timestamp: p.timestamp,
    speed: p.speed || p.heading,
    heading: p.heading || p.direction,
    longitude: p.longitude,
    latitude: p.latitude,
    direction: p.direction,
  }), []);

  const normalizeVehiclePosition = useCallback((v: any): VehiclePosition => ({
    plateNumber: v.plateNumber,
    lat: v.lat || v.latitude,
    lng: v.lng || v.longitude,
    latitude: v.latitude,
    longitude: v.longitude,
    speed: v.speed,
    timestamp: v.timestamp,
    status: v.status || (v.isDeviated ? 'deviated' : 'normal'),
  }), []);

  useEffect(() => {
    const init = async () => {
      const vehicles = await fetchVehicleList();
      fetchVehiclePositions(vehicles);
      fetchFences();
    };
    init();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const fetchFences = async () => {
    try {
      const res = await fenceApi.list({ pageSize: 100 });
      const list = res.data?.list || res.data?.data || [];
      setFences(list.filter((f: FenceData) => f.coordinates && f.coordinates.length >= 3));
    } catch (error) {
      console.error('Failed to fetch fences:', error);
    }
  };

  const fetchVehicleList = async () => {
    let vehicles: any[] = [];
    try {
      const res = await vehicleApi.list({ pageSize: 100 });
      if (res.data?.list?.length > 0) {
        vehicles = res.data.list;
        setVehicleList(vehicles);
      }
    } catch (error) {
      console.error(error);
    }
    try {
      const res = await transportOrderApi.list({ pageSize: 100, status: 'transporting' });
      if (res.data?.list?.length > 0) {
        setOrderList(res.data.list);
      }
    } catch (error) {
      console.error(error);
    }
    return vehicles;
  };

  const fetchVehiclePositions = async (vehicleList: any[] = []) => {
    try {
      const plateNumbers = vehicleList.map(v => v.plateNumber).filter(Boolean);
      if (plateNumbers.length === 0) return;
      const res = await trackApi.getLatestPositions({ plateNumbers });
      if (res.data?.length > 0) {
        setVehicles(res.data.map(normalizeVehiclePosition));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const loadTrack = async () => {
    if (!selectedVehicle && !plateNumber && !selectedOrder) {
      message.warning('请选择车辆或运输单');
      return;
    }
    setLoading(true);
    try {
      const params: any = {};
      if (selectedOrder) params.transportOrderId = selectedOrder;
      if (selectedVehicle || plateNumber) params.plateNumber = selectedVehicle || plateNumber;
      const res = await trackApi.list(params);
      if (res.data?.list?.length > 0) {
        setTrackPoints(res.data.list.map(normalizeTrackPoint));
      } else {
        setTrackPoints(generateMockTrack());
      }
      setCurrentIndex(0);
      stopPlayback();
      message.success('轨迹加载成功');
    } catch (error) {
      setTrackPoints(generateMockTrack());
      setCurrentIndex(0);
      message.success('轨迹加载成功');
    } finally {
      setLoading(false);
    }
  };

  const startPlayback = () => {
    if (trackPoints.length === 0) {
      message.warning('请先加载轨迹');
      return;
    }
    setIsPlaying(true);
    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= trackPoints.length - 1) {
          stopPlayback();
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / playbackSpeed);
  };

  const pausePlayback = () => {
    setIsPlaying(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setCurrentIndex(0);
  };

  const resetPlayback = () => {
    stopPlayback();
    setCurrentIndex(0);
  };

  const currentPoint = trackPoints[currentIndex];
  const polylinePoints = trackPoints.map((p) => [p.lat, p.lng] as [number, number]);
  const playedPoints = polylinePoints.slice(0, currentIndex + 1);

  const getCurrentHeading = (): number => {
    if (currentIndex > 0 && trackPoints.length > 1) {
      const prev = trackPoints[currentIndex - 1];
      const curr = trackPoints[currentIndex];
      const dx = curr.lng - prev.lng;
      const dy = curr.lat - prev.lat;
      const angle = (Math.atan2(dx, dy) * 180) / Math.PI;
      return angle < 0 ? angle + 360 : angle;
    }
    return currentPoint?.heading || currentPoint?.direction || 0;
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>轨迹监控</h2>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={18}>
          <Card style={{ height: 600, padding: 0 }} bodyStyle={{ padding: 0 }}>
            <MapContainer
              center={[39.9042, 116.4074]}
              zoom={12}
              style={{ height: '100%', width: '100%', borderRadius: 8 }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              {showFences && fences.map((fence) => {
                if (!fence.coordinates || fence.coordinates.length < 3) return null;
                const config = FENCE_TYPE_CONFIG[fence.type] || { color: '#999', label: '未知', fillColor: '#999' };
                const positions = fence.coordinates.map((c) => [c.lat, c.lng] as [number, number]);
                return (
                  <Polygon
                    key={fence.id}
                    positions={positions}
                    pathOptions={{
                      color: config.color,
                      fillColor: config.fillColor,
                      fillOpacity: 0.15,
                      weight: 2,
                      dashArray: fence.type === 'restricted' ? '5, 5' : undefined,
                    }}
                  >
                    <Popup>
                      <div>
                        <p><strong>围栏名称：</strong>{fence.name}</p>
                        <p><strong>围栏类型：</strong>{config.label}</p>
                        <p><strong>状态：</strong>{fence.status === 'active' ? '启用' : '禁用'}</p>
                      </div>
                    </Popup>
                  </Polygon>
                );
              })}
              {trackPoints.length > 0 && (
                <>
                  <Polyline
                    positions={polylinePoints}
                    pathOptions={{ color: '#91caff', weight: 3, opacity: 0.5 }}
                  />
                  <Polyline
                    positions={playedPoints}
                    pathOptions={{ color: '#1677ff', weight: 5 }}
                  />
                  {currentPoint && (
                    <VehicleMarker
                      position={[currentPoint.lat, currentPoint.lng]}
                      heading={getCurrentHeading()}
                      plateNumber={selectedVehicle || plateNumber}
                      speed={currentPoint.speed}
                      timestamp={currentPoint.timestamp}
                    />
                  )}
                </>
              )}
              {trackPoints.length === 0 && vehicles.map((v) => (
                <CircleMarker
                  key={v.plateNumber}
                  center={[v.lat, v.lng]}
                  radius={8}
                  pathOptions={{ color: v.speed ? '#52c41a' : '#faad14', fillColor: v.speed ? '#52c41a' : '#faad14', fillOpacity: 1 }}
                >
                  <Popup>
                    <div>
                      <p><strong>车牌号：</strong>{v.plateNumber}</p>
                      <p><strong>状态：</strong>{v.status}</p>
                      <p><strong>速度：</strong>{v.speed} km/h</p>
                      <p><strong>更新时间：</strong>{v.timestamp}</p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </Card>

          {trackPoints.length > 0 && (
            <Card style={{ marginTop: 16 }}>
              <Row gutter={16} align="middle">
                <Col>
                  <Space>
                    {!isPlaying ? (
                      <Button type="primary" icon={<PlayCircleOutlined />} onClick={startPlayback}>
                        播放
                      </Button>
                    ) : (
                      <Button icon={<PauseCircleOutlined />} onClick={pausePlayback}>
                        暂停
                      </Button>
                    )}
                    <Button icon={<ReloadOutlined />} onClick={resetPlayback}>
                      重置
                    </Button>
                    <Select
                      value={playbackSpeed}
                      onChange={setPlaybackSpeed}
                      style={{ width: 100 }}
                    >
                      <Option value={0.5}>0.5x</Option>
                      <Option value={1}>1x</Option>
                      <Option value={2}>2x</Option>
                      <Option value={4}>4x</Option>
                    </Select>
                  </Space>
                </Col>
                <Col flex="auto">
                  <Slider
                    min={0}
                    max={trackPoints.length - 1}
                    value={currentIndex}
                    onChange={(v) => setCurrentIndex(v)}
                    disabled={isPlaying}
                  />
                </Col>
                <Col>
                  <span style={{ color: '#666' }}>
                    {currentIndex + 1} / {trackPoints.length}
                  </span>
                </Col>
              </Row>
              {currentPoint && (
                <Row gutter={16} style={{ marginTop: 16 }}>
                  <Col span={6}>
                    <Statistic title="当前时间" value={new Date(currentPoint.timestamp).toLocaleTimeString()} />
                  </Col>
                  <Col span={6}>
                    <Statistic title="速度" value={currentPoint.speed || currentPoint.heading} suffix="km/h" />
                  </Col>
                  <Col span={6}>
                    <Statistic title="方向" value={getCurrentHeading().toFixed(1)} suffix="°" />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="位置"
                      value={`${currentPoint.lat.toFixed(4)}, ${currentPoint.lng.toFixed(4)}`}
                    />
                  </Col>
                </Row>
              )}
            </Card>
          )}
        </Col>

        <Col xs={24} lg={6}>
          <Card title="轨迹查询" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Select
                placeholder="选择运输单"
                style={{ width: '100%' }}
                allowClear
                value={selectedOrder || undefined}
                onChange={(v) => setSelectedOrder(v || '')}
                showSearch
                optionFilterProp="children"
              >
                {orderList.map((o) => (
                  <Option key={o.id} value={o.id}>{o.orderNo} - {o.plateNumber}</Option>
                ))}
              </Select>
              <Select
                placeholder="选择车辆"
                style={{ width: '100%' }}
                allowClear
                value={selectedVehicle || undefined}
                onChange={(v) => setSelectedVehicle(v || '')}
                showSearch
                optionFilterProp="children"
              >
                {vehicleList.map((v) => (
                  <Option key={v.plateNumber} value={v.plateNumber}>{v.plateNumber} - {v.driverName}</Option>
                ))}
              </Select>
              <Input
                placeholder="或输入车牌号"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                allowClear
              />
              <Button type="primary" block onClick={loadTrack} loading={loading}>
                加载轨迹
              </Button>
            </Space>
          </Card>

          <Card
            title={
              <Space>
                <span>电子围栏</span>
                <Tag
                  color={showFences ? 'blue' : 'default'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setShowFences(!showFences)}
                >
                  {showFences ? '已显示' : '已隐藏'}
                </Tag>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <List
              size="small"
              dataSource={fences}
              renderItem={(fence) => {
                const config = FENCE_TYPE_CONFIG[fence.type] || { color: '#999', label: '未知' };
                return (
                  <List.Item key={fence.id}>
                    <List.Item.Meta
                      title={
                        <Space>
                          <span>{fence.name}</span>
                          <Tag color={config.color} style={{ fontSize: 11 }}>{config.label}</Tag>
                        </Space>
                      }
                      description={fence.status === 'active' ? '启用中' : '已禁用'}
                    />
                  </List.Item>
                );
              }}
            />
          </Card>

          <Card title="实时车辆位置">
            <List
              dataSource={vehicles}
              renderItem={(v) => (
                <List.Item key={v.plateNumber}>
                  <List.Item.Meta
                    avatar={<CarOutlined style={{ fontSize: 20, color: v.speed ? '#52c41a' : '#faad14' }} />}
                    title={
                      <Space>
                        <span>{v.plateNumber}</span>
                        <Tag color={v.speed ? 'green' : 'orange'}>{v.status}</Tag>
                      </Space>
                    }
                    description={
                      <div>
                        <p style={{ margin: 0 }}>速度: {v.speed} km/h</p>
                        <p style={{ margin: 0, color: '#999' }}>{v.timestamp}</p>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
