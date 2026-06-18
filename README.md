# 建筑垃圾跨区域清运合规核验与路线偏移预警系统

## 项目概述

本系统是针对建筑垃圾跨区域清运业务的全流程监管平台，实现车辆备案核验、装卸点电子围栏、运输轨迹比对、处置联单匹配、偏移路线告警、违规证据固化和跨部门审计留痕等核心功能。

## 技术栈

| 层级 | 技术选型 |
|------|---------|
| 前端 | Next.js 14 + React 18 + TypeScript + Ant Design 5 + ECharts + Leaflet |
| 后端 | NestJS 10 + TypeScript + TypeORM |
| 数据库 | PostgreSQL 15 + PostGIS 3.4（空间数据） |
| 缓存 | Redis 7 |
| 消息队列 | Kafka 7.5 |
| IoT 协议 | MQTT 5.0 (Eclipse Mosquitto) |
| 部署 | Docker Compose |

## 功能模块

### 1. 车辆备案核验
- 车辆信息录入（车牌、VIN、车型、载重、运输企业等）
- 驾驶员信息管理（从业资格证、联系方式等）
- 备案审核流程（提交 → 审核 → 通过/驳回）
- 车辆合法性实时核验（运输证有效期、GPS设备状态）

### 2. 装卸点电子围栏
- 支持圆形和多边形围栏绘制
- 围栏类型：装货点、卸货点、禁行区域、通行证区域
- 空间查询：点是否在围栏内、查询包含某点的所有围栏
- 围栏启用/禁用管理、作业时间配置

### 3. 运输轨迹比对
- GPS 轨迹点实时上报（单条/批量）
- 轨迹点 Redis 缓存最新位置
- 基于 Turf.js 的路线偏离计算（阈值 50 米）
- 轨迹回放与历史轨迹查询

### 4. 处置联单匹配
- 处置联单信息录入
- 自动匹配运输单（车牌、垃圾类型、重量±5%、装载日期）
- 匹配度计算与差异字段记录
- 匹配统计分析

### 5. 偏移路线告警
- 告警类型：路线偏离、围栏越界、时间违规、超载、超速、逗留超时、未备案车辆、联单不匹配
- 告警级别：信息、警告、危险、严重
- 告警生命周期：待处理 → 已确认 → 已处理 → 已关闭/已忽略
- 5 分钟内同类型告警自动聚合计数

### 6. 违规证据固化
- 证据类型：轨迹数据、图片、视频、文档、截图
- SHA256 文件哈希计算防篡改
- 证据状态流转：采集中 → 已固化 → 已审核 → 已归档
- 轨迹快照 JSON 存储

### 7. 跨部门审计留痕
- 全操作审计日志（创建、更新、删除、查询、审核、导出、登录等）
- 操作前后数据快照对比
- 变更字段详情记录
- IP 地址、User-Agent 记录
- CSV 格式导出

## 项目结构

```
zk-16/
├── backend/                          # NestJS 后端服务
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/                 # 认证与用户管理
│   │   │   ├── vehicle/              # 车辆备案
│   │   │   ├── fence/                # 电子围栏
│   │   │   ├── transport-order/      # 运输单
│   │   │   ├── track/                # 轨迹追踪
│   │   │   ├── alert/                # 告警中心
│   │   │   ├── evidence/             # 证据管理
│   │   │   ├── disposal-receipt/     # 处置联单
│   │   │   └── audit/                # 审计日志
│   │   ├── kafka/                    # Kafka 集成模块
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── Dockerfile
│   ├── package.json
│   └── .env
├── frontend/                         # Next.js 前端
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/
│   │   │   └── (dashboard)/
│   │   │       ├── dashboard/
│   │   │       ├── vehicles/
│   │   │       ├── fences/
│   │   │       ├── transport-orders/
│   │   │       ├── track/
│   │   │       ├── alerts/
│   │   │       ├── evidences/
│   │   │       ├── disposal-receipts/
│   │   │       └── audit/
│   │   ├── components/
│   │   ├── services/
│   │   └── store/
│   ├── Dockerfile
│   ├── package.json
│   └── .env.local
├── docker/
│   └── postgis/
│       └── init.sql                  # PostGIS 初始化脚本
├── docker-compose.yml                # Docker 编排
└── README.md
```

## 快速开始

### Docker Compose 部署（推荐）

```bash
# 克隆项目
git clone <repo-url>
cd zk-16

# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps
```

服务启动后访问：
- 前端管理界面: http://localhost:3000
- 后端 API: http://localhost:3001
- Swagger 文档: http://localhost:3001/api/docs
- Kafka UI: http://localhost:8080

### 默认账号

系统启动后可使用以下账号登录（需先通过注册接口创建或直接在数据库中插入）：
- 用户名：`admin`
- 密码：`admin123`

### 本地开发

```bash
# 1. 启动基础设施（PostGIS、Redis、Kafka）
docker-compose up postgis redis kafka zookeeper kafka-ui -d

# 2. 启动后端服务
cd backend
npm install
npm run start:dev

# 3. 启动前端服务（新终端）
cd frontend
npm install
npm run dev
```

## Kafka 主题

| 主题名称 | 用途 |
|---------|------|
| `track.point` | GPS 轨迹点上报 |
| `waste.alert` | 告警消息 |
| `vehicle.verify` | 车辆核验请求 |
| `fence.event` | 围栏事件 |
| `disposal.match` | 联单匹配任务 |
| `evidence.collect` | 证据采集任务 |
| `audit.log` | 审计日志 |

## 数据库设计

核心数据表：
- `users` - 用户表
- `vehicles` - 车辆备案表
- `fences` - 电子围栏表（含 PostGIS 几何字段）
- `transport_orders` - 运输单表
- `track_points` - 轨迹点表（含 PostGIS Point 字段）
- `alerts` - 告警表
- `evidences` - 证据表
- `disposal_receipts` - 处置联单表
- `audit_logs` - 审计日志表

## API 接口

所有接口均通过 Swagger 文档自动生成，访问 `http://localhost:3001/api/docs` 查看完整接口列表。

主要接口分组：
- `/auth/*` - 认证与用户管理
- `/vehicles/*` - 车辆备案
- `/fences/*` - 电子围栏
- `/transport-orders/*` - 运输单
- `/track-points/*` - 轨迹点
- `/alerts/*` - 告警
- `/evidences/*` - 证据
- `/disposal-receipts/*` - 处置联单
- `/audit-logs/*` - 审计日志

## 关键业务流程

### 合规运输流程
1. 车辆完成备案审核（状态为 approved）
2. 创建运输单，关联车辆、装货围栏、卸货围栏、规划路线
3. 车辆出发，实时上报 GPS 轨迹点
4. 系统持续比对实际轨迹与规划路线，检测偏离
5. 到达装货点自动更新状态 → 装货 → 运输中 → 到达卸货点 → 卸货
6. 卸货完成，运输单状态更新为 completed
7. 上传处置联单，与运输单进行匹配校验

### 违规告警流程
1. 轨迹偏离超过 50 米 / 越界 / 时间违规等触发
2. 系统自动创建告警记录，发送 Kafka 消息
3. 告警推送到管理端，监管人员确认
4. 采集违规证据（轨迹快照、现场照片等）
5. 证据固化（计算 SHA256 哈希）
6. 处理告警，记录处理意见
7. 所有操作全程审计留痕
