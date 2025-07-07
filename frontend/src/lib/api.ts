// API 配置
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Token 管理
class TokenManager {
  private static refreshPromise: Promise<any> | null = null;

  static getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
  }

  static getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refresh_token');
  }

  static setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
  }

  static clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  }

  static async refreshAccessToken(): Promise<string | null> {
    // 防止多个并发刷新请求
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearTokens();
      return null;
    }

    this.refreshPromise = this.performRefresh(refreshToken);
    
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshPromise = null;
    }
  }

  private static async performRefresh(refreshToken: string): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Refresh failed');
      }

      const data = await response.json();
      this.setTokens(data.access_token, data.refresh_token);
      return data.access_token;
    } catch (error) {
      this.clearTokens();
      // 重定向到登录页
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return null;
    }
  }
}

// API 错误类型
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// API 请求工具函数
export const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  // 添加 access token
  const accessToken = TokenManager.getAccessToken();
  if (accessToken) {
    defaultOptions.headers = {
      ...defaultOptions.headers,
      'Authorization': `Bearer ${accessToken}`,
    };
  }

  let response = await fetch(url, defaultOptions);

  // 如果是 401 错误，尝试刷新 token
  if (response.status === 401 && accessToken) {
    const newAccessToken = await TokenManager.refreshAccessToken();
    
    if (newAccessToken) {
      // 重新发送请求
      defaultOptions.headers = {
        ...defaultOptions.headers,
        'Authorization': `Bearer ${newAccessToken}`,
      };
      response = await fetch(url, defaultOptions);
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ 
      message: getErrorMessage(response.status) 
    }));
    
    throw new ApiError(
      errorData.message || getErrorMessage(response.status),
      response.status,
      errorData.code
    );
  }

  return response.json();
};

// 文件上传工具函数
export const uploadFile = async (endpoint: string, file: File) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const formData = new FormData();
  formData.append('avatar', file);

  const accessToken = TokenManager.getAccessToken();
  const headers: HeadersInit = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });

  // 处理 401 错误
  if (response.status === 401 && accessToken) {
    const newAccessToken = await TokenManager.refreshAccessToken();
    
    if (newAccessToken) {
      headers['Authorization'] = `Bearer ${newAccessToken}`;
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ 
      message: getErrorMessage(response.status) 
    }));
    
    throw new ApiError(
      errorData.message || getErrorMessage(response.status),
      response.status,
      errorData.code
    );
  }

  return response.json();
};

// 登录函数 - 特殊处理，保存 tokens
export const login = async (credentials: { identifier: string; password: string }) => {
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });

  // 保存 tokens 和用户信息
  TokenManager.setTokens(data.access_token, data.refresh_token);
  if (typeof window !== 'undefined') {
    localStorage.setItem('user', JSON.stringify(data.user));
  }

  return data;
};

// 注册函数
export const register = async (userData: any) => {
  const data = await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  });

  // 保存 tokens 和用户信息
  TokenManager.setTokens(data.access_token, data.refresh_token);
  if (typeof window !== 'undefined') {
    localStorage.setItem('user', JSON.stringify(data.user));
  }

  return data;
};

// 登出函数
export const logout = async () => {
  try {
    const refreshToken = TokenManager.getRefreshToken();
    await apiRequest('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  } catch (error) {
    // 即使登出 API 失败，也要清除本地 tokens
    console.error('Logout API failed:', error);
  } finally {
    TokenManager.clearTokens();
  }
};

// 检查登录状态
export const isAuthenticated = (): boolean => {
  return !!TokenManager.getAccessToken();
};

// 获取用户信息
export const getCurrentUser = () => {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

// 获取完整的头像URL
export const getAvatarUrl = (avatarUrl: string | null | undefined): string | null => {
  if (!avatarUrl) return null;
  
  // 如果已经是完整URL，直接返回
  if (avatarUrl.startsWith('http')) {
    return avatarUrl;
  }
  
  // 否则拼接后端URL
  const baseUrl = API_BASE_URL.replace('/api', '');
  return `${baseUrl}${avatarUrl}`;
};

// 错误消息映射
function getErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return '请求参数错误';
    case 401:
      return '未授权，请重新登录';
    case 403:
      return '权限不足';
    case 404:
      return '请求的资源不存在';
    case 409:
      return '数据冲突';
    case 422:
      return '数据验证失败';
    case 500:
      return '服务器内部错误';
    case 502:
      return '网关错误';
    case 503:
      return '服务不可用';
    default:
      return '网络错误，请重试';
  }
}

export default API_BASE_URL;