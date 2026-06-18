'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
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
  Switch,
} from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, ReloadOutlined, CarOutlined } from '@ant-design/icons';
import { trackApi, vehicleApi, transportOrderApi, fenceApi } from '@/services/api';

const { Option } = Select;

declare global {
  interface Window {
    AMap: any;
    _AMapSecurityConfig: any;
  }
}

const AMAP_KEY = process.env.NEXT_PUBLIC_AMAP_KEY || '';
const AMAP_SECURITY_CODE = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE || '';

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
  fenceType?: string;
  type?: string;
  status?: string;
  enabled?: boolean;
  coordinates?: { lng: number; lat: number }[] | null;
}

const FENCE_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  loading: { color: '#52c41a', label: '装载区' },
  unloading: { color: '#1890ff', label: '卸载区' },
  restricted: { color: '#ff4d4f', label: '禁行区' },
  forbidden: { color: '#ff4d4f', label: '禁行区' },
  permit: { color: '#faad14', label: '许可区' },
  storage: { color: '#faad14', label: '存储区' },
};

const buildVehicleIcon = (heading: number) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44" height="44">
    <circle cx="22" cy="22" r="20" fill="#1677ff" fill-opacity="0.15" stroke="#1677ff" stroke-width="2"/>
    <g transform="rotate(${heading}, 22, 22)">
      <g transform="translate(11, 7)">
        <polygon points="11,0 7,5 15,5" fill="#1677ff" stroke="#fff" stroke-width="0.5"/>
        <rect x="2" y="5" width="18" height="16" rx="3" fill="#1677ff" stroke="#fff" stroke-width="1.5"/>
        <rect x="4" y="7" width="14" height="6" rx="1" fill="#91caff"/>
        <circle cx="5" cy="22" r="2.8" fill="#333" stroke="#fff" stroke-width="0.8"/>
        <circle cx="17" cy="22" r="2.8" fill="#333" stroke="#fff" stroke-width="0.8"/>
      </g>
    </g>
  </svg>`;
  return svg;
};

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

export default function TrackPage() {
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<string>('');
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleList, setVehicleList] = useState<any[]>([]);
  const [orderList, setOrderList] = useState<any[]>([]);
  const [fences, setFences] = useState<FenceData[]>([]);
  const [showFences, setShowFences] = useState(true);

  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const fenceOverlaysRef = useRef<Map<string, any>>(new Map());
  const trackLineRef = useRef<any>(null);
  const playedLineRef = useRef<any>(null);
  const vehicleMarkerRef = useRef<any>(null);
  const realtimeMarkersRef = useRef<any[]>([]);
  const amapLoadedRef = useRef(false);

  const normalizeTrackPoint = useCallback((p: any): TrackPoint => ({
    id: p.id || `p-${Math.random()}`,
    lat: p.lat || p.latitude,
    lng: p.lng || p.longitude,
    timestamp: p.timestamp,
    speed: p.speed,
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

  const loadAmap = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      if (window.AMap) {
        amapLoadedRef.current = true;
        resolve();
        return;
      }
      window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_CODE };
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.ToolBar,AMap.Scale`;
      script.onload = () => {
        amapLoadedRef.current = true;
        resolve();
      };
      script.onerror = () => reject(new Error('高德地图加载失败'));
      document.head.appendChild(script);
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        await loadAmap();
        if (!mounted || !mapContainerRef.current) return;
        const map = new window.AMap.Map('track-map-container', {
          zoom: 12,
          center: [116.4074, 39.9042],
          mapStyle: 'amap://styles/normal',
        });
        map.addControl(new window.AMap.ToolBar({ position: 'RB' }));
        map.addControl(new window.AMap.Scale({ position: 'LB' }));
        mapRef.current = map;

        const vlist = await fetchVehicleList();
        fetchVehiclePositions(vlist);
        fetchFences();
      } catch (error: any) {
        message.error('地图加载失败: ' + error.message);
      }
    };
    init();
    return () => {
      mounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, []);

  const fetchFences = async () => {
    try {
      const res = await fenceApi.list({ pageSize: 100 });
      const list = res.data?.list || res.data?.data || [];
      const normalized = list.map((f: any) => ({
        ...f,
        fenceType: f.fenceType || f.type,
        enabled: f.status === 'active' || f.enabled,
      }));
      setFences(normalized.filter((f: FenceData) => f.coordinates && f.coordinates.length >= 3));
    } catch (error) {
      console.error('Failed to fetch fences:', error);
    }
  };

  const fetchVehicleList = async () => {
    let vlist: any[] = [];
    try {
      const res = await vehicleApi.list({ pageSize: 100 });
      if (res.data?.list?.length > 0) {
        vlist = res.data.list;
        setVehicleList(vlist);
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
    return vlist;
  };

  const fetchVehiclePositions = async (vlist: any[] = []) => {
    try {
      const plateNumbers = vlist.map((v) => v.plateNumber).filter(Boolean);
      if (plateNumbers.length === 0) return;
      const res = await trackApi.getLatestPositions({ plateNumbers });
      if (res.data?.length > 0) {
        setVehicles(res.data.map(normalizeVehiclePosition));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const renderFencesOnMap = useCallback(() => {
    if (!mapRef.current) return;
    fenceOverlaysRef.current.forEach((overlay) => mapRef.current.remove(overlay));
    fenceOverlaysRef.current.clear();
    if (!showFences) return;
    fences.forEach((fence) => {
      const fType = fence.fenceType || fence.type || '';
      const config = FENCE_TYPE_CONFIG[fType] || { color: '#999', label: '未知' };
      if (fence.coordinates && fence.coordinates.length >= 3) {
        const path = fence.coordinates.map((p) => [p.lng, p.lat]);
        const polygon = new window.AMap.Polygon({
          path,
          strokeColor: config.color,
          strokeWeight: 2,
          strokeOpacity: 0.8,
          strokeDasharray: fType === 'restricted' || fType === 'forbidden' ? [5, 5] : undefined,
          fillColor: config.color,
          fillOpacity: 0.15,
          cursor: 'pointer',
          extData: fence,
        });
        polygon.setMap(mapRef.current);
        polygon.on('click', () => {
          mapRef.current.setFitView([polygon]);
        });
        fenceOverlaysRef.current.set(fence.id, polygon);
      }
    });
  }, [fences, showFences]);

  useEffect(() => {
    renderFencesOnMap();
  }, [renderFencesOnMap]);

  const getCurrentHeading = useCallback((): number => {
    if (currentIndex > 0 && trackPoints.length > 1) {
      const prev = trackPoints[currentIndex - 1];
      const curr = trackPoints[currentIndex];
      const dx = curr.lng - prev.lng;
      const dy = curr.lat - prev.lat;
      const angle = (Math.atan2(dx, dy) * 180) / Math.PI;
      return angle < 0 ? angle + 360 : angle;
    }
    return trackPoints[currentIndex]?.heading || trackPoints[currentIndex]?.direction || 0;
  }, [currentIndex, trackPoints]);

  const renderTrackOnMap = useCallback(() => {
    if (!mapRef.current) return;
    if (trackLineRef.current) {
      mapRef.current.remove(trackLineRef.current);
      trackLineRef.current = null;
    }
    if (playedLineRef.current) {
      mapRef.current.remove(playedLineRef.current);
      playedLineRef.current = null;
    }
    if (vehicleMarkerRef.current) {
      mapRef.current.remove(vehicleMarkerRef.current);
      vehicleMarkerRef.current = null;
    }
    realtimeMarkersRef.current.forEach((m) => m.setMap(null));
    realtimeMarkersRef.current = [];

    if (trackPoints.length === 0) {
      vehicles.forEach((v) => {
        const color = v.speed ? '#52c41a' : '#faad14';
        const marker = new window.AMap.Marker({
          position: [v.lng, v.lat],
          offset: new window.AMap.Pixel(-8, -8),
          content: `<div style="width:16px;height:16px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 0 4px rgba(0,0,0,0.4);"></div>`,
        });
        marker.setMap(mapRef.current);
        const info = new window.AMap.InfoWindow({
          content: `<div style="padding:6px;"><p><strong>车牌号：</strong>${v.plateNumber}</p><p><strong>状态：</strong>${v.status}</p><p><strong>速度：</strong>${v.speed || 0} km/h</p><p><strong>更新时间：</strong>${v.timestamp}</p></div>`,
          offset: new window.AMap.Pixel(0, -12),
        });
        marker.on('click', () => info.open(mapRef.current, marker.getPosition()));
        realtimeMarkersRef.current.push(marker);
      });
      return;
    }

    const fullPath = trackPoints.map((p) => [p.lng, p.lat]);
    trackLineRef.current = new window.AMap.Polyline({
      path: fullPath,
      strokeColor: '#91caff',
      strokeWeight: 4,
      strokeOpacity: 0.6,
      strokeStyle: 'dashed',
      lineJoin: 'round',
    });
    trackLineRef.current.setMap(mapRef.current);

    const playedPath = trackPoints.slice(0, currentIndex + 1).map((p) => [p.lng, p.lat]);
    if (playedPath.length >= 1) {
      playedLineRef.current = new window.AMap.Polyline({
        path: playedPath,
        strokeColor: '#1677ff',
        strokeWeight: 6,
        strokeOpacity: 1,
        lineJoin: 'round',
        showDir: true,
      });
      playedLineRef.current.setMap(mapRef.current);
    }

    const currentPoint = trackPoints[currentIndex];
    if (currentPoint) {
      const heading = getCurrentHeading();
      vehicleMarkerRef.current = new window.AMap.Marker({
        position: [currentPoint.lng, currentPoint.lat],
        offset: new window.AMap.Pixel(-22, -22),
        content: buildVehicleIcon(heading),
        anchor: 'center',
      });
      vehicleMarkerRef.current.setMap(mapRef.current);

      const infoContent = `<div style="padding:6px;min-width:160px;">
        ${selectedVehicle || plateNumber ? `<p style="margin:2px 0;"><strong>车牌号：</strong>${selectedVehicle || plateNumber}</p>` : ''}
        <p style="margin:2px 0;"><strong>速度：</strong>${currentPoint.speed || 0} km/h</p>
        <p style="margin:2px 0;"><strong>方向：</strong>${heading.toFixed(1)}°</p>
        <p style="margin:2px 0;"><strong>时间：</strong>${new Date(currentPoint.timestamp).toLocaleString()}</p>
      </div>`;
      const infoWindow = new window.AMap.InfoWindow({
        content: infoContent,
        offset: new window.AMap.Pixel(0, -26),
      });
      vehicleMarkerRef.current.on('click', () => {
        infoWindow.open(mapRef.current, vehicleMarkerRef.current.getPosition());
      });
    }

    if (currentIndex === 0 || playedPath.length === fullPath.length) {
      mapRef.current.setFitView([trackLineRef.current], false, [60, 60, 60, 60]);
    }
  }, [trackPoints, currentIndex, vehicles, getCurrentHeading, selectedVehicle, plateNumber]);

  useEffect(() => {
    renderTrackOnMap();
  }, [renderTrackOnMap]);

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
  };

  const resetPlayback = () => {
    stopPlayback();
    setCurrentIndex(0);
  };

  const currentPoint = trackPoints[currentIndex];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>轨迹监控</h2>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={18}>
          <Card style={{ height: 600, padding: 0 }} bodyStyle={{ padding: 0 }}>
            <div
              id="track-map-container"
              ref={mapContainerRef}
              style={{ height: 600, width: '100%', borderRadius: 8 }}
            />
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
                    <Statistic title="速度" value={currentPoint.speed || 0} suffix="km/h" />
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
                <Switch size="small" checked={showFences} onChange={setShowFences} />
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <List
              size="small"
              dataSource={fences}
              renderItem={(fence) => {
                const fType = fence.fenceType || fence.type || '';
                const config = FENCE_TYPE_CONFIG[fType] || { color: '#999', label: '未知' };
                return (
                  <List.Item key={fence.id}>
                    <List.Item.Meta
                      title={
                        <Space>
                          <span>{fence.name}</span>
                          <Tag color={config.color} style={{ fontSize: 11 }}>{config.label}</Tag>
                        </Space>
                      }
                      description={fence.enabled ? '启用中' : '已禁用'}
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
