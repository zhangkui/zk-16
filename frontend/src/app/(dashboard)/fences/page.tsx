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
  AutoComplete,
  Tooltip,
  Card,
  Drawer,
  Steps,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  UndoOutlined,
  ReloadOutlined,
  CheckOutlined,
  CloseOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { fenceApi, simulationApi, companyApi } from '@/services/api';
import { useAuthStore } from '@/store/auth';

const { Option } = Select;
const { Step } = Steps;

interface Fence {
  id: string;
  name: string;
  fenceType: string;
  coordinates?: { lng: number; lat: number }[] | null;
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

interface Company {
  id: string;
  name: string;
}

export default function FencesPage() {
  const { user } = useAuthStore();
  const [fences, setFences] = useState<Fence[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFence, setSelectedFence] = useState<Fence | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [form] = Form.useForm();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'add' | 'edit'>('add');
  const [editingFence, setEditingFence] = useState<Fence | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const isCompanyAdmin = user?.role === 'company_super_admin' || user?.role === 'company_admin';
  const isAdmin = user?.role === 'admin';

  const [polygonPoints, setPolygonPoints] = useState<{ lng: number; lat: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchOptions, setSearchOptions] = useState<SearchResult[]>([]);
  const [simulationRunning, setSimulationRunning] = useState(false);

  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const tempPolygonRef = useRef<any>(null);
  const tempMarkersRef = useRef<any[]>([]);
  const fenceOverlaysRef = useRef<Map<string, any>>(new Map());
  const placeSearchRef = useRef<any>(null);
  const isDrawingRef = useRef(false);
  const polygonPointsRef = useRef<{ lng: number; lat: number }[]>([]);

  useEffect(() => {
    isDrawingRef.current = isDrawing;
  }, [isDrawing]);

  useEffect(() => {
    polygonPointsRef.current = polygonPoints;
  }, [polygonPoints]);

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
          if (isDrawingRef.current) {
            const newPoint = { lng: e.lnglat.getLng(), lat: e.lnglat.getLat() };
            const newPoints = [...polygonPointsRef.current, newPoint];
            setPolygonPoints(newPoints);
            updateTempPolygon(newPoints);
          }
        });

        fetchFences();
        fetchSimulationStatus();
        if (isAdmin) {
          fetchCompanies();
        }
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
  }, []);

  useEffect(() => {
    if (mapRef.current) {
      renderFencesOnMap();
    }
  }, [fences, selectedFence]);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setDefaultCursor(isDrawing ? 'crosshair' : 'default');
    }
  }, [isDrawing]);

  const fetchFences = async () => {
    setLoading(true);
    try {
      const res: any = await fenceApi.list({ pageSize: 100 });
      const fenceList = res.data?.list || res.data?.data || [];
      const normalizedFences = fenceList.map((f: any) => ({
        ...f,
        fenceType: f.fenceType || f.type,
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

  const fetchCompanies = async () => {
    setCompaniesLoading(true);
    try {
      const res = await companyApi.list({ pageSize: 1000 });
      const list = res.data?.list || res.data?.data || [];
      setCompanies(list);
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    } finally {
      setCompaniesLoading(false);
    }
  };

  const renderFencesOnMap = () => {
    if (!mapRef.current) return;

    fenceOverlaysRef.current.forEach((overlay) => {
      mapRef.current.remove(overlay);
    });
    fenceOverlaysRef.current.clear();

    const fencesToRender = selectedFence ? fences.filter((f) => f.id === selectedFence.id) : fences;

    fencesToRender.forEach((fence) => {
      const color = fenceColorMap[fence.fenceType] || '#1677ff';
      
      if (fence.coordinates && fence.coordinates.length >= 3) {
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
      }
    });

    if (selectedFence && selectedFence.coordinates && selectedFence.coordinates.length >= 3) {
      const lats = selectedFence.coordinates.map((p) => p.lat);
      const lngs = selectedFence.coordinates.map((p) => p.lng);
      const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
      mapRef.current.setCenter([centerLng, centerLat]);
      mapRef.current.setZoom(14);
    }
  };

  const clearTempOverlays = () => {
    if (!mapRef.current) return;
    
    if (tempPolygonRef.current) {
      mapRef.current.remove(tempPolygonRef.current);
      tempPolygonRef.current = null;
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
    if (isCompanyAdmin) {
      form.setFieldsValue({
        companyId: user?.companyId || '',
      });
    }
    setPolygonPoints([]);
    setIsDrawing(false);
    clearTempOverlays();
    setCurrentStep(0);
    setDrawerVisible(true);
  };

  const handleEdit = (record: Fence) => {
    setDrawerMode('edit');
    setEditingFence(record);
    form.setFieldsValue({
      name: record.name,
      fenceType: record.fenceType,
      description: record.remark || record.description || '',
      companyId: (record as any).companyId,
    });
    setPolygonPoints([]);
    setIsDrawing(false);
    clearTempOverlays();
    setCurrentStep(0);
    setDrawerVisible(true);
  };

  const handleSetScope = (record: Fence) => {
    setDrawerVisible(false);
    setEditingFence(record);
    setPolygonPoints(record.coordinates ? [...record.coordinates] : []);
    setIsDrawing(true);
    
    if (record.coordinates && record.coordinates.length > 0 && mapRef.current) {
      updateTempPolygon(record.coordinates);
      const lats = record.coordinates.map((p) => p.lat);
      const lngs = record.coordinates.map((p) => p.lng);
      const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
      mapRef.current.setCenter([centerLng, centerLat]);
      mapRef.current.setZoom(14);
    }
    
    message.info('请在地图上点击添加顶点，绘制围栏范围');
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

  const handleSaveBaseInfo = async () => {
    try {
      const values = await form.validateFields();
      const fenceData: any = {
        ...values,
      };

      let savedFence: any;

      if (editingFence) {
        await fenceApi.update(editingFence.id, fenceData);
        const res: any = await fenceApi.get(editingFence.id);
        savedFence = res.data?.data || res.data;
        message.success('基础信息更新成功');
      } else {
        const res: any = await fenceApi.create(fenceData);
        savedFence = res.data?.data || res.data;
        message.success('基础信息保存成功');
      }

      setEditingFence(savedFence);
      setCurrentStep(1);
      setDrawerVisible(false);
      setIsDrawing(true);
      
      fetchFences();
      
      const existingCoords = savedFence.coordinates || savedFence.geometry?.coordinates?.[0]?.map(
        (c: number[]) => ({ lng: c[0], lat: c[1] })
      ) || [];
      
      if (existingCoords && existingCoords.length >= 3) {
        setPolygonPoints(existingCoords);
        updateTempPolygon(existingCoords);
        const lats = existingCoords.map((p: { lat: number }) => p.lat);
        const lngs = existingCoords.map((p: { lng: number }) => p.lng);
        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
        if (mapRef.current) {
          mapRef.current.setCenter([centerLng, centerLat]);
          mapRef.current.setZoom(14);
        }
        message.info('围栏范围已加载，可在地图上调整');
      } else {
        setPolygonPoints([]);
        clearTempOverlays();
        message.info('请在地图上点击添加顶点，绘制围栏范围');
      }
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(editingFence ? '更新失败' : '创建失败');
    }
  };

  const handleSaveCoordinates = async () => {
    if (!editingFence) {
      message.error('请先保存基础信息');
      return;
    }

    if (polygonPoints.length < 3) {
      message.error('围栏至少需要3个顶点');
      return;
    }

    try {
      await fenceApi.updateCoordinates(editingFence.id, {
        coordinates: polygonPoints,
      });
      message.success('围栏范围保存成功');
      
      setIsDrawing(false);
      clearTempOverlays();
      fetchFences();
      setEditingFence(null);
      setPolygonPoints([]);
      setCurrentStep(0);
    } catch (error) {
      message.error('保存围栏范围失败');
    }
  };

  const handleCancelDrawing = () => {
    setIsDrawing(false);
    clearTempOverlays();
    setPolygonPoints([]);
    setEditingFence(null);
    setCurrentStep(0);
  };

  const toggleDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
    } else {
      setIsDrawing(true);
      setPolygonPoints([]);
      clearTempOverlays();
      message.info('请在地图上点击添加顶点，至少3个点');
    }
  };

  const clearDrawing = () => {
    setPolygonPoints([]);
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
  };

  const hasCoordinates = selectedFence?.coordinates && selectedFence.coordinates.length >= 3;

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

      {isDrawing && editingFence && (
        <Card
          style={{ marginBottom: 16, borderRadius: 8 }}
          bodyStyle={{ padding: 12 }}
          title={
            <Space>
              <span>正在设置围栏范围：</span>
              <Tag color="blue">{editingFence.name}</Tag>
              <span style={{ color: '#999', fontSize: 13 }}>
                已添加 <strong style={{ color: '#1677ff' }}>{polygonPoints.length}</strong> 个顶点
              </span>
            </Space>
          }
          extra={
            <Space>
              <Button icon={<UndoOutlined />} onClick={undoLastPoint} disabled={polygonPoints.length === 0}>
                撤销
              </Button>
              <Button icon={<ReloadOutlined />} onClick={clearDrawing} disabled={polygonPoints.length === 0}>
                清除
              </Button>
              <Button onClick={handleCancelDrawing} icon={<CloseOutlined />}>
                取消
              </Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={handleSaveCoordinates}
                disabled={polygonPoints.length < 3}
              >
                保存范围
              </Button>
            </Space>
          }
        >
          <div style={{ color: '#666', fontSize: 13 }}>
            💡 在左侧地图上点击依次添加顶点，至少需要3个点形成封闭区域
          </div>
        </Card>
      )}

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
              renderItem={(fence) => {
                const hasCoords = fence.coordinates && fence.coordinates.length >= 3;
                return (
                  <List.Item
                    key={fence.id}
                    onClick={() => {
                      setSelectedFence(fence);
                      if (mapRef.current && hasCoords) {
                        const lats = fence.coordinates!.map((p) => p.lat);
                        const lngs = fence.coordinates!.map((p) => p.lng);
                        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
                        const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
                        mapRef.current.setCenter([centerLng, centerLat]);
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
                          {!hasCoords && <Tag color="orange">未设置范围</Tag>}
                        </Space>
                      }
                      description={
                        <div>
                          <div style={{ marginBottom: 4 }}>
                            {hasCoords ? `${fence.coordinates?.length}个顶点` : '尚未设置围栏范围'}
                          </div>
                          {fence.address && (
                            <div style={{ color: '#999', fontSize: 12 }}>{fence.address}</div>
                          )}
                        </div>
                      }
                    />
                    <Space size="small" direction="vertical" align="end">
                      <Space size="small">
                        <Button
                          type="link"
                          size="small"
                          icon={<SettingOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetScope(fence);
                          }}
                        >
                          设置范围
                        </Button>
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
                      </Space>
                      <Space size="small">
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
                    </Space>
                  </List.Item>
                );
              }}
            />
          </Card>
        </Col>
      </Row>

      <Drawer
        title={drawerMode === 'add' ? '新增围栏 - 基础信息' : '编辑围栏 - 基础信息'}
        width={480}
        open={drawerVisible}
        onClose={handleCloseDrawer}
        mask={false}
        maskClosable={false}
        placement="right"
        footer={
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={handleCloseDrawer}>取消</Button>
              <Button type="primary" icon={<CheckOutlined />} onClick={handleSaveBaseInfo}>
                下一步：设置范围
              </Button>
            </Space>
          </div>
        }
      >
        <Steps current={currentStep} size="small" style={{ marginBottom: 24 }}>
          <Step title="基础信息" />
          <Step title="设置范围" />
        </Steps>

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

          {isAdmin && (
            <Form.Item
              name="companyId"
              label="所属公司"
              rules={[{ required: true, message: '请选择所属公司' }]}
            >
              <Select
                placeholder="请选择所属公司"
                loading={companiesLoading}
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                }
              >
                {companies.map((c) => (
                  <Option key={c.id} value={c.id}>
                    {c.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item name="description" label="备注描述">
            <Input.TextArea rows={3} placeholder="请输入围栏备注信息" maxLength={500} />
          </Form.Item>

          <div
            style={{
              padding: '12px 16px',
              background: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: 6,
              color: '#389e0d',
              fontSize: 13,
            }}
          >
            💡 保存基础信息后，下一步将在地图上绘制围栏范围
          </div>
        </Form>
      </Drawer>
    </div>
  );
}
