'use client';

import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Select,
  Input,
  Tag,
  message,
  Row,
  Col,
  Card,
  DatePicker,
  Form,
} from 'antd';
import {
  DownloadOutlined,
  SearchOutlined,
  UserOutlined,
  AuditOutlined,
  FileTextOutlined,
  CarOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { auditApi } from '@/services/api';

const { Option } = Select;
const { RangePicker } = DatePicker;

interface AuditLog {
  id: string;
  operationType: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'login' | 'logout' | 'query' | 'export' | 'other';
  module: 'auth' | 'vehicle' | 'fence' | 'transport_order' | 'alert' | 'evidence' | 'disposal_receipt' | 'system' | 'other';
  operator: string;
  operatorId?: string;
  description: string;
  targetId?: string;
  targetType?: string;
  ip?: string;
  userAgent?: string;
  requestMethod?: string;
  requestUrl?: string;
  requestParams?: string;
  responseStatus?: number;
  duration?: number;
  createdAt: string;
}

const mockLogs: AuditLog[] = [
  { id: '1', operationType: 'login', module: 'auth', operator: 'admin', description: '用户登录系统', ip: '192.168.1.100', requestMethod: 'POST', requestUrl: '/auth/login', responseStatus: 200, duration: 120, createdAt: '2024-01-20 10:00:00' },
  { id: '2', operationType: 'create', module: 'vehicle', operator: 'admin', description: '新增车辆备案：京F12345', targetId: 'v123', targetType: 'vehicle', ip: '192.168.1.100', requestMethod: 'POST', requestUrl: '/vehicles', responseStatus: 201, duration: 85, createdAt: '2024-01-20 10:15:00' },
  { id: '3', operationType: 'approve', module: 'vehicle', operator: 'admin', description: '审核通过车辆：京B67890', targetId: 'v456', targetType: 'vehicle', ip: '192.168.1.100', requestMethod: 'PATCH', requestUrl: '/vehicles/v456/approve', responseStatus: 200, duration: 60, createdAt: '2024-01-20 10:30:00' },
  { id: '4', operationType: 'create', module: 'fence', operator: 'admin', description: '创建电子围栏：化工园区东区', targetId: 'f789', targetType: 'fence', ip: '192.168.1.100', requestMethod: 'POST', requestUrl: '/fences', responseStatus: 201, duration: 95, createdAt: '2024-01-20 11:00:00' },
  { id: '5', operationType: 'update', module: 'fence', operator: 'admin', description: '修改电子围栏：化工园区东区', targetId: 'f789', targetType: 'fence', ip: '192.168.1.100', requestMethod: 'PATCH', requestUrl: '/fences/f789', responseStatus: 200, duration: 70, createdAt: '2024-01-20 11:15:00' },
  { id: '6', operationType: 'create', module: 'transport_order', operator: 'admin', description: '创建运输单：TO20240120003', targetId: 'to001', targetType: 'transport_order', ip: '192.168.1.100', requestMethod: 'POST', requestUrl: '/transport-orders', responseStatus: 201, duration: 110, createdAt: '2024-01-20 11:30:00' },
  { id: '7', operationType: 'process', module: 'alert', operator: 'admin', description: '处理告警：围栏越界告警', targetId: 'a123', targetType: 'alert', ip: '192.168.1.100', requestMethod: 'PATCH', requestUrl: '/alerts/a123/process', responseStatus: 200, duration: 55, createdAt: '2024-01-20 12:00:00' },
  { id: '8', operationType: 'verify', module: 'evidence', operator: 'admin', description: '审核证据：超速抓拍', targetId: 'e456', targetType: 'evidence', ip: '192.168.1.100', requestMethod: 'PATCH', requestUrl: '/evidences/e456/verify', responseStatus: 200, duration: 80, createdAt: '2024-01-20 14:00:00' },
  { id: '9', operationType: 'match', module: 'disposal_receipt', operator: 'admin', description: '匹配联单：DR20240120001', targetId: 'dr789', targetType: 'disposal_receipt', ip: '192.168.1.100', requestMethod: 'PATCH', requestUrl: '/disposal-receipts/dr789/match', responseStatus: 200, duration: 65, createdAt: '2024-01-20 14:30:00' },
  { id: '10', operationType: 'export', module: 'system', operator: 'admin', description: '导出审计日志', ip: '192.168.1.100', requestMethod: 'GET', requestUrl: '/audit-logs/export', responseStatus: 200, duration: 500, createdAt: '2024-01-20 15:00:00' },
  { id: '11', operationType: 'delete', module: 'vehicle', operator: 'admin', description: '删除车辆：京D22222', targetId: 'v111', targetType: 'vehicle', ip: '192.168.1.100', requestMethod: 'DELETE', requestUrl: '/vehicles/v111', responseStatus: 200, duration: 45, createdAt: '2024-01-20 15:30:00' },
  { id: '12', operationType: 'logout', module: 'auth', operator: 'admin', description: '用户退出系统', ip: '192.168.1.100', requestMethod: 'POST', requestUrl: '/auth/logout', responseStatus: 200, duration: 30, createdAt: '2024-01-20 18:00:00' },
];

const operationTypeMap: Record<string, { color: string; text: string }> = {
  create: { color: 'green', text: '创建' },
  update: { color: 'blue', text: '更新' },
  delete: { color: 'red', text: '删除' },
  approve: { color: 'cyan', text: '通过' },
  reject: { color: 'red', text: '驳回' },
  login: { color: 'purple', text: '登录' },
  logout: { color: 'default', text: '登出' },
  query: { color: 'default', text: '查询' },
  export: { color: 'orange', text: '导出' },
  process: { color: 'blue', text: '处理' },
  verify: { color: 'green', text: '审核' },
  match: { color: 'cyan', text: '匹配' },
  other: { color: 'default', text: '其他' },
};

const moduleMap: Record<string, { color: string; text: string; icon: any }> = {
  auth: { color: 'purple', text: '认证', icon: <UserOutlined /> },
  vehicle: { color: 'blue', text: '车辆', icon: <CarOutlined /> },
  fence: { color: 'cyan', text: '围栏', icon: <AuditOutlined /> },
  transport_order: { color: 'orange', text: '运输单', icon: <FileTextOutlined /> },
  alert: { color: 'red', text: '告警', icon: <WarningOutlined /> },
  evidence: { color: 'green', text: '证据', icon: <FileTextOutlined /> },
  disposal_receipt: { color: 'magenta', text: '联单', icon: <FileTextOutlined /> },
  system: { color: 'default', text: '系统', icon: <AuditOutlined /> },
  other: { color: 'default', text: '其他', icon: <AuditOutlined /> },
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>(mockLogs);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [operator, setOperator] = useState('');
  const [operationType, setOperationType] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [dateRange, setDateRange] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchLogs();
  }, [operator, operationType, moduleFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (operator) params.operator = operator;
      if (operationType) params.operationType = operationType;
      if (moduleFilter) params.module = moduleFilter;
      if (dateRange && dateRange.length === 2) {
        params.startTime = dateRange[0].format('YYYY-MM-DD HH:mm:ss');
        params.endTime = dateRange[1].format('YYYY-MM-DD HH:mm:ss');
      }
      const res = await auditApi.list(params);
      if (res.data?.list?.length > 0) {
        setLogs(res.data.list);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: any = {};
      if (operator) params.operator = operator;
      if (operationType) params.operationType = operationType;
      if (moduleFilter) params.module = moduleFilter;
      if (dateRange && dateRange.length === 2) {
        params.startTime = dateRange[0].format('YYYY-MM-DD HH:mm:ss');
        params.endTime = dateRange[1].format('YYYY-MM-DD HH:mm:ss');
      }
      const res = await auditApi.export(params);
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `audit_logs_${new Date().getTime()}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      message.success('导出成功');
    } catch (error) {
      const csvContent = [
        ['ID', '操作类型', '模块', '操作人', '描述', 'IP地址', '请求方法', '请求URL', '响应状态', '耗时(ms)', '操作时间'].join(','),
        ...logs.map((log) => [
          log.id,
          operationTypeMap[log.operationType]?.text || log.operationType,
          moduleMap[log.module]?.text || log.module,
          log.operator,
          `"${log.description.replace(/"/g, '""')}"`,
          log.ip || '',
          log.requestMethod || '',
          log.requestUrl || '',
          log.responseStatus || '',
          log.duration || '',
          log.createdAt,
        ].join(',')),
      ].join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `audit_logs_${new Date().getTime()}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      message.success('导出成功');
    } finally {
      setExporting(false);
    }
  };

  const handleReset = () => {
    setOperator('');
    setOperationType('');
    setModuleFilter('');
    setDateRange(null);
    form.resetFields();
  };

  const columns = [
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 100,
      render: (m: AuditLog['module']) => {
        const { color, text, icon } = moduleMap[m] || { color: 'default', text: m, icon: <AuditOutlined /> };
        return <Tag color={color} icon={icon}>{text}</Tag>;
      },
    },
    {
      title: '操作类型',
      dataIndex: 'operationType',
      key: 'operationType',
      width: 100,
      render: (t: AuditLog['operationType']) => {
        const { color, text } = operationTypeMap[t] || { color: 'default', text: t };
        return <Tag color={color}>{text}</Tag>;
      },
    },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 120 },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '目标ID', dataIndex: 'targetId', key: 'targetId', width: 120, render: (id: string) => id || '-' },
    { title: 'IP地址', dataIndex: 'ip', key: 'ip', width: 130 },
    { title: '请求方法', dataIndex: 'requestMethod', key: 'requestMethod', width: 100 },
    { title: '请求URL', dataIndex: 'requestUrl', key: 'requestUrl', width: 200, ellipsis: true },
    { title: '响应状态', dataIndex: 'responseStatus', key: 'responseStatus', width: 100, render: (s: number) => s ? (s >= 200 && s < 300 ? <Tag color="green">{s}</Tag> : <Tag color="red">{s}</Tag>) : '-' },
    { title: '耗时(ms)', dataIndex: 'duration', key: 'duration', width: 100, render: (d: number) => d || '-' },
    { title: '操作时间', dataIndex: 'createdAt', key: 'createdAt', width: 170 },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>审计日志</h2>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={handleExport}
          loading={exporting}
        >
          导出日志
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline">
          <Form.Item label="操作人">
            <Input
              placeholder="请输入操作人"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              allowClear
              prefix={<UserOutlined />}
              style={{ width: 180 }}
            />
          </Form.Item>
          <Form.Item label="操作类型">
            <Select
              placeholder="请选择操作类型"
              style={{ width: 150 }}
              allowClear
              value={operationType || undefined}
              onChange={(v) => setOperationType(v || '')}
            >
              {Object.entries(operationTypeMap).map(([key, { text }]) => (
                <Option key={key} value={key}>{text}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="模块">
            <Select
              placeholder="请选择模块"
              style={{ width: 150 }}
              allowClear
              value={moduleFilter || undefined}
              onChange={(v) => setModuleFilter(v || '')}
            >
              {Object.entries(moduleMap).map(([key, { text }]) => (
                <Option key={key} value={key}>{text}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="时间范围">
            <RangePicker
              showTime
              value={dateRange}
              onChange={(v) => setDateRange(v)}
              style={{ width: 350 }}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={fetchLogs}>
                查询
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={logs}
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
        />
      </Card>
    </div>
  );
}
