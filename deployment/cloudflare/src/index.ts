/**
 * Cloudflare Workers API 网关服务
 * 
 * 这个 Workers 脚本作为 API 网关，处理以下功能：
 * 1. CORS 跨域处理：解决浏览器跨域请求问题
 * 2. API 代理：转发请求到 AWS Lambda
 * 3. 静态文件服务：从 R2 存储提供媒体文件
 * 4. 健康检查：提供服务状态监控
 * 5. 全球加速：利用 Cloudflare 的全球 CDN
 * 
 * 架构优势：
 * - 降低延迟：边缘计算，用户请求在最近的节点处理
 * - 减少成本：Cloudflare 免费层可处理大量请求
 * - 提高安全：内置 DDoS 防护和 WAF
 * - 简化运维：无需管理服务器和负载均衡器
 */

export default {
  /**
   * Workers 主处理函数
   * @param {Request} request - HTTP 请求对象
   * @param {Object} env - 环境变量和资源绑定
   * @param {Object} ctx - 执行上下文
   * @returns {Promise<Response>} HTTP 响应
   */
  async fetch(request, env, ctx) {
    // 解析请求 URL 和路径
    const url = new URL(request.url);
    const path = url.pathname;
    
    // 处理 CORS 预检请求
    // 浏览器在发送跨域请求前会先发送 OPTIONS 请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          // 允许所有源访问（开发环境，生产环境应限制具体域名）
          'Access-Control-Allow-Origin': '*',
          // 允许的 HTTP 方法
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          // 允许的请求头
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }
    
    // API 路由代理：转发所有 /api/ 开头的请求到 AWS Lambda
    // 这种设计允许前端通过一个统一的地址访问 API
    if (path.startsWith('/api/')) {
      // 构建 AWS API Gateway URL
      const awsUrl = `${env.AWS_API_GATEWAY_URL}${path}`;
      
      // 转发请求到 AWS Lambda
      const response = await fetch(awsUrl, {
        method: request.method,    // 保持原始 HTTP 方法
        headers: request.headers,  // 转发所有请求头
        body: request.body,        // 转发请求体（POST/PUT 数据）
      });
      
      // 为响应添加 CORS 头
      // 创建新的响应对象，保持原始内容但添加 CORS 头
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...response.headers,                    // 保持原始响应头
          'Access-Control-Allow-Origin': '*',     // 添加 CORS 头
        },
      });
      
      return newResponse;
    }
    
    // 健康检查端点
    // 用于监控系统、负载均衡器和运维工具检查服务状态
    if (path === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',                          // 服务状态
        timestamp: new Date().toISOString(),   // 当前时间戳
        environment: env.ENVIRONMENT,          // 运行环境（dev/production）
        service: 'cloudflare-workers',         // 服务标识
        version: '1.0.0',                     // 服务版本
      }), {
        headers: {
          'Content-Type': 'application/json',  // JSON 响应
          'Access-Control-Allow-Origin': '*',  // CORS 支持
        },
      });
    }
    
    // 静态文件代理：从 R2 存储服务提供媒体文件
    // 用于提供用户头像、聊天图片等静态资源
    if (path.startsWith('/static/')) {
      // 提取文件路径（移除 /static/ 前缀）
      const objectKey = path.replace('/static/', '');
      
      // 从 R2 存储桶获取文件
      // env.MEDIA_STORAGE 是在 wrangler.toml 中配置的 R2 绑定
      const object = await env.MEDIA_STORAGE.get(objectKey);
      
      // 如果文件不存在，返回 404 错误
      if (object === null) {
        return new Response('Object Not Found', { status: 404 });
      }
      
      // 返回文件内容
      return new Response(object.body, {
        headers: {
          // 设置正确的内容类型（从文件元数据获取）
          'Content-Type': object.httpMetadata.contentType || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',  // CORS 支持
          // 可选：添加缓存头
          'Cache-Control': 'public, max-age=31536000',  // 缓存 1 年
        },
      });
    }
    
    // 默认响应：如果没有匹配的路由，返回 404 错误
    // 这里可以添加其他自定义路由或返回默认页面
    return new Response('Not Found', { 
      status: 404,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
      }
    });
  },
};