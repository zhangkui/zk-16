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
  Popconfirm,
  InputNumber,
  Row,
  Col,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { vehicleApi } from '@/services/api';
import { useAuthStore } from '@/store/auth';

const { Option } = Select;

interface Vehicle {
  id: string;
  plateNumber: string;
  vehicleType: string;
  driverName: string;
  driverPhone: string;
  capacity: number;
  wasteType: string;
  company: string;
  companyId?: string;
  status: 'pending' | 'approved' | 'rejected' | 'disabled';
  remark?: string;
  createdAt: string;
}

export default function VehiclesPage() {
  const { user } = useAuthStore();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [reviewingVehicle, setReviewingVehicle] = useState<Vehicle | null>(null);
  const [form] = Form.useForm();
  const [reviewForm] = Form.useForm();

  const isCompanyAdmin = user?.role === 'company_super_admin' || user?.role === 'company_admin';
  const canReview = user?.role === 'admin' || user?.role === 'supervision' || user?.role === 'department_auditor';

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const res = await vehicleApi.list({ pageSize: 100 });
      if (res.data?.list?.length > 0) {
        setVehicles(res.data.list);
      }
    } catch (error) {
      console.error('Failed to fetch vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingVehicle(null);
    form.resetFields();
    if (isCompanyAdmin) {
      form.setFieldsValue({ company: user?.company || '' });
    }
    setModalVisible(true);
  };

  const handleEdit = (record: Vehicle) => {
    setEditingVehicle(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await vehicleApi.remove(id);
      setVehicles(vehicles.filter((v) => v.id !== id));
      message.success('删除成功');
    } catch (error: any) {
      message.error(error.response?.data?.message || '删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingVehicle) {
        await vehicleApi.update(editingVehicle.id, values);
        setVehicles(vehicles.map((v) => (v.id === editingVehicle.id ? { ...v, ...values } : v)));
        message.success('更新成功');
      } else {
        const res = await vehicleApi.create(values);
        const newVehicle = { ...values, id: res.data?.id || Date.now().toString(), status: 'pending', createdAt: new Date().toISOString() };
        setVehicles([newVehicle, ...vehicles]);
        message.success('添加成功');
      }
      setModalVisible(false);
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(editingVehicle ? '更新失败' : '添加失败');
    }
  };

  const handleApprove = (record: Vehicle) => {
    setReviewingVehicle(record);
    reviewForm.resetFields();
    setApproveModalVisible(true);
  };

  const handleApproveSubmit = async (type: 'approve' | 'reject') => {
    try {
      const values = await reviewForm.validateFields();
      if (type === 'approve') {
        await vehicleApi.approve(reviewingVehicle!.id, values);
        setVehicles(vehicles.map((v) => (v.id === reviewingVehicle!.id ? { ...v, status: 'approved' } : v)));
        message.success('审核通过');
      } else {
        await vehicleApi.reject(reviewingVehicle!.id, values);
        setVehicles(vehicles.map((v) => (v.id === reviewingVehicle!.id ? { ...v, status: 'rejected', remark: values.remark } : v)));
        message.success('已驳回');
      }
      setApproveModalVisible(false);
    } catch (error: any) {
      if (error.errorFields) return;
      message.error('操作失败');
    }
  };

  const getStatusTag = (status: Vehicle['status']) => {
    const statusMap = {
      pending: { color: 'orange', text: '待审核', icon: <ExclamationCircleOutlined /> },
      approved: { color: 'green', text: '已通过', icon: <CheckCircleOutlined /> },
      rejected: { color: 'red', text: '已驳回', icon: <DeleteOutlined /> },
      disabled: { color: 'default', text: '已停用', icon: <DeleteOutlined /> },
    };
    const { color, text, icon } = statusMap[status];
    return <Tag color={color} icon={icon}>{text}</Tag>;
  };

  const columns = [
    { title: '车牌号', dataIndex: 'plateNumber', key: 'plateNumber', width: 120 },
    { title: '车辆类型', dataIndex: 'vehicleType', key: 'vehicleType', width: 120 },
    { title: '驾驶员', dataIndex: 'driverName', key: 'driverName', width: 100 },
    { title: '联系电话', dataIndex: 'driverPhone', key: 'driverPhone', width: 130 },
    { title: '载重(吨)', dataIndex: 'capacity', key: 'capacity', width: 90 },
    { title: '废物类型', dataIndex: 'wasteType', key: 'wasteType' },
    { title: '所属公司', dataIndex: 'company', key: 'company' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (s: Vehicle['status']) => getStatusTag(s) },
    { title: '备注', dataIndex: 'remark', key: 'remark' },
    { title: '备案时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right' as const,
      render: (_: any, record: Vehicle) => (
        <Space size="small">
          {canReview && record.status === 'pending' && (
            <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handleApprove(record)}>
              审核
            </Button>
          )}
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除该车辆吗？" onConfirm={() => handleDelete(record.id)}>
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
        <h2 style={{ margin: 0 }}>车辆备案管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增车辆
        </Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={vehicles}
        loading={loading}
        scroll={{ x: 1200 }}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
      />

      <Modal
        title={editingVehicle ? '编辑车辆' : '新增车辆'}
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
              <Form.Item name="vehicleType" label="车辆类型" rules={[{ required: true, message: '请选择车辆类型' }]}>
                <Select placeholder="请选择车辆类型">
                  <Option value="厢式货车">厢式货车</Option>
                  <Option value="罐式货车">罐式货车</Option>
                  <Option value="自卸货车">自卸货车</Option>
                  <Option value="冷藏车">冷藏车</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="driverName" label="驾驶员姓名" rules={[{ required: true, message: '请输入驾驶员姓名' }]}>
                <Input placeholder="请输入驾驶员姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="driverPhone" label="联系电话" rules={[{ required: true, message: '请输入联系电话' }]}>
                <Input placeholder="请输入联系电话" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="capacity" label="载重(吨)" rules={[{ required: true, message: '请输入载重' }]}>
                <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入载重" />
              </Form.Item>
            </Col>
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
          </Row>
          <Form.Item name="company" label="所属公司" rules={isCompanyAdmin ? [] : [{ required: true, message: '请输入所属公司' }]}>
            <Input placeholder="请输入所属公司" disabled={isCompanyAdmin} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="车辆审核"
        open={approveModalVisible}
        onCancel={() => setApproveModalVisible(false)}
        footer={[
          <Button key="reject" danger onClick={() => handleApproveSubmit('reject')}>
            驳回
          </Button>,
          <Button key="approve" type="primary" onClick={() => handleApproveSubmit('approve')}>
            通过
          </Button>,
        ]}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <p><strong>车牌号：</strong>{reviewingVehicle?.plateNumber}</p>
          <p><strong>车辆类型：</strong>{reviewingVehicle?.vehicleType}</p>
          <p><strong>驾驶员：</strong>{reviewingVehicle?.driverName}</p>
          <p><strong>废物类型：</strong>{reviewingVehicle?.wasteType}</p>
        </div>
        <Form form={reviewForm} layout="vertical">
          <Form.Item name="remark" label="审核意见">
            <Input.TextArea rows={4} placeholder="请输入审核意见（驳回时必填）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
