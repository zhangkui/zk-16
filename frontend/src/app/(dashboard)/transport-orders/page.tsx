'use client';

import { useEffect, useState } from 'react';
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
  DatePicker,
  InputNumber,
  Descriptions,
  Row,
  Col,
  Badge,
} from 'antd';
import { PlusOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { transportOrderApi } from '@/services/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

interface TransportOrder {
  id: string;
  orderNo: string;
  plateNumber: string;
  driverName: string;
  wasteType: string;
  weight: number;
  loadingAddress: string;
  unloadingAddress: string;
  loadingTime?: string;
  unloadingTime?: string;
  expectedStartTime: string;
  expectedEndTime: string;
  status: 'pending' | 'loading' | 'transporting' | 'unloading' | 'completed' | 'cancelled';
  deviation?: boolean;
  createdAt: string;
}

const mockOrders: TransportOrder[] = [
  { id: '1', orderNo: 'TO20240120001', plateNumber: '京A12345', driverName: '张三', wasteType: 'HW08废矿物油', weight: 8.5, loadingAddress: '北京化工厂', unloadingAddress: '危险废物处置中心', expectedStartTime: '2024-01-20 08:00:00', expectedEndTime: '2024-01-20 18:00:00', loadingTime: '2024-01-20 08:30:00', status: 'transporting', createdAt: '2024-01-19 16:00:00' },
  { id: '2', orderNo: 'TO20240120002', plateNumber: '京C11111', driverName: '王五', wasteType: 'HW49其他废物', weight: 5.2, loadingAddress: '某制药厂', unloadingAddress: '危险废物处置中心', expectedStartTime: '2024-01-20 09:00:00', expectedEndTime: '2024-01-20 17:00:00', loadingTime: '2024-01-20 09:15:00', unloadingTime: '2024-01-20 15:30:00', status: 'completed', createdAt: '2024-01-19 17:00:00' },
  { id: '3', orderNo: 'TO20240121001', plateNumber: '京B67890', driverName: '李四', wasteType: 'HW06废有机溶剂', weight: 15.0, loadingAddress: '某电子厂', unloadingAddress: '危险废物处置中心', expectedStartTime: '2024-01-21 07:00:00', expectedEndTime: '2024-01-21 19:00:00', status: 'pending', createdAt: '2024-01-20 10:00:00' },
  { id: '4', orderNo: 'TO20240120003', plateNumber: '京A12345', driverName: '张三', wasteType: 'HW17表面处理废物', weight: 10.0, loadingAddress: '某电镀厂', unloadingAddress: '危险废物处置中心', expectedStartTime: '2024-01-20 10:00:00', expectedEndTime: '2024-01-20 20:00:00', status: 'loading', deviation: true, createdAt: '2024-01-19 18:00:00' },
  { id: '5', orderNo: 'TO20240119001', plateNumber: '京D22222', driverName: '赵六', wasteType: 'HW08废矿物油', weight: 12.0, loadingAddress: '某修理厂', unloadingAddress: '危险废物处置中心', expectedStartTime: '2024-01-19 08:00:00', expectedEndTime: '2024-01-19 16:00:00', status: 'cancelled', createdAt: '2024-01-18 15:00:00' },
];

const statusMap = {
  pending: { color: 'default', text: '待开始', badge: 'default' },
  loading: { color: 'blue', text: '装载中', badge: 'processing' },
  transporting: { color: 'cyan', text: '运输中', badge: 'processing' },
  unloading: { color: 'purple', text: '卸载中', badge: 'processing' },
  completed: { color: 'green', text: '已完成', badge: 'success' },
  cancelled: { color: 'red', text: '已取消', badge: 'error' },
};

export default function TransportOrdersPage() {
  const [orders, setOrders] = useState<TransportOrder[]>(mockOrders);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<TransportOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [form] = Form.useForm();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await transportOrderApi.list({ pageSize: 100, status: statusFilter || undefined });
      if (res.data?.list?.length > 0) {
        setOrders(res.data.list);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleDetail = (record: TransportOrder) => {
    setCurrentOrder(record);
    setDetailVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const orderData = {
        ...values,
        expectedStartTime: values.expectedTime[0].format('YYYY-MM-DD HH:mm:ss'),
        expectedEndTime: values.expectedTime[1].format('YYYY-MM-DD HH:mm:ss'),
      };
      delete orderData.expectedTime;

      const res = await transportOrderApi.create(orderData);
      const newOrder = {
        ...orderData,
        id: res.data?.id || Date.now().toString(),
        orderNo: `TO${dayjs().format('YYYYMMDDHHmmss')}`,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      setOrders([newOrder, ...orders]);
      message.success('创建成功');
      setModalVisible(false);
    } catch (error: any) {
      if (error.errorFields) return;
      message.error('创建失败');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await transportOrderApi.complete(id);
      setOrders(orders.map((o) => (o.id === id ? { ...o, status: 'completed', unloadingTime: new Date().toISOString() } : o)));
      message.success('运输单已完成');
    } catch (error) {
      setOrders(orders.map((o) => (o.id === id ? { ...o, status: 'completed', unloadingTime: new Date().toISOString() } : o)));
      message.success('运输单已完成');
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await transportOrderApi.cancel(id);
      setOrders(orders.map((o) => (o.id === id ? { ...o, status: 'cancelled' } : o)));
      message.success('运输单已取消');
    } catch (error) {
      setOrders(orders.map((o) => (o.id === id ? { ...o, status: 'cancelled' } : o)));
      message.success('运输单已取消');
    }
  };

  const handleUpdateStatus = async (id: string, status: TransportOrder['status']) => {
    try {
      await transportOrderApi.updateStatus(id, { status });
      setOrders(orders.map((o) => (o.id === id ? { ...o, status } : o)));
      message.success('状态已更新');
    } catch (error) {
      setOrders(orders.map((o) => (o.id === id ? { ...o, status } : o)));
      message.success('状态已更新');
    }
  };

  const columns = [
    { title: '运输单号', dataIndex: 'orderNo', key: 'orderNo', width: 180 },
    { title: '车牌号', dataIndex: 'plateNumber', key: 'plateNumber', width: 110 },
    { title: '驾驶员', dataIndex: 'driverName', key: 'driverName', width: 90 },
    { title: '废物类型', dataIndex: 'wasteType', key: 'wasteType', width: 160 },
    { title: '重量(吨)', dataIndex: 'weight', key: 'weight', width: 90 },
    { title: '装载地点', dataIndex: 'loadingAddress', key: 'loadingAddress' },
    { title: '卸载地点', dataIndex: 'unloadingAddress', key: 'unloadingAddress' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: TransportOrder['status'], record: TransportOrder) => (
        <Space>
          <Badge status={statusMap[status].badge as any} text={<Tag color={statusMap[status].color}>{statusMap[status].text}</Tag>} />
          {record.deviation && <Tag color="red">偏离路线</Tag>}
        </Space>
      ),
    },
    { title: '预计开始', dataIndex: 'expectedStartTime', key: 'expectedStartTime', width: 170 },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 170 },
    {
      title: '操作',
      key: 'action',
      width: 260,
      fixed: 'right' as const,
      render: (_: any, record: TransportOrder) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>
            详情
          </Button>
          {record.status === 'pending' && (
            <Button type="link" size="small" onClick={() => handleUpdateStatus(record.id, 'loading')}>
              开始装载
            </Button>
          )}
          {record.status === 'loading' && (
            <Button type="link" size="small" onClick={() => handleUpdateStatus(record.id, 'transporting')}>
              开始运输
            </Button>
          )}
          {record.status === 'transporting' && (
            <Button type="link" size="small" onClick={() => handleUpdateStatus(record.id, 'unloading')}>
              开始卸载
            </Button>
          )}
          {record.status === 'unloading' && (
            <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handleComplete(record.id)}>
              完成
            </Button>
          )}
          {(record.status === 'pending' || record.status === 'loading') && (
            <Button type="link" size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleCancel(record.id)}>
              取消
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <h2 style={{ margin: 0 }}>运输单管理</h2>
          <Select
            placeholder="状态筛选"
            style={{ width: 150 }}
            allowClear
            value={statusFilter || undefined}
            onChange={(v) => {
              setStatusFilter(v || '');
              fetchOrders();
            }}
          >
            {Object.entries(statusMap).map(([key, { text }]) => (
              <Option key={key} value={key}>{text}</Option>
            ))}
          </Select>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增运输单
        </Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={orders}
        loading={loading}
        scroll={{ x: 1400 }}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
      />

      <Modal
        title="新增运输单"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="plateNumber" label="车牌号" rules={[{ required: true, message: '请输入车牌号' }]}>
                <Input placeholder="请输入车牌号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="driverName" label="驾驶员" rules={[{ required: true, message: '请输入驾驶员姓名' }]}>
                <Input placeholder="请输入驾驶员姓名" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="wasteType" label="废物类型" rules={[{ required: true, message: '请选择废物类型' }]}>
                <Select placeholder="请选择废物类型">
                  <Option value="HW08废矿物油">HW08废矿物油</Option>
                  <Option value="HW06废有机溶剂">HW06废有机溶剂</Option>
                  <Option value="HW17表面处理废物">HW17表面处理废物</Option>
                  <Option value="HW49其他废物">HW49其他废物</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="weight" label="重量(吨)" rules={[{ required: true, message: '请输入重量' }]}>
                <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入重量" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="loadingAddress" label="装载地点" rules={[{ required: true, message: '请输入装载地点' }]}>
            <Input placeholder="请输入装载地点" />
          </Form.Item>
          <Form.Item name="unloadingAddress" label="卸载地点" rules={[{ required: true, message: '请输入卸载地点' }]}>
            <Input placeholder="请输入卸载地点" />
          </Form.Item>
          <Form.Item name="expectedTime" label="预计时间" rules={[{ required: true, message: '请选择预计时间' }]}>
            <RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="运输单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ]}
        width={700}
        destroyOnClose
      >
        {currentOrder && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="运输单号" span={2}>{currentOrder.orderNo}</Descriptions.Item>
            <Descriptions.Item label="车牌号">{currentOrder.plateNumber}</Descriptions.Item>
            <Descriptions.Item label="驾驶员">{currentOrder.driverName}</Descriptions.Item>
            <Descriptions.Item label="废物类型">{currentOrder.wasteType}</Descriptions.Item>
            <Descriptions.Item label="重量">{currentOrder.weight} 吨</Descriptions.Item>
            <Descriptions.Item label="装载地点" span={2}>{currentOrder.loadingAddress}</Descriptions.Item>
            <Descriptions.Item label="卸载地点" span={2}>{currentOrder.unloadingAddress}</Descriptions.Item>
            <Descriptions.Item label="预计开始时间">{currentOrder.expectedStartTime}</Descriptions.Item>
            <Descriptions.Item label="预计结束时间">{currentOrder.expectedEndTime}</Descriptions.Item>
            <Descriptions.Item label="实际装载时间">{currentOrder.loadingTime || '-'}</Descriptions.Item>
            <Descriptions.Item label="实际卸载时间">{currentOrder.unloadingTime || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态" span={2}>
              <Tag color={statusMap[currentOrder.status].color}>{statusMap[currentOrder.status].text}</Tag>
              {currentOrder.deviation && <Tag color="red">偏离路线</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间" span={2}>{currentOrder.createdAt}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
