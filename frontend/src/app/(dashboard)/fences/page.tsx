'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Button,
  Space,
  Form,
  Input,
  Select,
  Tag,
  message,
  Popconfirm,
  Switch,
  Row,
  Col,
  List,
  InputNumber,
  AutoComplete,
  Tooltip,
  Card,
  Drawer,
  Radio,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  UndoOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { fenceApi, simulationApi } from '@/services/api';

const { Option } = Select;

interface Fence {
  id: string;
  name: string;
  type: 'polygon' | 'circle';
  fenceType: string;
  coordinates?: { lng: number; lat: number }[];
  radius?: number;
  centerLng?: number;
  centerLat?: number;
  status?: string;
  enabled?: boolean;
  remark?: string;
  description?: string;
  address?: string;
  createdAt: string;
}

interface SearchResult {
  name: string;
  address: string;
  location: { lng: number; lat: number };
}

declare global {
  interface Window {
    AMap: any;
    _AMapSecurityConfig: any;
  }
}

const AMAP_KEY = process.env.NEXT_PUBLIC_AMAP_KEY || '';
const AMAP_SECURITY_CODE = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE || '';

const fenceTypeMap: Record<string, { color: string; text: string }> = {
  loading: { color: 'blue', text: '装载区' },
  unloading: { color: 'green', text: '卸载区' },
  restricted: { color: 'red', text: '禁行区' },
  forbidden: { color: 'red', text: '禁行区' },
  permit: { color: 'orange', text: '许可区' },
  storage: { color: 'orange', text: '存储区' },
};

const fenceColorMap: Record<string, string> = {
  loading: '#1677ff',
  unloading: '#52c41a',
  restricted: '#ff4d4f',
  forbidden: '#ff4d4f',
  permit: '#faad14',
  storage: '#faad14',
};

export default function FencesPage() {
  const [fences, setFences] = useState<Fence[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFence, setSelectedFence] = useState<Fence | null>(null);
  const [form] = Form.useForm();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'add' | 'edit'>('add');
  const [editingFence, setEditingFence] = useState<Fence | null>(null);

  const [shapeType, setShapeType] = useState<'polygon' | 'circle'>('polygon');
  const [polygonPoints, setPolygonPoints] = useState<{ lng: number; lat: number }[]>([]);
  const [circleCenter, setCircleCenter] = useState<{ lng: number; lat: number }>({ lng: 116.4074, lat: 39.9042 });
  const [circleRadius, setCircleRadius] = useState(500);

  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchOptions, setSearchOptions] = useState<SearchResult[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [simulationRunning, setSimulationRunning] = useState(false);

  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const tempPolygonRef = useRef<any>(null);
  const tempCircleRef = useRef<any>(null);
  const tempMarkersRef = useRef<any[]>([]);
  const fenceOverlaysRef = useRef<Map<string, any>>(new Map());
  const placeSearchRef = useRef<any>(null);

  const loadAmap = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      if (window.AMap) {
        resolve();
        return;
      }

      window._AMapSecurityConfig = {
        securityJsCode: AMAP_SECURITY_CODE,
      };

      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.PlaceSearch,AMap.Geocoder,AMap.ToolBar,AMap.Scale,AMap.MouseTool`;
      
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('高德地图加载失败'));

      document.head.appendChild(script);
    });
  }, []);

  const fetchSimulationStatus = useCallback(async () => {
    try {
      const res: any = await simulationApi.status();
      setSimulationRunning(res.running || false);
    } catch (error) {
      console.error('获取模拟状态失败:', error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await loadAmap();
        if (!mounted || !mapContainerRef.current) return;

        const map = new window.AMap.Map('fence-map-container', {
          zoom: 12,
          center: [116.4074, 39.9042],
          mapStyle: 'amap://styles/normal',
        });

        map.addControl(new window.AMap.ToolBar({ position: 'RB' }));
        map.addControl(new window.AMap.Scale({ position: 'LB' }));

        mapRef.current = map;

        placeSearchRef.current = new window.AMap.PlaceSearch({
          pageSize: 10,
          pageIndex: 1,
          city: '全国',
          extensions: 'base',
        });

        map.on('click', (e: any) => {
          if (isDrawing && shapeType === 'polygon') {
            const newPoint = { lng: e.lnglat.getLng(), lat: e.lnglat.getLat() };
            const newPoints = [...polygonPoints, newPoint];
            setPolygonPoints(newPoints);
            updateTempPolygon(newPoints);
          }
        });

        fetchFences();
        fetchSimulationStatus();
      } catch (error: any) {
        message.error('地图加载失败: ' + error.message);
      }
    };

    init();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [fetchSimulationStatus]);

  useEffect(() => {
    if (mapRef.current && fences.length > 0) {
      renderFencesOnMap();
    }
  }, [fences]);

  useEffect(() => {
    if (isDrawing && shapeType === 'circle' && mapRef.current) {
      mapRef.current.setDefaultCursor('crosshair');
    } else if (mapRef.current) {
      mapRef.current.setDefaultCursor('default');
    }
  }, [isDrawing, shapeType]);

  const fetchFences = async () => {
    setLoading(true);
    try {
      const res: any = await fenceApi.list({ pageSize: 100 });
      const fenceList = res.data?.list || res.data?.data || [];
      const normalizedFences = fenceList.map((f: any) => ({
        ...f,
        fenceType: f.fenceType || f.type,
        type: f.radius > 0 ? 'circle' : 'polygon',
        enabled: f.status === 'active' || f.enabled,
      }));
      setFences(normalizedFences);
    } catch (error) {
      console.error('Failed to fetch fences:', error);
      message.error('获取围栏列表失败');
    } finally {
      setLoading(false);
    }
  };

  const renderFencesOnMap = () => {
    if (!mapRef.current) return;

    fenceOverlaysRef.current.forEach((overlay) => {
      mapRef.current.remove(overlay);
    });
    fenceOverlaysRef.current.clear();

    fences.forEach((fence) => {
      const color = fenceColorMap[fence.fenceType] || '#1677ff';
      
      if (fence.type === 'polygon' && fence.coordinates && fence.coordinates.length >= 3) {
        const path = fence.coordinates.map((p) => [p.lng, p.lat]);
        const polygon = new window.AMap.Polygon({
          path,
          strokeColor: color,
          strokeWeight: 2,
          fillColor: color,
          fillOpacity: 0.25,
          cursor: 'pointer',
          extData: fence,
        });
        polygon.setMap(mapRef.current);
        polygon.on('click', () => setSelectedFence(fence));
        fenceOverlaysRef.current.set(fence.id, polygon);
      } else if (fence.type === 'circle' && fence.centerLng && fence.centerLat) {
        const circle = new window.AMap.Circle({
          center: [fence.centerLng, fence.centerLat],
          radius: fence.radius || 500,
          strokeColor: color,
          strokeWeight: 2,
          fillColor: color,
          fillOpacity: 0.25,
          cursor: 'pointer',
          extData: fence,
        });
        circle.setMap(mapRef.current);
        circle.on('click', () => setSelectedFence(fence));
        fenceOverlaysRef.current.set(fence.id, circle);
      }
    });
  };

  const clearTempOverlays = () => {
    if (!mapRef.current) return;
    
    if (tempPolygonRef.current) {
      mapRef.current.remove(tempPolygonRef.current);
      tempPolygonRef.current = null;
    }
    if (tempCircleRef.current) {
      mapRef.current.remove(tempCircleRef.current);
      tempCircleRef.current = null;
    }
    tempMarkersRef.current.forEach((m) => m.setMap(null));
    tempMarkersRef.current = [];
  };

  const updateTempPolygon = (points: { lng: number; lat: number }[]) => {
    if (!mapRef.current) return;

    clearTempOverlays();

    if (points.length >= 3) {
      const path = points.map((p) => [p.lng, p.lat]);
      tempPolygonRef.current = new window.AMap.Polygon({
        path,
        strokeColor: '#1677ff',
        strokeWeight: 2,
        fillColor: '#1677ff',
        fillOpacity: 0.3,
      });
      tempPolygonRef.current.setMap(mapRef.current);
    } else if (points.length > 0) {
      const path = points.map((p) => [p.lng, p.lat]);
      const polyline = new window.AMap.Polyline({
        path,
        strokeColor: '#1677ff',
        strokeWeight: 2,
        strokeDasharray: [5, 5],
      });
      polyline.setMap(mapRef.current);
      tempPolygonRef.current = polyline;
    }

    points.forEach((p, index) => {
      const marker = new window.AMap.Marker({
        position: [p.lng, p.lat],
        offset: new window.AMap.Pixel(-8, -8),
        content: `<div style="width:16px;height:16px;background:#1677ff;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:bold;">${index + 1}</div>`,
      });
      marker.setMap(mapRef.current);
      tempMarkersRef.current.push(marker);
    });
  };

  const updateTempCircle = (center: { lng: number; lat: number }, radius: number) => {
    if (!mapRef.current) return;

    clearTempOverlays();

    tempCircleRef.current = new window.AMap.Circle({
      center: [center.lng, center.lat],
      radius,
      strokeColor: '#1677ff',
      strokeWeight: 2,
      fillColor: '#1677ff',
      fillOpacity: 0.3,
    });
    tempCircleRef.current.setMap(mapRef.current);

    const marker = new window.AMap.Marker({
      position: [center.lng, center.lat],
      offset: new window.AMap.Pixel(-8, -8),
      content: `<div style="width:16px;height:16px;background:#1677ff;border:2px solid #fff;border-radius:50%;"></div>`,
    });
    marker.setMap(mapRef.current);
    tempMarkersRef.current.push(marker);
  };

  const handleSearch = (keyword: string) => {
    setSearchKeyword(keyword);
    if (!keyword || !placeSearchRef.current) {
      setSearchOptions([]);
      return;
    }

    placeSearchRef.current.search(keyword, (status: string, result: any) => {
      if (status === 'complete' && result.poiList) {
        const options = result.poiList.pois.map((poi: any) => ({
          name: poi.name,
          address: poi.address,
          location: {
            lng: poi.location.lng,
            lat: poi.location.lat,
          },
        }));
        setSearchOptions(options);
      } else {
        setSearchOptions([]);
      }
    });
  };

  const handleSelectPlace = (place: SearchResult) => {
    if (!mapRef.current) return;
    
    mapRef.current.setCenter([place.location.lng, place.location.lat]);
    mapRef.current.setZoom(16);
    setSearchKeyword(place.name);
  };

  const handleAdd = () => {
    setDrawerMode('add');
    setEditingFence(null);
    form.resetFields();
    setPolygonPoints([]);
    setCircleCenter({ lng: 116.4074, lat: 39.9042 });
    setCircleRadius(500);
    setShapeType('polygon');
    setIsDrawing(false);
    clearTempOverlays();
    setDrawerVisible(true);
  };

  const handleEdit = (record: Fence) => {
    setDrawerMode('edit');
    setEditingFence(record);
    form.setFieldsValue({
      name: record.name,
      fenceType: record.fenceType,
      description: record.remark || record.description || '',
    });
    setShapeType(record.type);
    
    if (record.type === 'polygon' && record.coordinates) {
      setPolygonPoints(record.coordinates);
      updateTempPolygon(record.coordinates);
    } else {
      const center = { lng: record.centerLng || 116.4074, lat: record.centerLat || 39.9042 };
      setCircleCenter(center);
      setCircleRadius(record.radius || 500);
      updateTempCircle(center, record.radius || 500);
    }
    
    setIsDrawing(false);
    setDrawerVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await fenceApi.remove(id);
      setFences(fences.filter((f) => f.id !== id));
      if (selectedFence?.id === id) {
        setSelectedFence(null);
      }
      message.success('删除成功');
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleToggleStatus = async (record: Fence) => {
    try {
      await fenceApi.toggleStatus(record.id, { enabled: !record.enabled });
      setFences(fences.map((f) => (f.id === record.id ? { ...f, enabled: !f.enabled } : f)));
      message.success(record.enabled ? '已禁用' : '已启用');
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      let fenceData: any = {
        ...values,
        type: shapeType,
      };

      if (shapeType === 'polygon') {
        if (polygonPoints.length < 3) {
          message.error('多边形围栏至少需要3个顶点');
          return;
        }
        fenceData.coordinates = polygonPoints;
      } else {
        fenceData.centerLng = circleCenter.lng;
        fenceData.centerLat = circleCenter.lat;
        fenceData.radius = circleRadius;
      }

      if (editingFence) {
        await fenceApi.update(editingFence.id, fenceData);
        message.success('更新成功');
      } else {
        await fenceApi.create(fenceData);
        message.success('创建成功');
      }

      setDrawerVisible(false);
      setIsDrawing(false);
      clearTempOverlays();
      fetchFences();
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(editingFence ? '更新失败' : '创建失败');
    }
  };

  const toggleDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
    } else {
      if (shapeType === 'polygon') {
        setIsDrawing(true);
        setPolygonPoints([]);
        clearTempOverlays();
        message.info('请在地图上点击添加顶点，至少3个点');
      } else {
        setIsDrawing(true);
        message.info('请在地图上点击设置圆心位置');
      }
    }
  };

  const handleMapClickForCircle = (e: any) => {
    if (isDrawing && shapeType === 'circle') {
      const center = { lng: e.lnglat.getLng(), lat: e.lnglat.getLat() };
      setCircleCenter(center);
      updateTempCircle(center, circleRadius);
      setIsDrawing(false);
      message.success('圆心位置已设置，可在右侧调整半径');
    }
  };

  useEffect(() => {
    if (!mapRef.current) return;
    
    const handler = (e: any) => handleMapClickForCircle(e);
    
    if (isDrawing && shapeType === 'circle') {
      mapRef.current.on('click', handler);
    }
    
    return () => {
      if (mapRef.current) {
        mapRef.current.off('click', handler);
      }
    };
  }, [isDrawing, shapeType, circleRadius]);

  const clearDrawing = () => {
    if (shapeType === 'polygon') {
      setPolygonPoints([]);
    } else {
      setCircleCenter({ lng: 116.4074, lat: 39.9042 });
      setCircleRadius(500);
    }
    clearTempOverlays();
  };

  const undoLastPoint = () => {
    if (polygonPoints.length > 0) {
      const newPoints = polygonPoints.slice(0, -1);
      setPolygonPoints(newPoints);
      updateTempPolygon(newPoints);
    }
  };

  const handleSimulationToggle = async () => {
    try {
      if (simulationRunning) {
        await simulationApi.stop();
        setSimulationRunning(false);
        message.success('模拟已停止');
      } else {
        await simulationApi.start();
        setSimulationRunning(true);
        message.success('模拟已启动');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setIsDrawing(false);
    clearTempOverlays();
  };

  const handleRadiusChange = (value: number) => {
    setCircleRadius(value || 500);
    if (tempCircleRef.current || shapeType === 'circle') {
      updateTempCircle(circleCenter, value || 500);
    }
  };

  const handleCenterLngChange = (value: number) => {
    const newCenter = { ...circleCenter, lng: value || 0 };
    setCircleCenter(newCenter);
    if (shapeType === 'circle') {
      updateTempCircle(newCenter, circleRadius);
    }
  };

  const handleCenterLatChange = (value: number) => {
    const newCenter = { ...circleCenter, lat: value || 0 };
    setCircleCenter(newCenter);
    if (shapeType === 'circle') {
      updateTempCircle(newCenter, circleRadius);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>电子围栏管理</h2>
        <Space>
          <Tooltip title={simulationRunning ? '停止模拟数据' : '启动模拟数据'}>
            <Button
              type={simulationRunning ? 'default' : 'primary'}
              danger={simulationRunning}
              icon={simulationRunning ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={handleSimulationToggle}
            >
              {simulationRunning ? '模拟进行中' : '启动模拟'}
            </Button>
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增围栏
          </Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Card
            style={{ borderRadius: 8 }}
            bodyStyle={{ padding: 12 }}
            title={
              <AutoComplete
                style={{ width: '100%', maxWidth: 400 }}
                placeholder="搜索地点，快速定位..."
                value={searchKeyword}
                onChange={handleSearch}
                options={searchOptions.map((opt) => ({
                  value: opt.name,
                  label: (
                    <div>
                      <div style={{ fontWeight: 500 }}>{opt.name}</div>
                      <div style={{ fontSize: 12, color: '#999' }}>{opt.address}</div>
                    </div>
                  ),
                }))}
                onSelect={(value: string) => {
                  const place = searchOptions.find((p) => p.name === value);
                  if (place) handleSelectPlace(place);
                }}
                allowClear
                suffixIcon={<SearchOutlined />}
              />
            }
          >
            <div
              id="fence-map-container"
              ref={mapContainerRef}
              style={{ height: 560, width: '100%', borderRadius: 4 }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="围栏列表" style={{ borderRadius: 8 }} bodyStyle={{ padding: 12 }}>
            <List
              dataSource={fences}
              loading={loading}
              style={{ maxHeight: 520, overflowY: 'auto' }}
              renderItem={(fence) => (
                <List.Item
                  key={fence.id}
                  onClick={() => {
                    setSelectedFence(fence);
                    if (mapRef.current) {
                      if (fence.type === 'polygon' && fence.coordinates && fence.coordinates.length > 0) {
                        const lats = fence.coordinates.map((p) => p.lat);
                        const lngs = fence.coordinates.map((p) => p.lng);
                        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
                        const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
                        mapRef.current.setCenter([centerLng, centerLat]);
                      } else if (fence.centerLng && fence.centerLat) {
                        mapRef.current.setCenter([fence.centerLng, fence.centerLat]);
                      }
                      mapRef.current.setZoom(14);
                    }
                  }}
                  style={{
                    cursor: 'pointer',
                    borderRadius: 6,
                    padding: '10px 12px',
                    marginBottom: 8,
                    background: selectedFence?.id === fence.id ? '#e6f4ff' : '#fafafa',
                    border: selectedFence?.id === fence.id ? '1px solid #91caff' : '1px solid #f0f0f0',
                  }}
                >
                  <List.Item.Meta
                    title={
                      <Space wrap>
                        <span style={{ fontWeight: 500 }}>{fence.name}</span>
                        <Tag color={fenceTypeMap[fence.fenceType]?.color || 'blue'}>
                          {fenceTypeMap[fence.fenceType]?.text || '未知'}
                        </Tag>
                        <Tag color={fence.enabled ? 'green' : 'default'}>
                          {fence.enabled ? '启用' : '禁用'}
                        </Tag>
                      </Space>
                    }
                    description={
                      <div>
                        <div style={{ marginBottom: 4 }}>
                          {fence.type === 'polygon' ? '多边形' : '圆形'}
                          {fence.type === 'polygon' 
                            ? ` · ${fence.coordinates?.length || 0}个顶点` 
                            : ` · 半径${fence.radius}米`}
                        </div>
                        {fence.address && (
                          <div style={{ color: '#999', fontSize: 12 }}>{fence.address}</div>
                        )}
                      </div>
                    }
                  />
                  <Space size="small">
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(fence);
                      }}
                    >
                      编辑
                    </Button>
                    <Popconfirm
                      title="确定删除该围栏吗？"
                      onConfirm={(e) => {
                        e?.stopPropagation();
                        handleDelete(fence.id);
                      }}
                    >
                      <Button
                        type="link"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()}
                      >
                        删除
                      </Button>
                    </Popconfirm>
                    <Switch
                      size="small"
                      checked={fence.enabled}
                      onChange={(checked, e) => {
                        e.stopPropagation();
                        handleToggleStatus(fence);
                      }}
                    />
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Drawer
        title={drawerMode === 'add' ? '新增围栏' : '编辑围栏'}
        width={520}
        open={drawerVisible}
        onClose={handleCloseDrawer}
        mask={false}
        maskClosable={false}
        placement="right"
        footer={
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={handleCloseDrawer}>取消</Button>
              <Button type="primary" icon={<CheckOutlined />} onClick={handleSubmit}>
                保存
              </Button>
            </Space>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="围栏名称"
            rules={[{ required: true, message: '请输入围栏名称' }]}
          >
            <Input placeholder="请输入围栏名称" maxLength={100} />
          </Form.Item>

          <Form.Item
            name="fenceType"
            label="围栏类型"
            rules={[{ required: true, message: '请选择围栏类型' }]}
          >
            <Select placeholder="请选择围栏类型">
              <Option value="loading">装载区</Option>
              <Option value="unloading">卸载区</Option>
              <Option value="restricted">禁行区</Option>
              <Option value="permit">许可区</Option>
              <Option value="storage">存储区</Option>
            </Select>
          </Form.Item>

          <Form.Item label="围栏形状">
            <Radio.Group
              value={shapeType}
              onChange={(e) => {
                setShapeType(e.target.value);
                setIsDrawing(false);
                clearTempOverlays();
                if (e.target.value === 'circle') {
                  setPolygonPoints([]);
                }
              }}
            >
              <Radio value="polygon">多边形</Radio>
              <Radio value="circle">圆形</Radio>
            </Radio.Group>
          </Form.Item>

          {shapeType === 'polygon' ? (
            <div>
              <Form.Item label="绘制多边形">
                <Space wrap>
                  <Button
                    type={isDrawing ? 'primary' : 'default'}
                    icon={isDrawing ? <CloseOutlined /> : <PlusOutlined />}
                    onClick={toggleDrawing}
                  >
                    {isDrawing ? '取消绘制' : '开始绘制'}
                  </Button>
                  <Button
                    icon={<UndoOutlined />}
                    onClick={undoLastPoint}
                    disabled={polygonPoints.length === 0}
                  >
                    撤销
                  </Button>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={clearDrawing}
                    disabled={polygonPoints.length === 0}
                  >
                    清除
                  </Button>
                  <span style={{ color: '#999' }}>
                    已添加 <strong>{polygonPoints.length}</strong> 个顶点
                  </span>
                </Space>
              </Form.Item>
              <div style={{ color: '#999', fontSize: 13, marginBottom: 16, padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
                点击"开始绘制"后，在左侧地图上依次点击添加顶点，至少需要3个点
              </div>
            </div>
          ) : (
            <div>
              <Form.Item label="设置圆形">
                <Button
                  type={isDrawing ? 'primary' : 'default'}
                  icon={isDrawing ? <CloseOutlined /> : <PlusOutlined />}
                  onClick={toggleDrawing}
                >
                  {isDrawing ? '取消选点' : '在地图上选圆心'}
                </Button>
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="圆心经度">
                    <InputNumber
                      style={{ width: '100%' }}
                      value={circleCenter.lng}
                      onChange={handleCenterLngChange}
                      step={0.0001}
                      precision={6}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="圆心纬度">
                    <InputNumber
                      style={{ width: '100%' }}
                      value={circleCenter.lat}
                      onChange={handleCenterLatChange}
                      step={0.0001}
                      precision={6}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label="半径 (米)">
                <InputNumber
                  style={{ width: '100%' }}
                  value={circleRadius}
                  onChange={handleRadiusChange}
                  min={10}
                  max={50000}
                  step={100}
                  addonAfter="米"
                />
              </Form.Item>
            </div>
          )}

          <Form.Item name="description" label="备注描述">
            <Input.TextArea rows={3} placeholder="请输入围栏备注信息" maxLength={500} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
