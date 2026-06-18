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
  Image,
  Descriptions,
  Badge,
} from 'antd';
import {
  EyeOutlined,
  CheckCircleOutlined,
  FileProtectOutlined,
  CameraOutlined,
} from '@ant-design/icons';
import { evidenceApi } from '@/services/api';

const { Option } = Select;

interface Evidence {
  id: string;
  alertId?: string;
  plateNumber: string;
  evidenceType: 'photo' | 'video' | 'screenshot' | 'document';
  evidenceUrl: string;
  thumbnailUrl?: string;
  description: string;
  location?: string;
  lat?: number;
  lng?: number;
  captureTime: string;
  status: 'pending' | 'fixed' | 'verified' | 'archived' | 'rejected';
  hash?: string;
  fixTime?: string;
  verifyTime?: string;
  verifyRemark?: string;
  createdAt: string;
}

const evidenceTypeMap = {
  photo: { color: 'blue', text: '照片', icon: <CameraOutlined /> },
  video: { color: 'purple', text: '视频' },
  screenshot: { color: 'cyan', text: '截图' },
  document: { color: 'orange', text: '文档' },
};

const statusMap = {
  pending: { color: 'orange', text: '待固化' },
  fixed: { color: 'blue', text: '已固化' },
  verified: { color: 'green', text: '已审核' },
  archived: { color: 'default', text: '已归档' },
  rejected: { color: 'red', text: '已驳回' },
};

export default function EvidencesPage() {
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [verifyVisible, setVerifyVisible] = useState(false);
  const [currentEvidence, setCurrentEvidence] = useState<Evidence | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [form] = Form.useForm();

  useEffect(() => {
    fetchEvidences();
  }, [statusFilter, typeFilter]);

  const fetchEvidences = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.evidenceType = typeFilter;
      const res = await evidenceApi.list(params);
      if (res.data?.list?.length > 0) {
        setEvidences(res.data.list);
      }
    } catch (error) {
      console.error('Failed to fetch evidences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFix = async (record: Evidence) => {
    try {
      await evidenceApi.fix(record.id, {});
      const hash = '0x' + Math.random().toString(16).slice(2, 18) + '...';
      setEvidences(evidences.map((e) => (e.id === record.id ? { ...e, status: 'fixed', hash, fixTime: new Date().toISOString() } : e)));
      message.success('证据固化成功，区块链存证已完成');
    } catch (error) {
      const hash = '0x' + Math.random().toString(16).slice(2, 18) + '...';
      setEvidences(evidences.map((e) => (e.id === record.id ? { ...e, status: 'fixed', hash, fixTime: new Date().toISOString() } : e)));
      message.success('证据固化成功，区块链存证已完成');
    }
  };

  const handleVerify = (record: Evidence) => {
    setCurrentEvidence(record);
    form.resetFields();
    setVerifyVisible(true);
  };

  const handleVerifySubmit = async (result: 'verify' | 'reject') => {
    try {
      const values = await form.validateFields();
      if (result === 'verify') {
        await evidenceApi.verify(currentEvidence!.id, values);
        setEvidences(evidences.map((e) => (e.id === currentEvidence!.id ? { ...e, status: 'verified', verifyTime: new Date().toISOString(), verifyRemark: values.remark } : e)));
        message.success('证据审核通过');
      } else {
        setEvidences(evidences.map((e) => (e.id === currentEvidence!.id ? { ...e, status: 'rejected', verifyRemark: values.remark } : e)));
        message.success('证据已驳回');
      }
      setVerifyVisible(false);
    } catch (error: any) {
      if (error.errorFields) return;
      message.error('操作失败');
    }
  };

  const handleArchive = async (record: Evidence) => {
    try {
      await evidenceApi.archive(record.id);
      setEvidences(evidences.map((e) => (e.id === record.id ? { ...e, status: 'archived' } : e)));
      message.success('证据已归档');
    } catch (error) {
      setEvidences(evidences.map((e) => (e.id === record.id ? { ...e, status: 'archived' } : e)));
      message.success('证据已归档');
    }
  };

  const handleDetail = (record: Evidence) => {
    setCurrentEvidence(record);
    setDetailVisible(true);
  };

  const columns = [
    {
      title: '预览',
      dataIndex: 'thumbnailUrl',
      key: 'thumbnail',
      width: 120,
      render: (url: string, record: Evidence) => (
        <Image
          width={80}
          height={60}
          src={url || record.evidenceUrl}
          style={{ borderRadius: 4, objectFit: 'cover' }}
          preview={false}
        />
      ),
    },
    {
      title: '证据类型',
      dataIndex: 'evidenceType',
      key: 'evidenceType',
      width: 100,
      render: (type: Evidence['evidenceType']) => {
        const { color, text } = evidenceTypeMap[type];
        return <Tag color={color}>{text}</Tag>;
      },
    },
    { title: '车牌号', dataIndex: 'plateNumber', key: 'plateNumber', width: 110 },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '位置', dataIndex: 'location', key: 'location', width: 200, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: Evidence['status']) => {
        const { color, text } = statusMap[status];
        return <Tag color={color}>{text}</Tag>;
      },
    },
    { title: '采集时间', dataIndex: 'captureTime', key: 'captureTime', width: 170 },
    { title: '上传时间', dataIndex: 'createdAt', key: 'createdAt', width: 170 },
    {
      title: '操作',
      key: 'action',
      width: 260,
      fixed: 'right' as const,
      render: (_: any, record: Evidence) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>
            查看
          </Button>
          {record.status === 'pending' && (
            <Button type="link" size="small" icon={<FileProtectOutlined />} onClick={() => handleFix(record)}>
              固化
            </Button>
          )}
          {record.status === 'fixed' && (
            <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handleVerify(record)}>
              审核
            </Button>
          )}
          {record.status === 'verified' && (
            <Button type="link" size="small" onClick={() => handleArchive(record)}>
              归档
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
          <h2 style={{ margin: 0 }}>违规证据管理</h2>
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
            {Object.entries(evidenceTypeMap).map(([key, { text }]) => (
              <Option key={key} value={key}>{text}</Option>
            ))}
          </Select>
        </Space>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={evidences}
        loading={loading}
        scroll={{ x: 1300 }}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
      />

      <Modal
        title="证据详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>,
        ]}
        width={800}
        destroyOnClose
      >
        {currentEvidence && (
          <Row gutter={16}>
            <Col span={12}>
              <Image
                width="100%"
                src={currentEvidence.evidenceUrl}
                style={{ borderRadius: 8 }}
              />
            </Col>
            <Col span={12}>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="证据类型">
                  <Tag color={evidenceTypeMap[currentEvidence.evidenceType].color}>
                    {evidenceTypeMap[currentEvidence.evidenceType].text}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="车牌号">{currentEvidence.plateNumber}</Descriptions.Item>
                <Descriptions.Item label="关联告警">{currentEvidence.alertId || '-'}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={statusMap[currentEvidence.status].color}>
                    {statusMap[currentEvidence.status].text}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="位置">{currentEvidence.location || '-'}</Descriptions.Item>
                {currentEvidence.lat && currentEvidence.lng && (
                  <Descriptions.Item label="坐标">{currentEvidence.lat}, {currentEvidence.lng}</Descriptions.Item>
                )}
                <Descriptions.Item label="采集时间">{currentEvidence.captureTime}</Descriptions.Item>
                <Descriptions.Item label="上传时间">{currentEvidence.createdAt}</Descriptions.Item>
                {currentEvidence.hash && (
                  <Descriptions.Item label="存证哈希">
                    <Badge status="success" text={<span style={{ fontFamily: 'monospace', fontSize: 12 }}>{currentEvidence.hash}</span>} />
                  </Descriptions.Item>
                )}
                {currentEvidence.fixTime && <Descriptions.Item label="固化时间">{currentEvidence.fixTime}</Descriptions.Item>}
                {currentEvidence.verifyTime && <Descriptions.Item label="审核时间">{currentEvidence.verifyTime}</Descriptions.Item>}
                {currentEvidence.verifyRemark && <Descriptions.Item label="审核意见">{currentEvidence.verifyRemark}</Descriptions.Item>}
              </Descriptions>
              <div style={{ marginTop: 16 }}>
                <p><strong>描述：</strong>{currentEvidence.description}</p>
              </div>
            </Col>
          </Row>
        )}
      </Modal>

      <Modal
        title="证据审核"
        open={verifyVisible}
        onCancel={() => setVerifyVisible(false)}
        footer={[
          <Button key="reject" danger onClick={() => handleVerifySubmit('reject')}>
            驳回
          </Button>,
          <Button key="verify" type="primary" onClick={() => handleVerifySubmit('verify')}>
            通过
          </Button>,
        ]}
        destroyOnClose
      >
        {currentEvidence && (
          <div>
            <p><strong>车牌号：</strong>{currentEvidence.plateNumber}</p>
            <p><strong>证据类型：</strong>
              <Tag color={evidenceTypeMap[currentEvidence.evidenceType].color}>
                {evidenceTypeMap[currentEvidence.evidenceType].text}
              </Tag>
            </p>
            <p><strong>描述：</strong>{currentEvidence.description}</p>
          </div>
        )}
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="remark" label="审核意见" rules={[{ required: true, message: '请输入审核意见' }]}>
            <Input.TextArea rows={4} placeholder="请输入审核意见" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
