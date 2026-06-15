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
  Row,
  Col,
  Card,
  Statistic,
  InputNumber,
  Descriptions,
  DatePicker,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  LinkOutlined,
  CheckCircleOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { disposalReceiptApi, transportOrderApi } from '@/services/api';

const { Option } = Select;

interface DisposalReceipt {
  id: string;
  receiptNo: string;
  plateNumber: string;
  driverName: string;
  wasteType: string;
  weight: number;
  disposalUnit: string;
  receiverName: string;
  disposalTime: string;
  transportOrderId?: string;
  transportOrderNo?: string;
  status: 'unmatched' | 'matched' | 'mismatched';
  matchRemark?: string;
  matchedAt?: string;
  createdAt: string;
}

const mockReceipts: DisposalReceipt[] = [
  { id: '1', receiptNo: 'DR20240120001', plateNumber: '京A12345', driverName: '张三', wasteType: 'HW08废矿物油', weight: 8.5, disposalUnit: '危险废物处置中心', receiverName: '李经理', disposalTime: '2024-01-20 15:30:00', transportOrderId: 'order1', transportOrderNo: 'TO20240120001', status: 'matched', matchedAt: '2024-01-20 16:00:00', createdAt: '2024-01-20 15:35:00' },
  { id: '2', receiptNo: 'DR20240120002', plateNumber: '京C11111', driverName: '王五', wasteType: 'HW49其他废物', weight: 5.2, disposalUnit: '危险废物处置中心', receiverName: '王主管', disposalTime: '2024-01-20 14:20:00', transportOrderId: 'order2', transportOrderNo: 'TO20240120002', status: 'matched', matchedAt: '2024-01-20 15:00:00', createdAt: '2024-01-20 14:25:00' },
  { id: '3', receiptNo: 'DR20240121001', plateNumber: '京B67890', driverName: '李四', wasteType: 'HW06废有机溶剂', weight: 15.0, disposalUnit: '环保处置有限公司', receiverName: '赵主任', disposalTime: '2024-01-21 10:00:00', status: 'unmatched', createdAt: '2024-01-21 10:05:00' },
  { id: '4', receiptNo: 'DR20240120003', plateNumber: '京D22222', driverName: '赵六', wasteType: 'HW17表面处理废物', weight: 10.0, disposalUnit: '危险废物处置中心', receiverName: '孙工', disposalTime: '2024-01-20 11:00:00', status: 'mismatched', matchRemark: '运输单重量12吨，联单重量10吨，重量不符', createdAt: '2024-01-20 11:05:00' },
  { id: '5', receiptNo: 'DR20240121002', plateNumber: '京E33333', driverName: '钱七', wasteType: 'HW08废矿物油', weight: 12.0, disposalUnit: '环保处置有限公司', receiverName: '周经理', disposalTime: '2024-01-21 14:00:00', status: 'unmatched', createdAt: '2024-01-21 14:10:00' },
];

const statusMap = {
  unmatched: { color: 'orange', text: '待匹配' },
  matched: { color: 'green', text: '已匹配' },
  mismatched: { color: 'red', text: '不匹配' },
};

export default function DisposalReceiptsPage() {
  const [receipts, setReceipts] = useState<DisposalReceipt[]>(mockReceipts);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [matchVisible, setMatchVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState<DisposalReceipt | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [orderList, setOrderList] = useState<any[]>([]);
  const [form] = Form.useForm();
  const [matchForm] = Form.useForm();

  useEffect(() => {
    fetchReceipts();
    fetchOrders();
  }, [statusFilter]);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      const res = await disposalReceiptApi.list(params);
      if (res.data?.list?.length > 0) {
        setReceipts(res.data.list);
      }
    } catch (error) {
      console.error('Failed to fetch receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await transportOrderApi.list({ pageSize: 100, status: 'completed' });
      if (res.data?.list?.length > 0) {
        setOrderList(res.data.list);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleAdd = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleDetail = (record: DisposalReceipt) => {
    setCurrentReceipt(record);
    setDetailVisible(true);
  };

  const handleMatch = (record: DisposalReceipt) => {
    setCurrentReceipt(record);
    matchForm.resetFields();
    setMatchVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const receiptData = {
        ...values,
        disposalTime: values.disposalTime.format('YYYY-MM-DD HH:mm:ss'),
      };

      const res = await disposalReceiptApi.create(receiptData);
      const newReceipt = {
        ...receiptData,
        id: res.data?.id || Date.now().toString(),
        receiptNo: `DR${Date.now().toString().slice(-10)}`,
        status: 'unmatched',
        createdAt: new Date().toISOString(),
      };
      setReceipts([newReceipt, ...receipts]);
      message.success('创建成功');
      setModalVisible(false);
    } catch (error: any) {
      if (error.errorFields) return;
      message.error('创建失败');
    }
  };

  const handleMatchSubmit = async (result: 'match' | 'mismatch') => {
    try {
      const values = await matchForm.validateFields();
      if (result === 'match') {
        await disposalReceiptApi.match(currentReceipt!.id, values);
        const matchedOrder = orderList.find((o) => o.id === values.transportOrderId);
        setReceipts(receipts.map((r) => (r.id === currentReceipt!.id ? { ...r, status: 'matched', transportOrderId: values.transportOrderId, transportOrderNo: matchedOrder?.orderNo, matchedAt: new Date().toISOString(), matchRemark: values.remark } : r)));
        message.success('匹配成功');
      } else {
        setReceipts(receipts.map((r) => (r.id === currentReceipt!.id ? { ...r, status: 'mismatched', matchRemark: values.remark } : r)));
        message.success('已标记为不匹配');
      }
      setMatchVisible(false);
    } catch (error: any) {
      if (error.errorFields) return;
      message.error('操作失败');
    }
  };

  const stats = {
    total: receipts.length,
    unmatched: receipts.filter((r) => r.status === 'unmatched').length,
    matched: receipts.filter((r) => r.status === 'matched').length,
    mismatched: receipts.filter((r) => r.status === 'mismatched').length,
  };

  const getMatchStatsOption = () => ({
    title: { text: '联单匹配情况', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        data: [
          { value: stats.matched, name: '已匹配', itemStyle: { color: '#52c41a' } },
          { value: stats.unmatched, name: '待匹配', itemStyle: { color: '#faad14' } },
          { value: stats.mismatched, name: '不匹配', itemStyle: { color: '#ff4d4f' } },
        ],
        label: { formatter: '{b}: {c}个 ({d}%)' },
      },
    ],
  });

  const getWasteTypeOption = () => ({
    title: { text: '废物类型统计', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    grid: { left: 100, right: 20, top: 50, bottom: 30 },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: ['HW49其他废物', 'HW17表面处理废物', 'HW06废有机溶剂', 'HW08废矿物油'],
    },
    series: [
      {
        type: 'bar',
        data: [
          { value: receipts.filter((r) => r.wasteType === 'HW49其他废物').length, itemStyle: { color: '#1677ff' } },
          { value: receipts.filter((r) => r.wasteType === 'HW17表面处理废物').length, itemStyle: { color: '#722ed1' } },
          { value: receipts.filter((r) => r.wasteType === 'HW06废有机溶剂').length, itemStyle: { color: '#faad14' } },
          { value: receipts.filter((r) => r.wasteType === 'HW08废矿物油').length, itemStyle: { color: '#ff4d4f' } },
        ],
        label: { show: true, position: 'right' },
      },
    ],
  });

  const columns = [
    { title: '联单号', dataIndex: 'receiptNo', key: 'receiptNo', width: 180 },
    { title: '车牌号', dataIndex: 'plateNumber', key: 'plateNumber', width: 110 },
    { title: '驾驶员', dataIndex: 'driverName', key: 'driverName', width: 90 },
    { title: '废物类型', dataIndex: 'wasteType', key: 'wasteType', width: 160 },
    { title: '重量(吨)', dataIndex: 'weight', key: 'weight', width: 90 },
    { title: '处置单位', dataIndex: 'disposalUnit', key: 'disposalUnit' },
    { title: '接收人', dataIndex: 'receiverName', key: 'receiverName', width: 100 },
    { title: '关联运输单', dataIndex: 'transportOrderNo', key: 'transportOrderNo', width: 180, render: (no: string) => no || '-' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: DisposalReceipt['status']) => {
        const { color, text } = statusMap[status];
        return <Tag color={color}>{text}</Tag>;
      },
    },
    { title: '处置时间', dataIndex: 'disposalTime', key: 'disposalTime', width: 170 },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right' as const,
      render: (_: any, record: DisposalReceipt) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>
            详情
          </Button>
          {record.status !== 'matched' && (
            <Button type="link" size="small" icon={<LinkOutlined />} onClick={() => handleMatch(record)}>
              匹配
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
          <h2 style={{ margin: 0 }}>处置联单管理</h2>
          <Select
            placeholder="状态筛选"
            style={{ width: 150 }}
            allowClear
            value={statusFilter || undefined}
            onChange={(v) => setStatusFilter(v || '')}
          >
            {Object.entries(statusMap).map(([key, { text }]) => (
              <Option key={key} value={key}>{text}</Option>
            ))}
          </Select>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增联单
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="联单总数" value={stats.total} prefix={<UnorderedListOutlined />} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="待匹配" value={stats.unmatched} prefix={<LinkOutlined />} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="已匹配" value={stats.matched} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="不匹配" value={stats.mismatched} prefix={<UnorderedListOutlined />} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card style={{ height: 280 }}>
            <ReactECharts option={getMatchStatsOption()} style={{ height: 220 }} />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card style={{ height: 280 }}>
            <ReactECharts option={getWasteTypeOption()} style={{ height: 220 }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={receipts}
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
        />
      </Card>

      <Modal
        title="新增处置联单"
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
                <InputNumber min={0} step={0.1} style={{ width: '100%' }} placeholder="请输入重量" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="disposalUnit" label="处置单位" rules={[{ required: true, message: '请输入处置单位' }]}>
            <Input placeholder="请输入处置单位" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="receiverName" label="接收人" rules={[{ required: true, message: '请输入接收人' }]}>
                <Input placeholder="请输入接收人" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="disposalTime" label="处置时间" rules={[{ required: true, message: '请选择处置时间' }]}>
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="匹配运输单"
        open={matchVisible}
        onCancel={() => setMatchVisible(false)}
        footer={[
          <Button key="mismatch" danger onClick={() => handleMatchSubmit('mismatch')}>
            标记不匹配
          </Button>,
          <Button key="match" type="primary" onClick={() => handleMatchSubmit('match')}>
            确认匹配
          </Button>,
        ]}
        destroyOnClose
      >
        {currentReceipt && (
          <div style={{ marginBottom: 16 }}>
            <p><strong>联单号：</strong>{currentReceipt.receiptNo}</p>
            <p><strong>车牌号：</strong>{currentReceipt.plateNumber}</p>
            <p><strong>废物类型：</strong>{currentReceipt.wasteType}</p>
            <p><strong>重量：</strong>{currentReceipt.weight} 吨</p>
          </div>
        )}
        <Form form={matchForm} layout="vertical">
          <Form.Item name="transportOrderId" label="关联运输单" rules={[{ required: true, message: '请选择运输单' }]}>
            <Select placeholder="请选择运输单" showSearch optionFilterProp="children">
              {orderList.map((o) => (
                <Option key={o.id} value={o.id}>{o.orderNo} - {o.plateNumber} ({o.weight}吨)</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="联单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>,
        ]}
        width={600}
        destroyOnClose
      >
        {currentReceipt && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="联单号" span={2}>{currentReceipt.receiptNo}</Descriptions.Item>
            <Descriptions.Item label="车牌号">{currentReceipt.plateNumber}</Descriptions.Item>
            <Descriptions.Item label="驾驶员">{currentReceipt.driverName}</Descriptions.Item>
            <Descriptions.Item label="废物类型">{currentReceipt.wasteType}</Descriptions.Item>
            <Descriptions.Item label="重量">{currentReceipt.weight} 吨</Descriptions.Item>
            <Descriptions.Item label="处置单位" span={2}>{currentReceipt.disposalUnit}</Descriptions.Item>
            <Descriptions.Item label="接收人">{currentReceipt.receiverName}</Descriptions.Item>
            <Descriptions.Item label="处置时间">{currentReceipt.disposalTime}</Descriptions.Item>
            <Descriptions.Item label="关联运输单" span={2}>{currentReceipt.transportOrderNo || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态" span={2}>
              <Tag color={statusMap[currentReceipt.status].color}>
                {statusMap[currentReceipt.status].text}
              </Tag>
            </Descriptions.Item>
            {currentReceipt.matchRemark && <Descriptions.Item label="匹配说明" span={2}>{currentReceipt.matchRemark}</Descriptions.Item>}
            {currentReceipt.matchedAt && <Descriptions.Item label="匹配时间" span={2}>{currentReceipt.matchedAt}</Descriptions.Item>}
            <Descriptions.Item label="创建时间" span={2}>{currentReceipt.createdAt}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
