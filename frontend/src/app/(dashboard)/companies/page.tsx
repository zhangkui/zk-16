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
  Row,
  Col,
  Card,
  Tabs,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { companyApi } from '@/services/api';
import { useAuthStore } from '@/store/auth';

const { Option } = Select;

interface Company {
  id: string;
  name: string;
  creditCode: string;
  contactPerson: string;
  contactPhone: string;
  address: string;
  businessScope: string;
  status: 'active' | 'inactive';
  remark: string;
  createdAt: string;
  updatedAt: string;
}

interface CompanyUser {
  id: string;
  username: string;
  realName: string;
  role: string;
  phone: string;
  email: string;
  status: string;
  isCompanySuperAdmin: boolean;
  createdAt: string;
}

export default function CompaniesPage() {
  const { user } = useAuthStore();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [form] = Form.useForm();
  const [userForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('list');

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const res = await companyApi.list({ pageSize: 100 });
      if (res.data?.list?.length > 0) {
        setCompanies(res.data.list);
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
      message.error('获取公司列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyUsers = async (companyId: string) => {
    setUsersLoading(true);
    try {
      const res = await companyApi.getUsers(companyId, { pageSize: 100 });
      if (res.data?.list?.length > 0) {
        setCompanyUsers(res.data.list);
      } else {
        setCompanyUsers([]);
      }
    } catch (error) {
      console.error('Failed to fetch company users:', error);
      message.error('获取公司用户失败');
    } finally {
      setUsersLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingCompany(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Company) => {
    setEditingCompany(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await companyApi.remove(id);
      setCompanies(companies.filter((c) => c.id !== id));
      message.success('删除成功');
    } catch (error: any) {
      message.error(error.response?.data?.message || '删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingCompany) {
        await companyApi.update(editingCompany.id, values);
        setCompanies(companies.map((c) => (c.id === editingCompany.id ? { ...c, ...values } : c)));
        message.success('更新成功');
      } else {
        const res = await companyApi.create(values);
        const newCompany = { ...res.data.company, id: res.data.company?.id || Date.now().toString() };
        setCompanies([newCompany, ...companies]);
        message.success('添加成功');
      }
      setModalVisible(false);
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(editingCompany ? '更新失败' : error.response?.data?.message || '添加失败');
    }
  };

  const handleViewUsers = (record: Company) => {
    setSelectedCompany(record);
    fetchCompanyUsers(record.id);
    setActiveTab('users');
  };

  const handleAddUser = () => {
    userForm.resetFields();
    setUserModalVisible(true);
  };

  const handleAddUserSubmit = async () => {
    try {
      const values = await userForm.validateFields();
      if (selectedCompany) {
        await companyApi.createUser(selectedCompany.id, values);
        message.success('添加用户成功');
        setUserModalVisible(false);
        fetchCompanyUsers(selectedCompany.id);
      }
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(error.response?.data?.message || '添加用户失败');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!selectedCompany) return;
    try {
      await companyApi.removeUser(selectedCompany.id, userId);
      setCompanyUsers(companyUsers.filter((u) => u.id !== userId));
      message.success('删除用户成功');
    } catch (error: any) {
      message.error(error.response?.data?.message || '删除用户失败');
    }
  };

  const getStatusTag = (status: Company['status']) => {
    const statusMap = {
      active: { color: 'green', text: '正常', icon: <CheckCircleOutlined /> },
      inactive: { color: 'default', text: '停用', icon: <ExclamationCircleOutlined /> },
    };
    const { color, text, icon } = statusMap[status] || statusMap.inactive;
    return <Tag color={color} icon={icon}>{text}</Tag>;
  };

  const getRoleTag = (role: string, isSuperAdmin: boolean) => {
    if (isSuperAdmin || role === 'company_super_admin') {
      return <Tag color="purple">超级管理员</Tag>;
    }
    if (role === 'company_admin') {
      return <Tag color="blue">管理员</Tag>;
    }
    return <Tag>{role}</Tag>;
  };

  const columns = [
    { title: '公司名称', dataIndex: 'name', key: 'name', width: 200 },
    { title: '统一社会信用代码', dataIndex: 'creditCode', key: 'creditCode', width: 180 },
    { title: '联系人', dataIndex: 'contactPerson', key: 'contactPerson', width: 100 },
    { title: '联系电话', dataIndex: 'contactPhone', key: 'contactPhone', width: 130 },
    { title: '地址', dataIndex: 'address', key: 'address' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (s: Company['status']) => getStatusTag(s) },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: Company) => (
        <Space size="small">
          <Button type="link" size="small" icon={<TeamOutlined />} onClick={() => handleViewUsers(record)}>
            用户管理
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除该公司吗？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const userColumns = [
    { title: '用户名', dataIndex: 'username', key: 'username', width: 150 },
    { title: '真实姓名', dataIndex: 'realName', key: 'realName', width: 120 },
    { title: '角色', dataIndex: 'role', key: 'role', width: 120, render: (role: string, record: CompanyUser) => getRoleTag(role, record.isCompanySuperAdmin) },
    { title: '联系电话', dataIndex: 'phone', key: 'phone', width: 130 },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (s: string) => s === 'active' ? <Tag color="green">正常</Tag> : <Tag color="default">停用</Tag> },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: CompanyUser) => (
        <Space size="small">
          {!record.isCompanySuperAdmin && (
            <Popconfirm title="确定删除该用户吗？" onConfirm={() => handleDeleteUser(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
          {record.isCompanySuperAdmin && (
            <span style={{ color: '#999', fontSize: 12 }}>不可删除</span>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>公司管理</h2>
        {isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增公司
          </Button>
        )}
      </div>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'list',
              label: '公司列表',
              children: (
                <Table
                  rowKey="id"
                  columns={columns}
                  dataSource={companies}
                  loading={loading}
                  scroll={{ x: 1200 }}
                  pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
                />
              ),
            },
            {
              key: 'users',
              label: '用户管理',
              disabled: !selectedCompany,
              children: selectedCompany ? (
                <>
                  <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      <strong>当前公司：</strong>{selectedCompany.name}
                    </span>
                    <Button type="primary" icon={<UserOutlined />} onClick={handleAddUser}>
                      新增管理员
                    </Button>
                  </div>
                  <Table
                    rowKey="id"
                    columns={userColumns}
                    dataSource={companyUsers}
                    loading={usersLoading}
                    scroll={{ x: 1000 }}
                    pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
                  />
                </>
              ) : null,
            },
          ]}
        />
      </Card>

      <Modal
        title={editingCompany ? '编辑公司' : '新增公司'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="公司名称" rules={[{ required: true, message: '请输入公司名称' }]}>
                <Input placeholder="请输入公司名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="creditCode" label="统一社会信用代码">
                <Input placeholder="请输入统一社会信用代码" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contactPerson" label="联系人">
                <Input placeholder="请输入联系人姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contactPhone" label="联系电话">
                <Input placeholder="请输入联系电话" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="address" label="公司地址">
            <Input placeholder="请输入公司地址" />
          </Form.Item>
          <Form.Item name="businessScope" label="经营范围">
            <Input.TextArea rows={3} placeholder="请输入经营范围" />
          </Form.Item>
          {!editingCompany && (
            <>
              <h4 style={{ marginTop: 16, marginBottom: 8 }}>超级管理员账号</h4>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="adminUsername" label="管理员用户名" rules={[{ required: true, message: '请输入管理员用户名' }]}>
                    <Input placeholder="请输入管理员用户名" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="adminPassword" label="管理员密码" rules={[{ required: true, message: '请输入管理员密码' }]}>
                    <Input.Password placeholder="请输入管理员密码" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="adminRealName" label="管理员真实姓名">
                <Input placeholder="请输入管理员真实姓名" />
              </Form.Item>
            </>
          )}
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新增公司管理员"
        open={userModalVisible}
        onOk={handleAddUserSubmit}
        onCancel={() => setUserModalVisible(false)}
        width={500}
        destroyOnClose
      >
        <Form form={userForm} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Form.Item name="realName" label="真实姓名" rules={[{ required: true, message: '请输入真实姓名' }]}>
            <Input placeholder="请输入真实姓名" />
          </Form.Item>
          <Form.Item name="phone" label="联系电话">
            <Input placeholder="请输入联系电话" />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input placeholder="请输入邮箱" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
