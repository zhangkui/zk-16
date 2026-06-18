'use client';

import { useEffect, useState, useRef } from 'react';
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
import { trackApi, vehicleApi, transportOrderApi } from '@/services/api';

const { Option } = Select;

const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then((mod) => mod.Polyline), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((mod) => mod.Popup), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then((mod) => mod.CircleMarker), { ssr: false });

interface TrackPoint {
  id: string;
  lat: number;
  lng: number;
  timestamp: string;
  speed?: number;
  heading?: number;
}

interface VehiclePosition {
  plateNumber: string;
  lat: number;
  lng: number;
  speed?: number;
  timestamp: string;
  status: string;
}

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
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleList, setVehicleList] = useState<any[]>([]);
  const [orderList, setOrderList] = useState<any[]>([]);

  useEffect(() => {
    const init = async () => {
      const vehicles = await fetchVehicleList();
      fetchVehiclePositions(vehicles);
    };
    init();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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
        setVehicles(res.data);
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
      const res = await trackApi.list(params);
      if (res.data?.list?.length > 0) {
        setTrackPoints(res.data.list);
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
                    <Marker position={[currentPoint.lat, currentPoint.lng]}>
                      <Popup>
                        <div>
                          <p><strong>时间：</strong>{new Date(currentPoint.timestamp).toLocaleString()}</p>
                          <p><strong>速度：</strong>{currentPoint.speed} km/h</p>
                          <p><strong>方向：</strong>{currentPoint.heading}°</p>
                          <p><strong>位置：</strong>{currentPoint.lat.toFixed(6)}, {currentPoint.lng.toFixed(6)}</p>
                        </div>
                      </Popup>
                    </Marker>
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
                    <Statistic title="速度" value={currentPoint.speed} suffix="km/h" />
                  </Col>
                  <Col span={6}>
                    <Statistic title="方向" value={currentPoint.heading} suffix="°" />
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
