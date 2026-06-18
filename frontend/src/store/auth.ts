import { create } from 'zustand';
import { parseCookies, setCookie, destroyCookie } from 'nookies';
import { authApi } from '@/services/api';

interface User {
  id: string;
  username: string;
  name?: string;
  realName?: string;
  role?: string;
  companyId?: string;
  isCompanySuperAdmin?: boolean;
  [key: string]: any;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  checkAuth: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  login: async (username: string, password: string) => {
    const res = await authApi.login({ username, password });
    const { accessToken, user } = res.data;
    
    setCookie(null, 'token', accessToken, {
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    set({
      token: accessToken,
      user,
      isAuthenticated: true,
    });
  },

  logout: () => {
    destroyCookie(null, 'token', { path: '/' });
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },

  fetchUser: async () => {
    try {
      const res = await authApi.getCurrentUser();
      set({
        user: res.data,
        isAuthenticated: true,
      });
    } catch (error) {
      get().logout();
      throw error;
    }
  },

  checkAuth: () => {
    const cookies = parseCookies();
    const token = cookies['token'];
    if (token) {
      set({ token, isAuthenticated: true });
      return true;
    }
    return false;
  },
}));
