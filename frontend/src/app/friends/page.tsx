'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, getAvatarUrl } from '../../lib/api';

interface User {
  id: string;
  username: string;
  nickname: string;
  avatarUrl?: string;
  bio?: string;
  friendshipStatus?: number | null;
  isPendingRequest?: boolean;
  hasReceivedRequest?: boolean;
}

interface FriendRequest {
  id: string;
  user: User;
  createdAt: string;
}

interface Friend {
  id: string;
  username: string;
  nickname: string;
  avatarUrl?: string;
  bio?: string;
  lastLoginAt?: string;
  isOnline?: boolean;
  lastSeenAt?: string;
  onlineStatus?: string;
}

export default function FriendsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchFriends();
    fetchFriendRequests();
    if (activeTab === 'blocked') {
      fetchBlockedUsers();
    }
  }, [activeTab]);

  const fetchFriends = async () => {
    try {
      const data = await apiRequest('/friends');
      setFriends(data.friends);
    } catch (err: any) {
      console.error('获取好友列表失败:', err);
    }
  };

  const fetchFriendRequests = async () => {
    try {
      const data = await apiRequest('/friends/requests');
      setFriendRequests(data);
    } catch (err: any) {
      console.error('获取好友请求失败:', err);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest(`/users/search?q=${encodeURIComponent(query)}`);
      setSearchResults(data.users);
    } catch (err: any) {
      setError('搜索用户失败');
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (userId: string) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest('/friends/request', {
        method: 'POST',
        body: JSON.stringify({ friendId: userId }),
      });
      setSuccess('好友请求已发送');
      // 重新搜索以更新状态
      if (searchQuery) {
        await searchUsers(searchQuery);
      }
    } catch (err: any) {
      setError(err.message || '发送好友请求失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFriendRequest = async (requestId: string, action: 'accept' | 'reject') => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest(`/friends/requests/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });
      setSuccess(action === 'accept' ? '已接受好友请求' : '已拒绝好友请求');
      await fetchFriendRequests();
      if (action === 'accept') {
        await fetchFriends();
      }
    } catch (err: any) {
      setError(err.message || '处理好友请求失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchBlockedUsers = async () => {
    try {
      const data = await apiRequest('/friends/blocked');
      setBlockedUsers(data.blockedUsers);
    } catch (err: any) {
      console.error('获取拉黑列表失败:', err);
    }
  };

  const blockUser = async (userId: string) => {
    if (!confirm('确定要拉黑这个用户吗？拉黑后将解除好友关系。')) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest(`/friends/${userId}/block`, {
        method: 'POST',
      });
      setSuccess('已拉黑用户');
      await fetchFriends();
      await fetchBlockedUsers();
    } catch (err: any) {
      setError(err.message || '拉黑用户失败');
    } finally {
      setLoading(false);
    }
  };

  const unblockUser = async (userId: string) => {
    if (!confirm('确定要取消拉黑这个用户吗？')) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest(`/friends/${userId}/block`, {
        method: 'DELETE',
      });
      setSuccess('已取消拉黑');
      await fetchBlockedUsers();
    } catch (err: any) {
      setError(err.message || '取消拉黑失败');
    } finally {
      setLoading(false);
    }
  };

  const deleteFriend = async (friendId: string) => {
    if (!confirm('确定要删除这个好友吗？')) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest(`/friends/${friendId}`, {
        method: 'DELETE',
      });
      setSuccess('已删除好友');
      await fetchFriends();
    } catch (err: any) {
      setError(err.message || '删除好友失败');
    } finally {
      setLoading(false);
    }
  };

  const getButtonText = (user: User) => {
    if (user.friendshipStatus === 1) return '已是好友';
    if (user.isPendingRequest) return '已发送请求';
    if (user.hasReceivedRequest) return '待处理';
    if (user.friendshipStatus === 2) return '已拒绝';
    if (user.friendshipStatus === 3) return '已拉黑';
    return '添加好友';
  };

  const getButtonDisabled = (user: User) => {
    return user.friendshipStatus === 1 || user.isPendingRequest || user.friendshipStatus === 3;
  };

  const getOnlineStatusText = (onlineStatus?: string) => {
    switch (onlineStatus) {
      case 'online':
        return '在线';
      case 'recently':
        return '刚刚在线';
      case 'unknown':
        return '';
      case 'long_ago':
        return '很久未上线';
      default:
        return onlineStatus || '';
    }
  };

  const getOnlineStatusColor = (onlineStatus?: string) => {
    switch (onlineStatus) {
      case 'online':
        return 'text-green-500';
      case 'recently':
        return 'text-green-400';
      default:
        return 'text-gray-400';
    }
  };

  const tabs = [
    { id: 'friends', label: `好友 (${friends.length})` },
    { id: 'requests', label: `好友请求 (${friendRequests.length})` },
    { id: 'search', label: '添加好友' },
    { id: 'blocked', label: `拉黑列表 (${blockedUsers.length})` },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900">好友管理</h1>
              <p className="mt-2 text-sm text-gray-600">管理您的好友关系</p>
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
            {/* 好友列表 */}
            {activeTab === 'friends' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">我的好友</h3>
                {friends.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">还没有好友，去添加一些好友吧！</p>
                ) : (
                  <div className="space-y-4">
                    {friends.map((friend) => (
                      <div key={friend.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-100">
                            {friend.avatarUrl ? (
                              <img
                                className="h-12 w-12 rounded-full object-cover"
                                src={getAvatarUrl(friend.avatarUrl) || ''}
                                alt="头像"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-full flex items-center justify-center bg-indigo-100 text-indigo-600">
                                <span className="text-sm font-medium">
                                  {friend.nickname?.charAt(0) || '友'}
                                </span>
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{friend.nickname}</p>
                            <p className="text-sm text-gray-500">@{friend.username}</p>
                            {friend.bio && <p className="text-xs text-gray-400 mt-1">{friend.bio}</p>}
                            {friend.onlineStatus && (
                              <p className={`text-xs mt-1 ${getOnlineStatusColor(friend.onlineStatus)}`}>
                                {getOnlineStatusText(friend.onlineStatus)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => router.push(`/chat/${friend.id}`)}
                            className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                          >
                            聊天
                          </button>
                          <button
                            onClick={() => blockUser(friend.id)}
                            className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
                            disabled={loading}
                          >
                            拉黑
                          </button>
                          <button
                            onClick={() => deleteFriend(friend.id)}
                            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                            disabled={loading}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 好友请求 */}
            {activeTab === 'requests' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">好友请求</h3>
                {friendRequests.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">暂无好友请求</p>
                ) : (
                  <div className="space-y-4">
                    {friendRequests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-100">
                            {request.user.avatarUrl ? (
                              <img
                                className="h-12 w-12 rounded-full object-cover"
                                src={getAvatarUrl(request.user.avatarUrl) || ''}
                                alt="头像"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-full flex items-center justify-center bg-indigo-100 text-indigo-600">
                                <span className="text-sm font-medium">
                                  {request.user.nickname?.charAt(0) || '用'}
                                </span>
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{request.user.nickname}</p>
                            <p className="text-sm text-gray-500">@{request.user.username}</p>
                            {request.user.bio && <p className="text-xs text-gray-400 mt-1">{request.user.bio}</p>}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleFriendRequest(request.id, 'accept')}
                            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                            disabled={loading}
                          >
                            接受
                          </button>
                          <button
                            onClick={() => handleFriendRequest(request.id, 'reject')}
                            className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                            disabled={loading}
                          >
                            拒绝
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 添加好友 */}
            {activeTab === 'search' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">添加好友</h3>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="搜索用户名、昵称或邮箱..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchUsers(searchQuery)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button
                    onClick={() => searchUsers(searchQuery)}
                    disabled={loading || !searchQuery.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    搜索
                  </button>
                </div>

                {loading && <p className="text-center text-gray-500">搜索中...</p>}

                {searchResults.length > 0 && (
                  <div className="space-y-4">
                    {searchResults.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-100">
                            {user.avatarUrl ? (
                              <img
                                className="h-12 w-12 rounded-full object-cover"
                                src={getAvatarUrl(user.avatarUrl) || ''}
                                alt="头像"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-full flex items-center justify-center bg-indigo-100 text-indigo-600">
                                <span className="text-sm font-medium">
                                  {user.nickname?.charAt(0) || '用'}
                                </span>
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{user.nickname}</p>
                            <p className="text-sm text-gray-500">@{user.username}</p>
                            {user.bio && <p className="text-xs text-gray-400 mt-1">{user.bio}</p>}
                          </div>
                        </div>
                        <button
                          onClick={() => sendFriendRequest(user.id)}
                          disabled={getButtonDisabled(user) || loading}
                          className={`px-3 py-1 text-sm rounded ${
                            getButtonDisabled(user)
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                        >
                          {getButtonText(user)}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {searchQuery && !loading && searchResults.length === 0 && (
                  <p className="text-center text-gray-500 py-8">未找到相关用户</p>
                )}
              </div>
            )}

            {/* 拉黑列表 */}
            {activeTab === 'blocked' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">拉黑列表</h3>
                {blockedUsers.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">暂无拉黑用户</p>
                ) : (
                  <div className="space-y-4">
                    {blockedUsers.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-100">
                            {user.avatarUrl ? (
                              <img
                                className="h-12 w-12 rounded-full object-cover"
                                src={getAvatarUrl(user.avatarUrl) || ''}
                                alt="头像"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-full flex items-center justify-center bg-gray-100 text-gray-400">
                                <span className="text-sm font-medium">
                                  {user.nickname?.charAt(0) || '用'}
                                </span>
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{user.nickname}</p>
                            <p className="text-sm text-gray-500">@{user.username}</p>
                            {user.bio && <p className="text-xs text-gray-400 mt-1">{user.bio}</p>}
                          </div>
                        </div>
                        <button
                          onClick={() => unblockUser(user.id)}
                          className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                          disabled={loading}
                        >
                          取消拉黑
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}