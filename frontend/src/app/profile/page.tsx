'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, uploadFile } from '../../lib/api';

interface UserProfile {
  id: string;
  phoneNumber: string;
  email?: string;
  username: string;
  nickname: string;
  avatarUrl?: string;
  bio?: string;
  gender?: number;
  birthday?: string;
  location?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState<Partial<UserProfile>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    // 获取用户信息
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const userData = await apiRequest('/users/me');
      setUser(userData);
      setFormData(userData);
    } catch (err) {
      setError('获取用户信息失败');
      router.push('/login');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const updatedUser = await apiRequest('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(formData),
      });

      setUser(updatedUser);
      setSuccess('个人资料更新成功');
    } catch (err: any) {
      setError(err.message || '更新失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    setError('');

    try {
      const result = await uploadFile('/users/avatar', file);
      setUser(prev => prev ? { ...prev, avatarUrl: result.avatarUrl } : null);
      setFormData(prev => ({ ...prev, avatarUrl: result.avatarUrl }));
      setSuccess('头像更新成功');
    } catch (err: any) {
      setError(err.message || '头像上传失败');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            个人资料
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            管理您的个人信息和偏好设置
          </p>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            {error && (
              <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
            
            {success && (
              <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                {success}
              </div>
            )}

            {/* 头像部分 */}
            <div className="mb-6 flex items-center space-x-6">
              <div className="shrink-0">
                <div
                  className="h-20 w-20 rounded-full overflow-hidden bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors"
                  onClick={handleAvatarClick}
                >
                  {user.avatarUrl ? (
                    <img
                      className="h-20 w-20 rounded-full object-cover"
                      src={user.avatarUrl}
                      alt="头像"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-full flex items-center justify-center bg-indigo-100 text-indigo-600">
                      <span className="text-xl font-medium">
                        {user.nickname?.charAt(0) || '用'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  disabled={avatarUploading}
                  className="bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {avatarUploading ? '上传中...' : '更换头像'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <p className="mt-2 text-xs text-gray-500">
                  JPG, GIF or PNG. 最大 5MB.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">
                    昵称
                  </label>
                  <input
                    type="text"
                    id="nickname"
                    name="nickname"
                    value={formData.nickname || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    邮箱
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
                    性别
                  </label>
                  <select
                    id="gender"
                    name="gender"
                    value={formData.gender || 0}
                    onChange={handleChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value={0}>保密</option>
                    <option value={1}>男</option>
                    <option value={2}>女</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="birthday" className="block text-sm font-medium text-gray-700">
                    生日
                  </label>
                  <input
                    type="date"
                    id="birthday"
                    name="birthday"
                    value={formData.birthday?.split('T')[0] || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                    所在地
                  </label>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={formData.location || ''}
                    onChange={handleChange}
                    placeholder="如：北京市朝阳区"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
                    个人简介
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    rows={3}
                    value={formData.bio || ''}
                    onChange={handleChange}
                    placeholder="介绍一下你自己..."
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => router.push('/chat')}
                  className="bg-gray-300 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  返回
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {loading ? '保存中...' : '保存更改'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* 账户信息 */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              账户信息
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">用户名</dt>
                <dd className="mt-1 text-sm text-gray-900">{user.username}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">手机号</dt>
                <dd className="mt-1 text-sm text-gray-900">{user.phoneNumber}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">用户ID</dt>
                <dd className="mt-1 text-sm text-gray-900 font-mono">{user.id}</dd>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}