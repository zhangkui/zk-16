'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  message,
  Popconfirm,
  Switch,
  Row,
  Col,
  InputNumber,
  List,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { fenceApi } from '@/services/api';

const { Option } = Select;

const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Polygon = dynamic(() => import('react-leaflet').then((mod) => mod.Polygon), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then((mod) => mod.Circle), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((mod) => mod.Popup), { ssr: false });

interface Fence {
  id: string;
  name: string;
  type: 'polygon' | 'circle';
  fenceType: 'loading' | 'unloading' | 'forbidden' | 'storage';
  coordinates?: any;
  radius?: number;
  center?: [number, number];
  enabled: boolean;
  description?: string;
  createdAt: string;
}

const mockFences: Fence[] = [
  {
    id: '1',
    name: '北京化工厂装载区',
    type: 'polygon',
    fenceType: 'loading',
    coordinates: [
      [39.9042, 116.4074],
      [39.9142, 116.4074],
      [39.9142, 116.4174],
      [39.9042, 116.4174],
    ],
    enabled: true,
    description: '危废物装载作业区',
    createdAt: '2024-01-15 10:30:00',
  },
  {
    id: '2',
    name: '危险废物处置中心',
    type: 'polygon',
    fenceType: 'unloading',
    coordinates: [
      [39.8842, 116.3874],
      [39.8942, 116.3874],
      [39.8942, 116.3974],
      [39.8842, 116.3974],
    ],
    enabled: true,
    description: '危废物卸载处置区',
    createdAt: '2024-01-16 14:20:00',
  },
  {
    id: '3',
    name: '禁行区域-市中心',
    type: 'circle',
    fenceType: 'forbidden',
    center: [39.9042, 116.4074],
    radius: 5000,
    enabled: true,
    description: '市中心禁止通行区域',
    createdAt: '2024-01-17 09:15:00',
  },
  {
    id: '4',
    name: '临时存储区',
    type: 'polygon',
    fenceType: 'storage',
    coordinates: [
      [39.9242, 116.4274],
      [39.9342, 116.4274],
      [39.9342, 116.4374],
      [39.9242, 116.4374],
    ],
    enabled: false,
    description: '临时危废物存储区',
    createdAt: '2024-01-18 16:45:00',
  },
];

const fenceTypeMap = {
  loading: { color: 'blue', text: '装载区' },
  unloading: { color: 'green', text: '卸载区' },
  forbidden: { color: 'red', text: '禁行区' },
  storage: { color: 'orange', text: '存储区' },
};

export default function FencesPage() {
  const [fences, setFences] = useState<Fence[]>(mockFences);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const [editingFence, setEditingFence] = useState<Fence | null>(null);
  const [selectedFence, setSelectedFence] = useState<Fence | null>(null);
  const [form] = Form.useForm();
  const [points, setPoints] = useState<[number, number][]>([]);
  const [center, setCenter] = useState<[number, number]>([39.9042, 116.4074]);
  const [radius, setRadius] = useState(1000);

  useEffect(() => {
    fetchFences();
  }, []);

  const fetchFences = async () => {
    setLoading(true);
    try {
      const res = await fenceApi.list({ pageSize: 100 });
      if (res.data?.list?.length > 0) {
        setFences(res.data.list);
      }
    } catch (error) {
      console.error('Failed to fetch fences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingFence(null);
    form.resetFields();
    setPoints([]);
    setRadius(1000);
    setModalVisible(true);
  };

  const handleEdit = (record: Fence) => {
    setEditingFence(record);
    form.setFieldsValue({
      name: record.name,
      fenceType: record.fenceType,
      type: record.type,
      description: record.description,
    });
    if (record.type === 'polygon') {
      setPoints(record.coordinates);
    } else {
      setCenter(record.center!);
      setRadius(record.radius!);
    }
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await fenceApi.remove(id);
      setFences(fences.filter((f) => f.id !== id));
      message.success('删除成功');
    } catch (error) {
      setFences(fences.filter((f) => f.id !== id));
      message.success('删除成功');
    }
  };

  const handleToggleStatus = async (record: Fence) => {
    try {
      await fenceApi.toggleStatus(record.id, { enabled: !record.enabled });
      setFences(fences.map((f) => (f.id === record.id ? { ...f, enabled: !f.enabled } : f)));
      message.success(record.enabled ? '已禁用' : '已启用');
    } catch (error) {
      setFences(fences.map((f) => (f.id === record.id ? { ...f, enabled: !f.enabled } : f)));
      message.success(record.enabled ? '已禁用' : '已启用');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const fenceData = {
        ...values,
        enabled: true,
        type: values.type,
        coordinates: values.type === 'polygon' ? points : null,
        center: values.type === 'circle' ? center : null,
        radius: values.type === 'circle' ? radius : null,
      };

      if (editingFence) {
        await fenceApi.update(editingFence.id, fenceData);
        setFences(fences.map((f) => (f.id === editingFence.id ? { ...f, ...fenceData } : f)));
        message.success('更新成功');
      } else {
        const res = await fenceApi.create(fenceData);
        const newFence = {
          ...fenceData,
          id: res.data?.id || Date.now().toString(),
          createdAt: new Date().toISOString(),
        };
        setFences([newFence, ...fences]);
        message.success('创建成功');
      }
      setModalVisible(false);
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(editingFence ? '更新失败' : '创建失败');
    }
  };

  const getFenceColor = (fenceType: Fence['fenceType']) => {
    const colorMap = {
      loading: '#1677ff',
      unloading: '#52c41a',
      forbidden: '#ff4d4f',
      storage: '#faad14',
    };
    return colorMap[fenceType];
  };

  const columns = [
    { title: '围栏名称', dataIndex: 'name', key: 'name', width: 200 },
    {
      title: '围栏类型',
      dataIndex: 'fenceType',
      key: 'fenceType',
      width: 100,
      render: (type: Fence['fenceType']) => {
        const { color, text } = fenceTypeMap[type];
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '形状',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: Fence['type']) => (type === 'polygon' ? '多边形' : '圆形'),
    },
    { title: '描述', dataIndex: 'description', key: 'description' },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (enabled: boolean, record: Fence) => (
        <Switch checked={enabled} onChange={() => handleToggleStatus(record)} />
      ),
    },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: Fence) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EnvironmentOutlined />}
            onClick={() => setSelectedFence(record)}
          >
            查看
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除该围栏吗？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>电子围栏管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增围栏
        </Button>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <div style={{ background: '#fff', borderRadius: 8, height: 600, padding: 16 }}>
            <div style={{ height: '100%' }}>
              <MapContainer
                center={[39.9042, 116.4074]}
                zoom={12}
                style={{ height: '100%', width: '100%', borderRadius: 4 }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                {(selectedFence ? [selectedFence] : fences).map((fence) => (
                  fence.type === 'polygon' ? (
                    <Polygon
                      key={fence.id}
                      positions={fence.coordinates}
                      pathOptions={{ color: getFenceColor(fence.fenceType), fillColor: getFenceColor(fence.fenceType), fillOpacity: 0.2 }}
                    >
                      <Popup>
                        <div>
                          <strong>{fence.name}</strong>
                          <p>{fence.description}</p>
                        </div>
                      </Popup>
                    </Polygon>
                  ) : (
                    <Circle
                      key={fence.id}
                      center={fence.center!}
                      radius={fence.radius}
                      pathOptions={{ color: getFenceColor(fence.fenceType), fillColor: getFenceColor(fence.fenceType), fillOpacity: 0.2 }}
                    >
                      <Popup>
                        <div>
                          <strong>{fence.name}</strong>
                          <p>{fence.description}</p>
                          <p>半径: {fence.radius}米</p>
                        </div>
                      </Popup>
                    </Circle>
                  )
                ))}
              </MapContainer>
            </div>
          </div>
        </Col>
        <Col xs={24} lg={10}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>围栏列表</h3>
            <List
              dataSource={fences}
              renderItem={(fence) => (
                <List.Item
                  key={fence.id}
                  onClick={() => setSelectedFence(fence)}
                  style={{ cursor: 'pointer', borderRadius: 4, padding: '8px 12px', marginBottom: 8, background: selectedFence?.id === fence.id ? '#e6f4ff' : 'transparent' }}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <span>{fence.name}</span>
                        <Tag color={fenceTypeMap[fence.fenceType].color}>
                          {fenceTypeMap[fence.fenceType].text}
                        </Tag>
                        {fence.enabled ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>}
                      </Space>
                    }
                    description={fence.description || '暂无描述'}
                  />
                </List.Item>
              )}
            />
          </div>
        </Col>
      </Row>

      <Modal
        title={editingFence ? '编辑围栏' : '新增围栏'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="围栏名称" rules={[{ required: true, message: '请输入围栏名称' }]}>
                <Input placeholder="请输入围栏名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="fenceType" label="围栏类型" rules={[{ required: true, message: '请选择围栏类型' }]}>
                <Select placeholder="请选择围栏类型">
                  <Option value="loading">装载区</Option>
                  <Option value="unloading">卸载区</Option>
                  <Option value="forbidden">禁行区</Option>
                  <Option value="storage">存储区</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="type" label="围栏形状" rules={[{ required: true, message: '请选择围栏形状' }]}>
            <Select placeholder="请选择围栏形状">
              <Option value="polygon">多边形</Option>
              <Option value="circle">圆形</Option>
            </Select>
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.type !== cur.type}
          >
            {({ getFieldValue }) => {
              const type = getFieldValue('type');
              if (type === 'circle') {
                return (
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label="圆心经度">
                        <InputNumber
                          style={{ width: '100%' }}
                          value={center[1]}
                          onChange={(v) => setCenter([center[0], v || 0])}
                          step={0.0001}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="圆心纬度">
                        <InputNumber
                          style={{ width: '100%' }}
                          value={center[0]}
                          onChange={(v) => setCenter([v || 0, center[1]])}
                          step={0.0001}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item label="半径(米)">
                        <InputNumber
                          style={{ width: '100%' }}
                          value={radius}
                          onChange={(v) => setRadius(v || 1000)}
                          min={100}
                          step={100}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                );
              }
              return (
                <Form.Item label="多边形顶点坐标">
                  <div>
                    <Input.TextArea
                      rows={4}
                      value={points.map((p) => p.join(',')).join('\n')}
                      placeholder="每行一个坐标点，格式：纬度,经度"
                      onChange={(e) => {
                        const lines = e.target.value.split('\n').filter(Boolean);
                        const newPoints = lines
                          .map((line) => {
                            const [lat, lng] = line.split(',').map(Number);
                            return [lat, lng] as [number, number];
                          })
                          .filter((p) => !isNaN(p[0]) && !isNaN(p[1]));
                        setPoints(newPoints);
                      }}
                    />
                    <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                      当前点数：{points.length}
                    </div>
                  </div>
                </Form.Item>
              );
            }}
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="请输入围栏描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
