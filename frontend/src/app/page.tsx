'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '../lib/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // 检查登录状态
    if (isAuthenticated()) {
      // 已登录，跳转到个人资料页面
      router.push('/profile');
    } else {
      // 未登录，跳转到登录页面
      router.push('/login');
    }
  }, [router]);

  // 显示加载状态
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">正在检查登录状态...</p>
      </div>
    </div>
  );
}
