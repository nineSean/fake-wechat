# Fake WeChat 部署指南

## 📋 准备工作

### 1. 前置要求
- **账户准备**：
  - AWS 账户（需要信用卡，但有12个月免费层）
  - Cloudflare 账户（免费版本足够）
  - GitHub 账户（用于代码管理）

### 2. 工具安装
```bash
# 安装 Node.js (https://nodejs.org)
node --version  # 需要 18+

# 安装 AWS CLI
# Mac: brew install awscli
# Windows: https://aws.amazon.com/cli/
# Linux: sudo apt install awscli

# 安装 Cloudflare CLI
npm install -g wrangler

# 安装 Serverless Framework
npm install -g serverless

# 验证安装
node --version && npm --version && aws --version && wrangler --version && serverless --version
```

## ⚙️ 配置凭证

### 1. AWS 配置
```bash
# 在 AWS Console 创建 IAM 用户
# 访问 AWS Console -> IAM -> 用户 -> 创建用户
# 用户名: fake-wechat-deploy
# 权限策略: AdministratorAccess

# 配置 AWS CLI
aws configure
# 输入 Access Key ID
# 输入 Secret Access Key
# 输入 us-east-1 (区域)
# 输入 json (输出格式)
```

### 2. Cloudflare 配置
```bash
# 登录 Cloudflare
wrangler login
```

## 🚀 部署步骤

### 方式一：一键部署（推荐）
```bash
# 克隆项目
git clone <your-repo-url>
cd fake-wechat/deployment

# 执行部署脚本
chmod +x deploy.sh
./deploy.sh
```

### 方式二：手动部署

#### 步骤 1：部署 AWS 基础设施（10-15分钟）
```bash
cd deployment

# 部署 CloudFormation 堆栈
aws cloudformation create-stack \
  --stack-name dev-fake-wechat-infrastructure \
  --template-body file://aws/infrastructure.yml \
  --parameters ParameterKey=Environment,ParameterValue=dev \
               ParameterKey=DatabasePassword,ParameterValue=DevPassword123! \
  --capabilities CAPABILITY_NAMED_IAM

# 等待部署完成
aws cloudformation wait stack-create-complete \
  --stack-name dev-fake-wechat-infrastructure
```

#### 步骤 2：获取基础设施信息
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

# 获取 S3 存储桶
S3_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name dev-fake-wechat-infrastructure \
  --query 'Stacks[0].Outputs[?OutputKey==`MediaBucketName`].OutputValue' \
  --output text)
```

#### 步骤 3：创建环境变量文件
```bash
# 创建 .env.dev 文件
cat > .env.dev << EOF
NODE_ENV=dev
DATABASE_URL=postgresql://postgres:DevPassword123!@${DATABASE_ENDPOINT}:5432/fakewechat
REDIS_URL=redis://${REDIS_ENDPOINT}:6379
JWT_SECRET=dev-jwt-secret-please-change-in-production
AWS_S3_BUCKET=${S3_BUCKET}
CLOUDFLARE_R2_BUCKET=dev-fake-wechat-media
AWS_REGION=us-east-1
EOF
```

#### 步骤 4：运行数据库迁移
```bash
cd ../backend
npm install
npx prisma migrate deploy
npx prisma generate
cd ../deployment
```

#### 步骤 5：部署 AWS Lambda（3-5分钟）
```bash
cd aws
npm install
cp ../.env.dev .env
serverless deploy --stage dev
cd ..
```

#### 步骤 6：创建 Cloudflare 资源（2-3分钟）
```bash
cd cloudflare

# 创建 KV 命名空间
wrangler kv:namespace create "USER_SESSIONS"
wrangler kv:namespace create "CACHE"

# 创建 R2 存储桶
wrangler r2 bucket create dev-fake-wechat-media

cd ..
```

#### 步骤 7：更新 Cloudflare 配置
```bash
# 获取 API Gateway URL
API_GATEWAY_URL=$(cd aws && serverless info --stage dev | grep "endpoints:" -A 1 | tail -n 1 | awk '{print $2}' | sed 's|/{proxy+}||')

# 获取 KV 命名空间 ID（从上一步的输出中获取）
USER_SESSIONS_ID="your-user-sessions-id"
CACHE_ID="your-cache-id"

# 更新 wrangler.toml
cd cloudflare
cat > wrangler.toml << EOF
name = "fake-wechat-api-dev"
main = "src/index.ts"
compatibility_date = "2024-01-01"
node_compat = true

[[kv_namespaces]]
binding = "USER_SESSIONS"
id = "$USER_SESSIONS_ID"

[[kv_namespaces]]
binding = "CACHE"
id = "$CACHE_ID"

[[r2_buckets]]
binding = "MEDIA_STORAGE"
bucket_name = "dev-fake-wechat-media"

[vars]
ENVIRONMENT = "development"
AWS_API_GATEWAY_URL = "$API_GATEWAY_URL"
JWT_SECRET = "dev-jwt-secret-please-change-in-production"
EOF
```

#### 步骤 8：部署 Cloudflare Workers
```bash
wrangler deploy
cd ..
```

#### 步骤 9：部署前端（5-8分钟）
```bash
cd ../frontend
npm install

# 设置环境变量
echo "NEXT_PUBLIC_API_URL=https://fake-wechat-api-dev.your-subdomain.workers.dev/api" > .env.local

# 构建并部署
npm run build
wrangler pages deploy .next --project-name fake-wechat-frontend-dev
```

## 🧪 测试部署

### 1. 健康检查
```bash
# 测试 Workers
curl https://fake-wechat-api-dev.your-subdomain.workers.dev/health

# 测试 Lambda
curl https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/health
```

### 2. 运行测试脚本
```bash
cd deployment
chmod +x test-deployment.sh
./test-deployment.sh
```

## 🎯 访问地址

部署完成后，你将获得：
- **前端**: https://fake-wechat-frontend-dev.pages.dev
- **API 代理**: https://fake-wechat-api-dev.your-subdomain.workers.dev
- **直接 API**: https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com

## 💰 成本预估

- **前12个月（AWS 免费层）**: ~$13-15/月
- **12个月后**: ~$26-30/月

## 🔧 本地开发

如果需要本地开发，可以使用 Docker Compose：
```bash
cd deployment
docker-compose up -d
```

## 🛠️ 故障排除

### 常见问题
1. **AWS 凭证错误**: 运行 `aws configure` 重新配置
2. **CloudFormation 失败**: 检查 `aws cloudformation describe-stack-events`
3. **Wrangler 登录失败**: 运行 `wrangler logout && wrangler login`
4. **数据库连接失败**: 检查安全组和 VPC 配置

### 日志查看
```bash
# AWS Lambda 日志
aws logs tail /aws/lambda/fake-wechat-backend-dev-api --follow

# Workers 日志
wrangler tail fake-wechat-api-dev
```

## 🧹 清理资源

```bash
# 删除 Cloudflare 资源
wrangler kv:namespace delete USER_SESSIONS_ID
wrangler r2 bucket delete dev-fake-wechat-media

# 删除 Serverless 服务
cd deployment/aws
serverless remove --stage dev

# 删除 CloudFormation 堆栈
aws cloudformation delete-stack --stack-name dev-fake-wechat-infrastructure
```

这份指南提供了完整的部署流程，包括自动化脚本和手动步骤两种方式。建议先尝试一键部署脚本，如果遇到问题再按照手动步骤进行。