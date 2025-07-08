# 🚀 新手部署指引 - Step by Step

完整的 Cloudflare Workers + AWS Serverless 部署教程，专为零基础用户设计。

## 📋 **部署前准备（预计时间：30分钟）**

### **Step 1: 创建必要账户**

#### GitHub 账户
- 访问 [GitHub](https://github.com) 注册（如果还没有）
- 用于代码托管和版本控制

#### AWS 账户
- 访问 [AWS](https://aws.amazon.com) 注册
- **重要**: 需要信用卡验证，但不会立即扣费
- 新用户享有12个月免费层，足够学习使用
- 建议设置费用告警（$10阈值）

#### Cloudflare 账户
- 访问 [Cloudflare](https://cloudflare.com) 注册
- 免费版本功能足够学习使用

### **Step 2: 安装必要工具**

#### Windows 用户
```powershell
# 1. 安装 Node.js
# 访问 https://nodejs.org 下载 LTS 版本安装

# 2. 安装 AWS CLI
# 访问 https://aws.amazon.com/cli/ 下载安装包

# 3. 验证安装
node --version
npm --version
aws --version

# 4. 安装 CLI 工具
npm install -g wrangler serverless
```

#### macOS 用户
```bash
# 1. 安装 Homebrew（如果没有）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. 安装所有工具
brew install node aws-cli
npm install -g wrangler serverless

# 3. 验证安装
node --version && npm --version && aws --version && wrangler --version && serverless --version
```

#### Linux 用户
```bash
# 1. 安装 Node.js（Ubuntu/Debian）
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. 安装 AWS CLI
sudo apt install awscli

# 3. 安装 CLI 工具
npm install -g wrangler serverless

# 4. 验证安装
node --version && npm --version && aws --version && wrangler --version && serverless --version
```

---

## 🔧 **Phase 1: AWS 基础设施部署（预计时间：45分钟）**

### **Step 3: 配置 AWS 凭证**

#### 创建 IAM 用户
1. 登录 [AWS Console](https://console.aws.amazon.com)
2. 搜索并进入 **IAM** 服务
3. 点击左侧菜单 **用户** → **创建用户**
4. 用户名填写: `fake-wechat-deploy`
5. 权限设置:
   - 直接附加策略
   - 搜索并选择 `AdministratorAccess`
   - **注意**: 生产环境应使用最小权限原则

#### 创建访问密钥
1. 在用户详情页，点击 **安全凭证** 标签
2. 点击 **创建访问密钥**
3. 选择 **CLI** 用途
4. **重要**: 立即保存 Access Key ID 和 Secret Access Key

#### 配置 AWS CLI
```bash
aws configure
# 输入内容:
# AWS Access Key ID: [你的 Access Key]
# AWS Secret Access Key: [你的 Secret Key]
# Default region name: us-east-1
# Default output format: json

# 验证配置
aws sts get-caller-identity
```

### **Step 4: 克隆项目代码**
```bash
# 克隆项目（替换为你的仓库地址）
git clone https://github.com/your-username/fake-wechat.git
cd fake-wechat

# 检查项目结构
ls -la
# 应该看到 backend/, frontend/, deployment/ 等目录
```

### **Step 5: 部署 AWS 基础设施**
```bash
# 进入部署目录
cd deployment

# 部署基础设施（这是最耗时的步骤）
aws cloudformation create-stack \
  --stack-name dev-fake-wechat-infrastructure \
  --template-body file://aws/infrastructure.yml \
  --parameters ParameterKey=Environment,ParameterValue=dev \
               ParameterKey=DatabasePassword,ParameterValue=DevPassword123! \
  --capabilities CAPABILITY_NAMED_IAM

# 等待部署完成（10-15分钟）
echo "等待基础设施部署完成，请耐心等待..."
aws cloudformation wait stack-create-complete \
  --stack-name dev-fake-wechat-infrastructure

# 检查部署状态
aws cloudformation describe-stacks \
  --stack-name dev-fake-wechat-infrastructure \
  --query 'Stacks[0].StackStatus'
```

### **Step 6: 获取基础设施信息**
```bash
# 获取数据库端点
DATABASE_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name dev-fake-wechat-infrastructure \
  --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' \
  --output text)

# 获取 Redis 端点
REDIS_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name dev-fake-wechat-infrastructure \
  --query 'Stacks[0].Outputs[?OutputKey==`RedisEndpoint`].OutputValue' \
  --output text)

# 获取 S3 存储桶名称
S3_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name dev-fake-wechat-infrastructure \
  --query 'Stacks[0].Outputs[?OutputKey==`MediaBucketName`].OutputValue' \
  --output text)

echo "数据库端点: $DATABASE_ENDPOINT"
echo "Redis 端点: $REDIS_ENDPOINT"
echo "S3 存储桶: $S3_BUCKET"
```

### **Step 7: 创建环境配置文件**
```bash
# 创建开发环境配置
cat > .env.dev << EOF
# 开发环境配置 - 自动生成
NODE_ENV=dev
DATABASE_URL=postgresql://postgres:DevPassword123!@${DATABASE_ENDPOINT}:5432/fakewechat
REDIS_URL=redis://${REDIS_ENDPOINT}:6379
JWT_SECRET=dev-jwt-secret-please-change-in-production
AWS_S3_BUCKET=${S3_BUCKET}
CLOUDFLARE_R2_BUCKET=dev-fake-wechat-media

# AWS 配置
AWS_REGION=us-east-1

# 应用配置
APP_NAME=fake-wechat-dev
APP_VERSION=1.0.0
LOG_LEVEL=debug
EOF

echo "环境配置文件已创建: .env.dev"
```

### **Step 8: 运行数据库迁移**
```bash
# 进入后端目录
cd ../backend

# 安装依赖
npm install

# 运行数据库迁移
npx prisma migrate deploy

# 生成 Prisma 客户端
npx prisma generate

# 验证数据库连接
npx prisma db seed # 如果有种子数据

# 返回部署目录
cd ../deployment
```

---

## ☁️ **Phase 2: 部署 AWS Lambda 服务（预计时间：30分钟）**

### **Step 9: 准备 Lambda 部署**
```bash
# 进入 AWS 部署目录
cd aws

# 安装依赖
npm install

# 复制环境变量
cp ../.env.dev .env

echo "Lambda 部署准备完成"
```

### **Step 10: 部署 Lambda 函数**
```bash
# 部署到 AWS（首次部署较慢）
serverless deploy --stage dev --verbose

# 获取 API Gateway URL
API_GATEWAY_URL=$(serverless info --stage dev | grep -E "endpoints:" -A 1 | tail -n 1 | awk '{print $2}' | sed 's|/{proxy+}||')

echo "API Gateway URL: $API_GATEWAY_URL"

# 保存 URL 供后续使用
echo "API_GATEWAY_URL=$API_GATEWAY_URL" > ../.api-info

# 测试 Lambda 函数
curl -s "$API_GATEWAY_URL/health" | jq . || echo "健康检查端点暂未响应"

cd ..
```

---

## 🌐 **Phase 3: Cloudflare Workers 部署（预计时间：20分钟）**

### **Step 11: 配置 Cloudflare 认证**
```bash
# 登录 Cloudflare（会打开浏览器）
wrangler login

# 验证登录
wrangler whoami
```

### **Step 12: 创建 Cloudflare 资源**
```bash
cd cloudflare

# 创建 KV 命名空间
echo "创建 KV 存储空间..."
USER_SESSIONS_ID=$(wrangler kv:namespace create "USER_SESSIONS" --preview false | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
CACHE_ID=$(wrangler kv:namespace create "CACHE" --preview false | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

# 创建 R2 存储桶
echo "创建 R2 对象存储..."
wrangler r2 bucket create dev-fake-wechat-media

echo "KV USER_SESSIONS ID: $USER_SESSIONS_ID"
echo "KV CACHE ID: $CACHE_ID"

# 保存 KV ID
echo "USER_SESSIONS_ID=$USER_SESSIONS_ID" > ../.cloudflare-info
echo "CACHE_ID=$CACHE_ID" >> ../.cloudflare-info

cd ..
```

### **Step 13: 更新 Workers 配置**
```bash
# 获取保存的信息
source .api-info
source .cloudflare-info

# 生成 wrangler.toml 配置
cd cloudflare

cat > wrangler.toml << EOF
# Cloudflare Workers 配置 - 自动生成
name = "fake-wechat-api-dev"
main = "src/index.ts"
compatibility_date = "2024-01-01"
node_compat = true

# KV 存储绑定
[[kv_namespaces]]
binding = "USER_SESSIONS"
id = "$USER_SESSIONS_ID"

[[kv_namespaces]]
binding = "CACHE"
id = "$CACHE_ID"

# R2 存储绑定
[[r2_buckets]]
binding = "MEDIA_STORAGE"
bucket_name = "dev-fake-wechat-media"

# 环境变量
[vars]
ENVIRONMENT = "development"
AWS_API_GATEWAY_URL = "$API_GATEWAY_URL"
JWT_SECRET = "dev-jwt-secret-please-change-in-production"
EOF

echo "Workers 配置已更新"
```

### **Step 14: 部署 Cloudflare Workers**
```bash
# 部署 Workers
wrangler deploy

# 获取 Workers URL
SUBDOMAIN=$(wrangler whoami | grep -o 'subdomain: [^[:space:]]*' | cut -d' ' -f2)
WORKERS_URL="https://fake-wechat-api-dev.${SUBDOMAIN}.workers.dev"

echo "Workers URL: $WORKERS_URL"

# 保存 Workers URL
echo "WORKERS_URL=$WORKERS_URL" >> ../.api-info

# 测试 Workers
curl -s "$WORKERS_URL/health" | jq . || echo "Workers 健康检查暂未响应"

cd ..
```

---

## 🖥️ **Phase 4: 前端部署（预计时间：25分钟）**

### **Step 15: 准备前端构建**
```bash
# 进入前端目录
cd ../frontend

# 安装依赖
npm install

# 获取 Workers URL
source ../deployment/.api-info

# 配置前端 API 地址
echo "NEXT_PUBLIC_API_URL=${WORKERS_URL}/api" > .env.local

echo "前端配置完成，API 地址: ${WORKERS_URL}/api"
```

### **Step 16: 构建前端**
```bash
# 构建 Next.js 应用
npm run build

# 检查构建结果
ls -la .next/
```

### **Step 17: 部署到 Cloudflare Pages**

#### 方法1: 使用 Wrangler CLI（推荐）
```bash
# 部署到 Cloudflare Pages
wrangler pages deploy .next --project-name fake-wechat-frontend-dev --compatibility-date 2024-01-01

# 记录前端 URL
FRONTEND_URL="https://fake-wechat-frontend-dev.pages.dev"
echo "前端访问地址: $FRONTEND_URL"
```

#### 方法2: GitHub 集成部署
```bash
# 1. 推送代码到 GitHub
git add .
git commit -m "Ready for Cloudflare Pages deployment"
git push origin main

# 2. 在 Cloudflare Dashboard 中:
#    - 访问 Pages 页面
#    - 点击 "连接到 Git"
#    - 选择你的 GitHub 仓库
#    - 设置构建配置:
#      * 框架: Next.js
#      * 构建命令: npm run build
#      * 输出目录: .next
#    - 部署
```

---

## 🧪 **Phase 5: 测试和验证（预计时间：15分钟）**

### **Step 18: 端到端测试**
```bash
# 返回部署目录
cd ../deployment

# 读取所有服务地址
source .api-info

echo "🧪 开始端到端测试..."

# 1. 测试 Cloudflare Workers
echo "1. 测试 Workers 健康检查..."
if curl -f -s "$WORKERS_URL/health" > /dev/null; then
    echo "✅ Workers 健康检查通过"
else
    echo "❌ Workers 健康检查失败"
fi

# 2. 测试 AWS Lambda
echo "2. 测试 Lambda 函数..."
if curl -f -s "$API_GATEWAY_URL/health" > /dev/null; then
    echo "✅ Lambda 健康检查通过"
else
    echo "❌ Lambda 健康检查失败"
fi

# 3. 测试前端访问
echo "3. 测试前端访问..."
if curl -f -s -I "https://fake-wechat-frontend-dev.pages.dev" > /dev/null; then
    echo "✅ 前端访问正常"
else
    echo "❌ 前端访问失败"
fi

# 4. 测试数据库连接（通过 API）
echo "4. 测试数据库连接..."
# 这里可以添加具体的数据库测试 API 调用

echo "✅ 基础测试完成！"
```

### **Step 19: 功能验证清单**
```bash
echo "📋 请手动测试以下功能:"
echo "  ☐ 前端页面加载"
echo "  ☐ 用户注册功能"
echo "  ☐ 用户登录功能"
echo "  ☐ 发送消息功能"
echo "  ☐ 上传头像功能"
echo "  ☐ 添加好友功能"
echo "  ☐ 实时消息（如果已实现）"
echo ""
echo "🌐 访问地址:"
echo "  前端: https://fake-wechat-frontend-dev.pages.dev"
echo "  API: $WORKERS_URL"
```

---

## 📊 **Phase 6: 监控和维护（预计时间：10分钟）**

### **Step 20: 设置 AWS 监控**
```bash
# 设置 Lambda 函数错误告警
aws cloudwatch put-metric-alarm \
  --alarm-name "fake-wechat-lambda-errors" \
  --alarm-description "Lambda function errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2

# 设置成本预算告警
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws budgets create-budget \
  --account-id $ACCOUNT_ID \
  --budget '{
    "BudgetName": "fake-wechat-dev-budget",
    "BudgetLimit": {
      "Amount": "30",
      "Unit": "USD"
    },
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }' \
  --notifications-with-subscribers '[{
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80
    },
    "Subscribers": [{
      "SubscriptionType": "EMAIL",
      "Address": "your-email@example.com"
    }]
  }]'

echo "✅ 监控告警设置完成"
```

### **Step 21: 查看日志**
```bash
# 查看 Lambda 函数日志
echo "📋 查看日志命令:"
echo "  AWS Lambda: aws logs tail /aws/lambda/fake-wechat-backend-dev-api --follow"
echo "  Cloudflare Workers: wrangler tail fake-wechat-api-dev"
echo "  前端访问日志: 在 Cloudflare Dashboard 的 Analytics 中查看"
```

---

## 🎯 **部署完成检查清单**

### **最终验证**
```bash
echo "🎯 部署完成检查清单:"
echo "  ✅ AWS 基础设施部署成功"
echo "  ✅ 数据库连接正常"
echo "  ✅ Lambda 函数运行正常"
echo "  ✅ Cloudflare Workers 代理正常"
echo "  ✅ 前端页面访问正常"
echo "  ✅ API 端点响应正常"
echo "  ✅ 监控告警设置完成"
echo "  ✅ 成本控制设置完成"
```

### **访问地址汇总**
```bash
source .api-info 2>/dev/null || true

echo ""
echo "🌟 部署成功！访问地址:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 前端应用: https://fake-wechat-frontend-dev.pages.dev"
echo "🛡️ API 代理: ${WORKERS_URL:-'请检查 Workers 部署'}"
echo "⚙️ 直接 API: ${API_GATEWAY_URL:-'请检查 Lambda 部署'}"
echo ""
echo "🧪 健康检查:"
echo "   ${WORKERS_URL:-'Workers-URL'}/health"
echo "   ${API_GATEWAY_URL:-'Lambda-URL'}/health"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💰 预期成本: ~$13-15/月 (前12个月)"
echo "📈 学习价值: 无价！"
```

---

## 🆘 **常见问题和解决方案**

### **问题1: AWS 凭证配置失败**
```bash
# 诊断命令
aws configure list
aws sts get-caller-identity

# 常见解决方案
# 1. 检查 Access Key 是否正确
# 2. 确认用户有足够权限
# 3. 检查网络连接
```

### **问题2: CloudFormation 部署失败**
```bash
# 查看详细错误
aws cloudformation describe-stack-events \
  --stack-name dev-fake-wechat-infrastructure

# 常见原因和解决方案:
# 1. 权限不足 → 确认 IAM 用户有 AdministratorAccess
# 2. 资源名称冲突 → 删除现有堆栈后重试
# 3. 配额限制 → 检查 AWS 服务配额
```

### **问题3: Wrangler 登录失败**
```bash
# 重新登录流程
wrangler logout
wrangler login

# 如果浏览器无法打开，使用 API Token
# 1. 访问 Cloudflare Dashboard
# 2. 获取 API Token
# 3. 设置环境变量: export CLOUDFLARE_API_TOKEN=your-token
```

### **问题4: 数据库连接失败**
```bash
# 诊断步骤
# 1. 检查安全组设置
aws ec2 describe-security-groups \
  --group-ids $(aws cloudformation describe-stacks \
    --stack-name dev-fake-wechat-infrastructure \
    --query 'Stacks[0].Outputs[?OutputKey==`LambdaSecurityGroup`].OutputValue' \
    --output text)

# 2. 验证数据库状态
aws rds describe-db-instances \
  --db-instance-identifier dev-fake-wechat-db

# 3. 测试网络连接（从 Lambda 内部）
```

### **问题5: 前端构建失败**
```bash
# 清理和重试
rm -rf .next node_modules
npm install
npm run build

# 检查环境变量
cat .env.local
```

---

## 🎓 **学习建议和下一步**

### **巩固学习**
1. **理解架构**: 画出完整的服务架构图
2. **监控使用**: 定期查看 AWS 和 Cloudflare 控制台
3. **成本控制**: 每周检查费用使用情况
4. **安全实践**: 定期轮换访问密钥

### **扩展功能**
1. **添加 CI/CD**: 使用 GitHub Actions 自动部署
2. **实现 WebSocket**: 添加真正的实时通讯
3. **图片处理**: 使用 Lambda 进行图片压缩
4. **国际化**: 添加多语言支持

### **生产准备**
1. **环境分离**: 创建 staging 和 production 环境
2. **安全加固**: 实施最小权限原则
3. **性能优化**: 添加 CDN 和缓存策略
4. **备份策略**: 实施数据备份和灾难恢复

---

## 🏆 **恭喜完成部署！**

您已经成功部署了一个基于现代云架构的 WeChat 克隆应用！

这个过程中您掌握了：
- ✅ AWS 云服务使用
- ✅ Cloudflare Workers 开发
- ✅ 无服务器架构设计
- ✅ 现代前端部署
- ✅ DevOps 基础实践

**现在开始享受您的云原生应用吧！** 🎉