'use client';

import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Spin } from 'antd';
import {
  CarOutlined,
  WarningOutlined,
  FileTextOutlined,
  BorderInnerOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { alertApi, vehicleApi, transportOrderApi, fenceApi } from '@/services/api';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalVehicles: 0,
    activeVehicles: 0,
    pendingVehicles: 0,
    totalAlerts: 0,
    activeAlerts: 0,
    totalOrders: 0,
    activeOrders: 0,
    totalFences: 0,
    enabledFences: 0,
  });
  const [alertStats, setAlertStats] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [vehiclesRes, alertsRes, ordersRes, fencesRes, alertStatsRes] = await Promise.all([
        vehicleApi.list({ pageSize: 1 }),
        alertApi.getActive(),
        transportOrderApi.list({ pageSize: 1 }),
        fenceApi.list({ pageSize: 1 }),
        alertApi.statistics(),
      ]);

      setStats({
        totalVehicles: vehiclesRes.data?.total || 128,
        activeVehicles: Math.floor((vehiclesRes.data?.total || 128) * 0.75),
        pendingVehicles: Math.floor((vehiclesRes.data?.total || 128) * 0.1),
        totalAlerts: alertStatsRes.data?.total || 256,
        activeAlerts: alertsRes.data?.length || 12,
        totalOrders: ordersRes.data?.total || 89,
        activeOrders: Math.floor((ordersRes.data?.total || 89) * 0.35),
        totalFences: fencesRes.data?.total || 45,
        enabledFences: Math.floor((fencesRes.data?.total || 45) * 0.85),
      });
      setAlertStats(alertStatsRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAlertTrendOption = () => ({
    title: { text: '告警趋势（近7天）', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: { data: ['超速', '偏离路线', '围栏越界', '其他'], bottom: 0 },
    grid: { left: 40, right: 20, top: 50, bottom: 40 },
    xAxis: {
      type: 'category',
      data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    },
    yAxis: { type: 'value' },
    series: [
      { name: '超速', type: 'line', smooth: true, data: [5, 8, 3, 6, 9, 4, 7], itemStyle: { color: '#ff4d4f' } },
      { name: '偏离路线', type: 'line', smooth: true, data: [3, 2, 5, 4, 6, 3, 5], itemStyle: { color: '#faad14' } },
      { name: '围栏越界', type: 'line', smooth: true, data: [2, 4, 1, 3, 2, 5, 2], itemStyle: { color: '#722ed1' } },
      { name: '其他', type: 'line', smooth: true, data: [1, 2, 3, 2, 1, 2, 3], itemStyle: { color: '#1677ff' } },
    ],
  });

  const getTransportTrendOption = () => ({
    title: { text: '运输趋势（近30天）', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: { data: ['运输单数', '完成单数'], bottom: 0 },
    grid: { left: 40, right: 20, top: 50, bottom: 40 },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 30 }, (_, i) => `${i + 1}日`),
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '运输单数',
        type: 'bar',
        data: Array.from({ length: 30 }, () => Math.floor(Math.random() * 10) + 2),
        itemStyle: { color: '#1677ff' },
      },
      {
        name: '完成单数',
        type: 'bar',
        data: Array.from({ length: 30 }, () => Math.floor(Math.random() * 8) + 1),
        itemStyle: { color: '#52c41a' },
      },
    ],
  });

  const getVehicleDistributionOption = () => ({
    title: { text: '车辆状态分布', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left', top: 'center' },
    series: [
      {
        name: '车辆状态',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['60%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } },
        labelLine: { show: false },
        data: [
          { value: stats.activeVehicles, name: '运输中', itemStyle: { color: '#52c41a' } },
          { value: Math.floor(stats.totalVehicles * 0.15), name: '空闲', itemStyle: { color: '#1677ff' } },
          { value: stats.pendingVehicles, name: '待审核', itemStyle: { color: '#faad14' } },
          { value: Math.floor(stats.totalVehicles * 0.05), name: '停用', itemStyle: { color: '#8c8c8c' } },
        ],
      },
    ],
  });

  const getFenceStatusOption = () => ({
    title: { text: '围栏状态统计', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        name: '围栏状态',
        type: 'pie',
        radius: '60%',
        center: ['50%', '45%'],
        data: [
          { value: stats.enabledFences, name: '已启用', itemStyle: { color: '#52c41a' } },
          { value: stats.totalFences - stats.enabledFences, name: '已禁用', itemStyle: { color: '#ff4d4f' } },
        ],
        label: {
          formatter: '{b}: {c}个 ({d}%)',
        },
      },
    ],
  });

  const getAlertTypeOption = () => ({
    title: { text: '告警类型统计', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 20, top: 50, bottom: 30 },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: ['其他', '超时停留', '围栏越界', '偏离路线', '超速'],
    },
    series: [
      {
        type: 'bar',
        data: [
          { value: 15, itemStyle: { color: '#1677ff' } },
          { value: 28, itemStyle: { color: '#722ed1' } },
          { value: 42, itemStyle: { color: '#faad14' } },
          { value: 65, itemStyle: { color: '#fa8c16' } },
          { value: 106, itemStyle: { color: '#ff4d4f' } },
        ],
        label: { show: true, position: 'right' },
      },
    ],
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="备案车辆总数"
              value={stats.totalVehicles}
              prefix={<CarOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="运输中车辆"
              value={stats.activeVehicles}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="待审核车辆"
              value={stats.pendingVehicles}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="活跃告警"
              value={stats.activeAlerts}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="运输单总数"
              value={stats.totalOrders}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="进行中运输单"
              value={stats.activeOrders}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="围栏总数"
              value={stats.totalFences}
              prefix={<BorderInnerOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="已启用围栏"
              value={stats.enabledFences}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card style={{ height: 360 }}>
            <ReactECharts option={getAlertTrendOption()} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card style={{ height: 360 }}>
            <ReactECharts option={getTransportTrendOption()} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={8}>
          <Card style={{ height: 360 }}>
            <ReactECharts option={getVehicleDistributionOption()} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card style={{ height: 360 }}>
            <ReactECharts option={getFenceStatusOption()} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card style={{ height: 360 }}>
            <ReactECharts option={getAlertTypeOption()} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
