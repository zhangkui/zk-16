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
  DatePicker,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  BellOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { alertApi } from '@/services/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

interface Alert {
  id: string;
  alertType: 'speeding' | 'route_deviation' | 'fence_violation' | 'timeout' | 'other';
  plateNumber: string;
  driverName: string;
  description: string;
  location?: string;
  lat?: number;
  lng?: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'acknowledged' | 'processing' | 'closed';
  createdAt: string;
  acknowledgedAt?: string;
  processedAt?: string;
  closedAt?: string;
  processRemark?: string;
}

const mockAlerts: Alert[] = [
  { id: '1', alertType: 'speeding', plateNumber: '京A12345', driverName: '张三', description: '车辆在东三环超速行驶，限速60km/h，实际速度85km/h', location: '北京市朝阳区东三环中路', lat: 39.9142, lng: 116.4674, level: 'high', status: 'active', createdAt: '2024-01-20 10:30:00' },
  { id: '2', alertType: 'route_deviation', plateNumber: '京B67890', driverName: '李四', description: '车辆偏离规划路线超过500米', location: '北京市海淀区中关村大街', lat: 39.9842, lng: 116.3174, level: 'medium', status: 'acknowledged', createdAt: '2024-01-20 09:45:00', acknowledgedAt: '2024-01-20 10:00:00' },
  { id: '3', alertType: 'fence_violation', plateNumber: '京C11111', driverName: '王五', description: '车辆进入禁行区域-市中心', location: '北京市东城区王府井', lat: 39.9142, lng: 116.4174, level: 'critical', status: 'processing', createdAt: '2024-01-20 08:30:00', acknowledgedAt: '2024-01-20 08:45:00', processedAt: '2024-01-20 09:00:00', processRemark: '已联系驾驶员，正在驶离禁行区' },
  { id: '4', alertType: 'timeout', plateNumber: '京D22222', driverName: '赵六', description: '车辆在某区域停留超过2小时', location: '北京市丰台区南四环西路', lat: 39.8342, lng: 116.3574, level: 'low', status: 'closed', createdAt: '2024-01-19 16:00:00', acknowledgedAt: '2024-01-19 16:30:00', processedAt: '2024-01-19 17:00:00', closedAt: '2024-01-19 18:00:00', processRemark: '车辆正常装卸作业，已完成' },
  { id: '5', alertType: 'speeding', plateNumber: '京A12345', driverName: '张三', description: '车辆在南四环超速行驶，限速60km/h，实际速度75km/h', location: '北京市丰台区南四环中路', lat: 39.8542, lng: 116.4074, level: 'medium', status: 'active', createdAt: '2024-01-20 11:15:00' },
  { id: '6', alertType: 'other', plateNumber: '京E33333', driverName: '钱七', description: '设备通讯异常超过30分钟', location: '未知', level: 'medium', status: 'active', createdAt: '2024-01-20 10:45:00' },
];

const alertTypeMap = {
  speeding: { color: 'red', text: '超速', icon: <WarningOutlined /> },
  route_deviation: { color: 'orange', text: '偏离路线', icon: <WarningOutlined /> },
  fence_violation: { color: 'purple', text: '围栏越界', icon: <ExclamationCircleOutlined /> },
  timeout: { color: 'blue', text: '超时停留', icon: <BellOutlined /> },
  other: { color: 'default', text: '其他', icon: <BellOutlined /> },
};

const levelMap = {
  low: { color: 'blue', text: '低' },
  medium: { color: 'orange', text: '中' },
  high: { color: 'red', text: '高' },
  critical: { color: 'magenta', text: '严重' },
};

const statusMap = {
  active: { color: 'red', text: '未处理' },
  acknowledged: { color: 'orange', text: '已确认' },
  processing: { color: 'blue', text: '处理中' },
  closed: { color: 'green', text: '已关闭' },
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [loading, setLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [processVisible, setProcessVisible] = useState(false);
  const [currentAlert, setCurrentAlert] = useState<Alert | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [form] = Form.useForm();

  useEffect(() => {
    fetchAlerts();
  }, [statusFilter, typeFilter, levelFilter]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.alertType = typeFilter;
      if (levelFilter) params.level = levelFilter;
      const res = await alertApi.list(params);
      if (res.data?.list?.length > 0) {
        setAlerts(res.data.list);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (record: Alert) => {
    try {
      await alertApi.acknowledge(record.id, {});
      setAlerts(alerts.map((a) => (a.id === record.id ? { ...a, status: 'acknowledged', acknowledgedAt: new Date().toISOString() } : a)));
      message.success('已确认告警');
    } catch (error) {
      setAlerts(alerts.map((a) => (a.id === record.id ? { ...a, status: 'acknowledged', acknowledgedAt: new Date().toISOString() } : a)));
      message.success('已确认告警');
    }
  };

  const handleProcess = (record: Alert) => {
    setCurrentAlert(record);
    form.resetFields();
    setProcessVisible(true);
  };

  const handleProcessSubmit = async () => {
    try {
      const values = await form.validateFields();
      await alertApi.process(currentAlert!.id, values);
      setAlerts(alerts.map((a) => (a.id === currentAlert!.id ? { ...a, status: 'processing', processedAt: new Date().toISOString(), processRemark: values.remark } : a)));
      message.success('已开始处理');
      setProcessVisible(false);
    } catch (error: any) {
      if (error.errorFields) return;
      message.error('操作失败');
    }
  };

  const handleClose = (record: Alert) => {
    setCurrentAlert(record);
    form.resetFields();
    Modal.confirm({
      title: '关闭告警',
      content: (
        <Form form={form} layout="vertical">
          <Form.Item name="remark" label="关闭说明" rules={[{ required: true, message: '请输入关闭说明' }]}>
            <Input.TextArea rows={3} placeholder="请输入关闭说明" />
          </Form.Item>
        </Form>
      ),
      onOk: async () => {
        try {
          const values = await form.validateFields();
          await alertApi.close(record.id, values);
          setAlerts(alerts.map((a) => (a.id === record.id ? { ...a, status: 'closed', closedAt: new Date().toISOString(), processRemark: values.remark } : a)));
          message.success('告警已关闭');
        } catch (error: any) {
          if (error.errorFields) return Promise.reject();
          setAlerts(alerts.map((a) => (a.id === record.id ? { ...a, status: 'closed', closedAt: new Date().toISOString() } : a)));
          message.success('告警已关闭');
        }
      },
    });
  };

  const handleDetail = (record: Alert) => {
    setCurrentAlert(record);
    setDetailVisible(true);
  };

  const stats = {
    total: alerts.length,
    active: alerts.filter((a) => a.status === 'active').length,
    processing: alerts.filter((a) => a.status === 'processing' || a.status === 'acknowledged').length,
    closed: alerts.filter((a) => a.status === 'closed').length,
  };

  const getLevelDistributionOption = () => ({
    title: { text: '告警等级分布', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        data: [
          { value: alerts.filter((a) => a.level === 'low').length, name: '低', itemStyle: { color: '#1677ff' } },
          { value: alerts.filter((a) => a.level === 'medium').length, name: '中', itemStyle: { color: '#faad14' } },
          { value: alerts.filter((a) => a.level === 'high').length, name: '高', itemStyle: { color: '#ff4d4f' } },
          { value: alerts.filter((a) => a.level === 'critical').length, name: '严重', itemStyle: { color: '#eb2f96' } },
        ],
        label: { formatter: '{b}: {c}' },
      },
    ],
  });

  const getTypeDistributionOption = () => ({
    title: { text: '告警类型分布', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    grid: { left: 80, right: 20, top: 50, bottom: 30 },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: ['其他', '超时停留', '围栏越界', '偏离路线', '超速'],
    },
    series: [
      {
        type: 'bar',
        data: [
          { value: alerts.filter((a) => a.alertType === 'other').length, itemStyle: { color: '#8c8c8c' } },
          { value: alerts.filter((a) => a.alertType === 'timeout').length, itemStyle: { color: '#1677ff' } },
          { value: alerts.filter((a) => a.alertType === 'fence_violation').length, itemStyle: { color: '#722ed1' } },
          { value: alerts.filter((a) => a.alertType === 'route_deviation').length, itemStyle: { color: '#faad14' } },
          { value: alerts.filter((a) => a.alertType === 'speeding').length, itemStyle: { color: '#ff4d4f' } },
        ],
        label: { show: true, position: 'right' },
      },
    ],
  });

  const columns = [
    {
      title: '告警类型',
      dataIndex: 'alertType',
      key: 'alertType',
      width: 120,
      render: (type: Alert['alertType']) => {
        const { color, text, icon } = alertTypeMap[type];
        return <Tag color={color} icon={icon}>{text}</Tag>;
      },
    },
    {
      title: '等级',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (level: Alert['level']) => {
        const { color, text } = levelMap[level];
        return <Tag color={color}>{text}</Tag>;
      },
    },
    { title: '车牌号', dataIndex: 'plateNumber', key: 'plateNumber', width: 110 },
    { title: '驾驶员', dataIndex: 'driverName', key: 'driverName', width: 90 },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '位置', dataIndex: 'location', key: 'location', width: 200, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: Alert['status']) => {
        const { color, text } = statusMap[status];
        return <Tag color={color}>{text}</Tag>;
      },
    },
    { title: '告警时间', dataIndex: 'createdAt', key: 'createdAt', width: 170 },
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right' as const,
      render: (_: any, record: Alert) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>
            详情
          </Button>
          {record.status === 'active' && (
            <Button type="link" size="small" onClick={() => handleAcknowledge(record)}>
              确认
            </Button>
          )}
          {(record.status === 'active' || record.status === 'acknowledged') && (
            <Button type="link" size="small" onClick={() => handleProcess(record)}>
              处理
            </Button>
          )}
          {record.status !== 'closed' && (
            <Button type="link" size="small" icon={<CloseCircleOutlined />} onClick={() => handleClose(record)}>
              关闭
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>告警中心</h2>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="告警总数" value={stats.total} prefix={<BellOutlined />} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="待处理" value={stats.active} prefix={<WarningOutlined />} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="处理中" value={stats.processing} prefix={<ExclamationCircleOutlined />} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="已关闭" value={stats.closed} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card style={{ height: 280 }}>
            <ReactECharts option={getLevelDistributionOption()} style={{ height: 220 }} />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card style={{ height: 280 }}>
            <ReactECharts option={getTypeDistributionOption()} style={{ height: 220 }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
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
          <Select
            placeholder="类型筛选"
            style={{ width: 150 }}
            allowClear
            value={typeFilter || undefined}
            onChange={(v) => setTypeFilter(v || '')}
          >
            {Object.entries(alertTypeMap).map(([key, { text }]) => (
              <Option key={key} value={key}>{text}</Option>
            ))}
          </Select>
          <Select
            placeholder="等级筛选"
            style={{ width: 150 }}
            allowClear
            value={levelFilter || undefined}
            onChange={(v) => setLevelFilter(v || '')}
          >
            {Object.entries(levelMap).map(([key, { text }]) => (
              <Option key={key} value={key}>{text}</Option>
            ))}
          </Select>
          <RangePicker showTime />
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={alerts}
          loading={loading}
          scroll={{ x: 1300 }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
        />
      </Card>

      <Modal
        title="告警详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>,
        ]}
        width={600}
        destroyOnClose
      >
        {currentAlert && (
          <div>
            <Row gutter={16}>
              <Col span={12}>
                <p><strong>告警类型：</strong>
                  <Tag color={alertTypeMap[currentAlert.alertType].color}>
                    {alertTypeMap[currentAlert.alertType].text}
                  </Tag>
                </p>
              </Col>
              <Col span={12}>
                <p><strong>等级：</strong>
                  <Tag color={levelMap[currentAlert.level].color}>
                    {levelMap[currentAlert.level].text}
                  </Tag>
                </p>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <p><strong>车牌号：</strong>{currentAlert.plateNumber}</p>
              </Col>
              <Col span={12}>
                <p><strong>驾驶员：</strong>{currentAlert.driverName}</p>
              </Col>
            </Row>
            <p><strong>描述：</strong>{currentAlert.description}</p>
            <p><strong>位置：</strong>{currentAlert.location || '-'}</p>
            {currentAlert.lat && currentAlert.lng && (
              <p><strong>坐标：</strong>{currentAlert.lat}, {currentAlert.lng}</p>
            )}
            <p><strong>告警时间：</strong>{currentAlert.createdAt}</p>
            <p><strong>状态：</strong>
              <Tag color={statusMap[currentAlert.status].color}>
                {statusMap[currentAlert.status].text}
              </Tag>
            </p>
            {currentAlert.acknowledgedAt && <p><strong>确认时间：</strong>{currentAlert.acknowledgedAt}</p>}
            {currentAlert.processedAt && <p><strong>处理时间：</strong>{currentAlert.processedAt}</p>}
            {currentAlert.closedAt && <p><strong>关闭时间：</strong>{currentAlert.closedAt}</p>}
            {currentAlert.processRemark && <p><strong>处理说明：</strong>{currentAlert.processRemark}</p>}
          </div>
        )}
      </Modal>

      <Modal
        title="处理告警"
        open={processVisible}
        onOk={handleProcessSubmit}
        onCancel={() => setProcessVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="remark" label="处理说明" rules={[{ required: true, message: '请输入处理说明' }]}>
            <Input.TextArea rows={4} placeholder="请输入处理说明" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
