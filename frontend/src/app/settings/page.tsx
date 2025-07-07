'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '../../lib/api';

interface UserSettings {
  // 隐私设置
  profileVisibility: string;
  phoneVisibility: string;
  emailVisibility: string;
  lastSeenVisibility: string;
  allowSearchByPhone: boolean;
  allowSearchByEmail: boolean;
  
  // 通知设置
  messageNotifications: boolean;
  groupNotifications: boolean;
  friendRequestNotifications: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  
  // 聊天设置
  readReceipts: boolean;
  typingIndicators: boolean;
  autoDownloadImages: boolean;
  autoDownloadVideos: boolean;
}

const visibilityOptions = [
  { value: 'public', label: '所有人' },
  { value: 'friends', label: '仅好友' },
  { value: 'private', label: '仅自己' },
];

const lastSeenOptions = [
  { value: 'everyone', label: '所有人' },
  { value: 'contacts', label: '联系人' },
  { value: 'nobody', label: '无人' },
];

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('privacy');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { id, userId, createdAt, updatedAt, ...settingsData } = await apiRequest('/users/me/settings');
      setSettings(settingsData);
    } catch (err: any) {
      setError('获取设置失败');
      console.error(err);
    }
  };

  const handleChange = (field: keyof UserSettings, value: string | boolean) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [field]: value,
    });
  };

  const handleSave = async () => {
    if (!settings) return;
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest('/users/me/settings', {
        method: 'PATCH',
        body: JSON.stringify(settings),
      });
      setSuccess('设置保存成功');
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('确定要重置所有设置为默认值吗？')) return;
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const data = await apiRequest('/users/me/settings/reset', {
        method: 'POST',
      });
      setSettings(data);
      setSuccess('设置已重置为默认值');
    } catch (err: any) {
      setError(err.message || '重置失败');
    } finally {
      setLoading(false);
    }
  };

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">加载中...</div>
      </div>
    );
  }

  const tabs = [
    { id: 'privacy', label: '隐私设置' },
    { id: 'notifications', label: '通知设置' },
    { id: 'chat', label: '聊天设置' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900">设置</h1>
              <p className="mt-2 text-sm text-gray-600">管理您的隐私、通知和聊天偏好</p>
            </div>
            <button
              onClick={() => router.push('/profile')}
              className="text-indigo-600 hover:text-indigo-500 font-medium"
            >
              返回个人资料
            </button>
          </div>
        </div>

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

        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* 标签导航 */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* 隐私设置 */}
            {activeTab === 'privacy' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900">隐私设置</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    个人资料可见性
                  </label>
                  <select
                    value={settings.profileVisibility}
                    onChange={(e) => handleChange('profileVisibility', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {visibilityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    手机号可见性
                  </label>
                  <select
                    value={settings.phoneVisibility}
                    onChange={(e) => handleChange('phoneVisibility', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {visibilityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    邮箱可见性
                  </label>
                  <select
                    value={settings.emailVisibility}
                    onChange={(e) => handleChange('emailVisibility', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {visibilityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    最后上线时间可见性
                  </label>
                  <select
                    value={settings.lastSeenVisibility}
                    onChange={(e) => handleChange('lastSeenVisibility', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {lastSeenOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="allowSearchByPhone"
                      checked={settings.allowSearchByPhone}
                      onChange={(e) => handleChange('allowSearchByPhone', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="allowSearchByPhone" className="ml-3 text-sm text-gray-700">
                      允许通过手机号搜索到我
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="allowSearchByEmail"
                      checked={settings.allowSearchByEmail}
                      onChange={(e) => handleChange('allowSearchByEmail', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="allowSearchByEmail" className="ml-3 text-sm text-gray-700">
                      允许通过邮箱搜索到我
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* 通知设置 */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900">通知设置</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="messageNotifications"
                      checked={settings.messageNotifications}
                      onChange={(e) => handleChange('messageNotifications', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="messageNotifications" className="ml-3 text-sm text-gray-700">
                      接收消息通知
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="groupNotifications"
                      checked={settings.groupNotifications}
                      onChange={(e) => handleChange('groupNotifications', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="groupNotifications" className="ml-3 text-sm text-gray-700">
                      接收群聊通知
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="friendRequestNotifications"
                      checked={settings.friendRequestNotifications}
                      onChange={(e) => handleChange('friendRequestNotifications', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="friendRequestNotifications" className="ml-3 text-sm text-gray-700">
                      接收好友请求通知
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="emailNotifications"
                      checked={settings.emailNotifications}
                      onChange={(e) => handleChange('emailNotifications', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="emailNotifications" className="ml-3 text-sm text-gray-700">
                      接收邮件通知
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="pushNotifications"
                      checked={settings.pushNotifications}
                      onChange={(e) => handleChange('pushNotifications', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="pushNotifications" className="ml-3 text-sm text-gray-700">
                      启用推送通知
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="soundEnabled"
                      checked={settings.soundEnabled}
                      onChange={(e) => handleChange('soundEnabled', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="soundEnabled" className="ml-3 text-sm text-gray-700">
                      启用声音提醒
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="vibrationEnabled"
                      checked={settings.vibrationEnabled}
                      onChange={(e) => handleChange('vibrationEnabled', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="vibrationEnabled" className="ml-3 text-sm text-gray-700">
                      启用震动提醒
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* 聊天设置 */}
            {activeTab === 'chat' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900">聊天设置</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="readReceipts"
                      checked={settings.readReceipts}
                      onChange={(e) => handleChange('readReceipts', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="readReceipts" className="ml-3 text-sm text-gray-700">
                      发送已读回执
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="typingIndicators"
                      checked={settings.typingIndicators}
                      onChange={(e) => handleChange('typingIndicators', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="typingIndicators" className="ml-3 text-sm text-gray-700">
                      显示正在输入提示
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="autoDownloadImages"
                      checked={settings.autoDownloadImages}
                      onChange={(e) => handleChange('autoDownloadImages', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="autoDownloadImages" className="ml-3 text-sm text-gray-700">
                      自动下载图片
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="autoDownloadVideos"
                      checked={settings.autoDownloadVideos}
                      onChange={(e) => handleChange('autoDownloadVideos', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="autoDownloadVideos" className="ml-3 text-sm text-gray-700">
                      自动下载视频
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="mt-8 flex justify-between">
              <button
                onClick={handleReset}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                重置为默认
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? '保存中...' : '保存设置'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}