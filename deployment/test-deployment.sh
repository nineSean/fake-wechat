#!/bin/bash

# 测试脚本
echo "🧪 开始端到端测试..."

# 测试 Cloudflare Workers
echo "1. 测试 Workers 健康检查..."
curl -s https://fake-wechat-api.your-subdomain.workers.dev/health | jq .

# 测试 AWS Lambda
echo "2. 测试 Lambda 函数..."
curl -s https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/dev/health | jq .

# 测试前端
echo "3. 测试前端访问..."
curl -s -I https://fake-wechat-frontend.pages.dev

# 测试数据库连接
echo "4. 测试数据库连接..."
curl -s -X POST https://fake-wechat-api.your-subdomain.workers.dev/api/auth/test-db

echo "✅ 测试完成！"