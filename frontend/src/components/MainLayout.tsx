'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Layout, Menu, Avatar, Dropdown, Button, message } from 'antd';
import {
  DashboardOutlined,
  CarOutlined,
  BorderInnerOutlined,
  FileTextOutlined,
  EnvironmentOutlined,
  WarningOutlined,
  CameraOutlined,
  FormOutlined,
  AuditOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
  BankOutlined,
  TeamOutlined,
  MonitorOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/store/auth';

const { Header, Sider, Content } = Layout;

const allMenuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘', roles: ['admin', 'supervision', 'department_auditor', 'transport_enterprise', 'company_super_admin', 'company_admin'] },
  { key: '/companies', icon: <BankOutlined />, label: '公司管理', roles: ['admin'] },
  { key: '/vehicles', icon: <CarOutlined />, label: '车辆备案', roles: ['admin', 'supervision', 'department_auditor', 'transport_enterprise', 'company_super_admin', 'company_admin'] },
  { key: '/vehicle-monitor', icon: <MonitorOutlined />, label: '车辆监控', roles: ['admin', 'supervision', 'department_auditor', 'company_super_admin', 'company_admin'] },
  { key: '/fences', icon: <BorderInnerOutlined />, label: '电子围栏', roles: ['admin', 'supervision', 'department_auditor', 'company_super_admin', 'company_admin'] },
  { key: '/transport-orders', icon: <FileTextOutlined />, label: '运输单', roles: ['admin', 'supervision', 'department_auditor', 'transport_enterprise', 'company_super_admin', 'company_admin'] },
  { key: '/track', icon: <EnvironmentOutlined />, label: '轨迹监控', roles: ['admin', 'supervision', 'department_auditor', 'company_super_admin', 'company_admin'] },
  { key: '/alerts', icon: <WarningOutlined />, label: '告警中心', roles: ['admin', 'supervision', 'department_auditor', 'company_super_admin', 'company_admin'] },
  { key: '/evidences', icon: <CameraOutlined />, label: '证据管理', roles: ['admin', 'supervision', 'department_auditor', 'company_super_admin', 'company_admin'] },
  { key: '/disposal-receipts', icon: <FormOutlined />, label: '处置联单', roles: ['admin', 'supervision', 'department_auditor', 'company_super_admin', 'company_admin'] },
  { key: '/audit', icon: <AuditOutlined />, label: '审计日志', roles: ['admin', 'supervision', 'company_super_admin', 'company_admin'] },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuthStore();

  const menuItems = allMenuItems.filter((item) => {
    if (!user?.role) return false;
    return item.roles?.includes(user.role);
  });

  const selectedKey = menuItems.find((item) => pathname.startsWith(item.key))?.key || '/dashboard';

  const handleMenuClick = ({ key }: { key: string }) => {
    router.push(key);
  };

  const handleLogout = () => {
    logout();
    message.success('已退出登录');
    router.replace('/login');
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{ background: '#001529' }}
        width={220}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: collapsed ? 14 : 18,
            fontWeight: 600,
            background: 'rgba(255,255,255,0.05)',
          }}
        >
          {collapsed ? '监管' : '危废运输监管'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,21,41,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16, width: 64, height: 64 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button type="text" icon={<BellOutlined />} style={{ fontSize: 16 }} />
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 8 }}>
                <Avatar icon={<UserOutlined />} />
                <span>{user?.name || user?.username || '用户'}</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content
          style={{
            margin: 16,
            padding: 24,
            background: '#f0f2f5',
            borderRadius: 4,
            minHeight: 'calc(100vh - 112px)',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
