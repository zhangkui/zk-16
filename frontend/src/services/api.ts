import axios from 'axios';
import { parseCookies, destroyCookie } from 'nookies';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const cookies = parseCookies();
    const token = cookies['token'];
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const mapCompanyName = (data: any): any => {
  if (!data || typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(mapCompanyName);
  }

  const mapped = { ...data };
  if (mapped.companyName !== undefined && mapped.company === undefined) {
    mapped.company = mapped.companyName;
  }

  Object.keys(mapped).forEach((key) => {
    if (mapped[key] && typeof mapped[key] === 'object') {
      mapped[key] = mapCompanyName(mapped[key]);
    }
  });

  return mapped;
};

api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.data && response.data.total !== undefined) {
      response.data.list = response.data.data;
    }

    if (response.data && typeof response.data === 'object') {
      response.data = mapCompanyName(response.data);
    }

    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      destroyCookie(null, 'token');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

export const authApi = {
  login: (data: { username: string; password: string }) =>
    api.post('/auth/login', data),
  register: (data: any) => api.post('/auth/register', data),
  getCurrentUser: () => api.get('/auth/profile'),
  getUsers: (params?: any) => api.get('/auth/users', { params }),
};

export const vehicleApi = {
  create: (data: any) => api.post('/vehicles', data),
  list: (params?: any) => api.get('/vehicles', { params }),
  get: (id: string) => api.get(`/vehicles/${id}`),
  getByPlate: (plateNumber: string) => api.get(`/vehicles/plate/${plateNumber}`),
  verify: (plateNumber: string) => api.get('/vehicles/verify', { params: { plateNumber } }),
  approve: (id: string, data: any) => api.patch(`/vehicles/${id}/approve`, data),
  reject: (id: string, data: any) => api.patch(`/vehicles/${id}/reject`, data),
  update: (id: string, data: any) => api.patch(`/vehicles/${id}`, data),
  remove: (id: string) => api.delete(`/vehicles/${id}`),
};

export const fenceApi = {
  create: (data: any) => api.post('/fences', data),
  list: (params?: any) => api.get('/fences', { params }),
  get: (id: string) => api.get(`/fences/${id}`),
  getByType: (type: string) => api.get(`/fences/type/${type}`),
  checkPoint: (id: string, data: any) => api.post(`/fences/${id}/check-point`, data),
  findContainingPoint: (params: any) => api.get('/fences/contain-point', { params }),
  update: (id: string, data: any) => api.patch(`/fences/${id}`, data),
  updateCoordinates: (id: string, data: any) => api.patch(`/fences/${id}/coordinates`, data),
  toggleStatus: (id: string, data: any) => api.patch(`/fences/${id}/toggle-status`, data),
  remove: (id: string) => api.delete(`/fences/${id}`),
};

export const transportOrderApi = {
  create: (data: any) => api.post('/transport-orders', data),
  list: (params?: any) => api.get('/transport-orders', { params }),
  get: (id: string) => api.get(`/transport-orders/${id}`),
  getByOrderNo: (orderNo: string) => api.get(`/transport-orders/order-no/${orderNo}`),
  getActiveByVehicle: (vehicleId: string) => api.get(`/transport-orders/vehicle/${vehicleId}/active`),
  updateStatus: (id: string, data: any) => api.patch(`/transport-orders/${id}/status`, data),
  recordDeviation: (id: string, data: any) => api.patch(`/transport-orders/${id}/deviation`, data),
  complete: (id: string) => api.patch(`/transport-orders/${id}/complete`),
  cancel: (id: string) => api.patch(`/transport-orders/${id}/cancel`),
  update: (id: string, data: any) => api.patch(`/transport-orders/${id}`, data),
  remove: (id: string) => api.delete(`/transport-orders/${id}`),
};

export const trackApi = {
  create: (data: any) => api.post('/track/point', data),
  batchCreate: (data: any[]) => api.post('/track/points', data),
  getByOrder: (transportOrderId: string, params?: any) =>
    api.get(`/track/order/${transportOrderId}`, { params }),
  list: (params?: any) => api.get('/track', { params }),
  getLatestPosition: (plateNumber: string) => api.get(`/track/latest/${plateNumber}`),
  getLatestPositions: (params?: any) => api.post('/track/latest/batch', params),
};

export const alertApi = {
  list: (params?: any) => api.get('/alerts', { params }),
  get: (id: string) => api.get(`/alerts/${id}`),
  acknowledge: (id: string, data: any) => api.patch(`/alerts/${id}/acknowledge`, data),
  process: (id: string, data: any) => api.patch(`/alerts/${id}/process`, data),
  close: (id: string, data: any) => api.patch(`/alerts/${id}/close`, data),
  getActive: () => api.get('/alerts/active'),
  statistics: (params?: any) => api.get('/alerts/statistics', { params }),
};

export const evidenceApi = {
  create: (data: any) => api.post('/evidences', data),
  list: (params?: any) => api.get('/evidences', { params }),
  get: (id: string) => api.get(`/evidences/${id}`),
  getByAlert: (alertId: string) => api.get(`/evidences/alert/${alertId}`),
  fix: (id: string, data: any) => api.patch(`/evidences/${id}/fix`, data),
  verify: (id: string, data: any) => api.patch(`/evidences/${id}/verify`, data),
  archive: (id: string) => api.patch(`/evidences/${id}/archive`),
};

export const disposalReceiptApi = {
  create: (data: any) => api.post('/disposal-receipts', data),
  list: (params?: any) => api.get('/disposal-receipts', { params }),
  get: (id: string) => api.get(`/disposal-receipts/${id}`),
  getByReceiptNo: (receiptNo: string) => api.get(`/disposal-receipts/receipt-no/${receiptNo}`),
  getUnmatched: () => api.get('/disposal-receipts/unmatched'),
  getStatistics: () => api.get('/disposal-receipts/statistics'),
  match: (id: string, data: any) => api.patch(`/disposal-receipts/${id}/match`, data),
  update: (id: string, data: any) => api.patch(`/disposal-receipts/${id}`, data),
  remove: (id: string) => api.delete(`/disposal-receipts/${id}`),
};

export const auditApi = {
  list: (params?: any) => api.get('/audit/logs', { params }),
  export: (params?: any) => api.get('/audit/logs/export', { params, responseType: 'blob' }),
};

export const companyApi = {
  create: (data: any) => api.post('/companies', data),
  list: (params?: any) => api.get('/companies', { params }),
  get: (id: string) => api.get(`/companies/${id}`),
  update: (id: string, data: any) => api.patch(`/companies/${id}`, data),
  remove: (id: string) => api.delete(`/companies/${id}`),
  getUsers: (companyId: string, params?: any) => api.get(`/companies/${companyId}/users`, { params }),
  createUser: (companyId: string, data: any) => api.post(`/companies/${companyId}/users`, data),
  removeUser: (companyId: string, userId: string) => api.delete(`/companies/${companyId}/users/${userId}`),
};

export const simulationApi = {
  start: (data?: any) => api.post('/simulation/start', data),
  stop: () => api.post('/simulation/stop'),
  status: () => api.get('/simulation/status'),
  addVehicle: (data: any) => api.post('/simulation/vehicles', data),
  removeVehicle: (plateNumber: string) => api.delete(`/simulation/vehicles/${plateNumber}`),
  updateTarget: (plateNumber: string, data: any) => api.patch(`/simulation/vehicles/${plateNumber}/target`, data),
  setSpeed: (plateNumber: string, data: any) => api.patch(`/simulation/vehicles/${plateNumber}/speed`, data),
  reset: () => api.post('/simulation/reset'),
};
