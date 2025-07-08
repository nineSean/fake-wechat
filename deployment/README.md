# 🚀 Fake WeChat 部署指南

基于 Cloudflare Workers + AWS Serverless 的 WeChat 克隆应用部署文档。

## 🏗️ 架构概述

这是一个混合云部署方案，充分利用了 Cloudflare 和 AWS 的优势：

- **Cloudflare Workers**: 作为 API 网关和边缘计算，提供全球分发和CORS处理
- **AWS Lambda**: 核心业务逻辑处理，包括用户认证、消息处理等
- **AWS RDS**: PostgreSQL 数据库，存储用户数据和消息记录
- **AWS ElastiCache**: Redis 缓存，提升性能和会话管理
- **AWS S3**: 文件存储，用于头像、图片等静态资源
- **Cloudflare R2**: 备用存储，更低成本的媒体文件存储
- **Cloudflare Pages**: 前端静态网站托管

这种架构的优势：
1. **成本优化**: 利用 Cloudflare 免费层和 AWS 免费层
2. **全球性能**: Cloudflare 全球 CDN 加速
3. **可扩展性**: 无服务器架构，自动伸缩
4. **学习价值**: 涵盖现代云服务的核心概念

## 📋 前置要求

### 必需账户
- [x] **GitHub 账户**（代码托管）
  - 用于版本控制和 CI/CD 集成
  - 可选：用于 Cloudflare Pages 自动部署

- [x] **AWS 账户**（需要信用卡验证，但有12个月免费层）
  - 免费层包含：750小时 Lambda 执行时间，20GB RDS 存储，5GB S3 存储
  - 预计成本：前12个月 $0-15/月，之后 $25-35/月

- [x] **Cloudflare 账户**（免费版本足够）
  - 免费层包含：无限 Workers 请求，10GB R2 存储，500MB Pages 带宽
  - 预计成本：$0-5/月

### 必需工具
- [x] **Node.js 18+** 和 **npm**
  - 用于运行构建脚本和依赖管理
  - 检查版本：`node --version` (应该 >= 18.0.0)

- [x] **AWS CLI**
  - 用于管理 AWS 资源和部署
  - 需要配置访问密钥和区域

- [x] **Wrangler (Cloudflare CLI)**
  - 用于部署 Workers 和管理 Cloudflare 资源
  - 需要登录 Cloudflare 账户

- [x] **Serverless Framework**
  - 用于简化 AWS Lambda 部署
  - 支持 CloudFormation 模板管理

## 🔧 快速安装工具

```bash
# 1. 安装 Node.js
# 访问 https://nodejs.org 下载安装 LTS 版本
# 建议使用 nvm 管理多版本：
# curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
# nvm install 18
# nvm use 18

# 2. 安装 AWS CLI
# Windows: 从 https://aws.amazon.com/cli/ 下载 MSI 安装包
# Mac: brew install awscli
# Linux: sudo apt install awscli
# 或者使用 pip：pip install awscli

# 3. 安装 Cloudflare CLI
# 全局安装 Wrangler
npm install -g wrangler

# 4. 安装 Serverless Framework
# 全局安装 Serverless
npm install -g serverless

# 验证安装
echo "检查所有工具版本："
node --version && npm --version && aws --version && wrangler --version && serverless --version

# 预期输出示例：
# v18.x.x
# 9.x.x
# aws-cli/2.x.x
# wrangler 3.x.x
# Framework Core: 3.x.x
```

## ⚙️ 配置凭证

### AWS 配置
```bash
# 1. 在 AWS Console 创建 IAM 用户
# 访问 AWS Console -> IAM -> 用户 -> 创建用户
# 用户名: fake-wechat-deploy
# 权限策略: AdministratorAccess

# 2. 创建访问密钥并配置
aws configure
```

### Cloudflare 配置
```bash
# 登录 Cloudflare
wrangler login
```

## 🚀 一键部署

```bash
# 克隆仓库
git clone <your-repo-url>
cd fake-wechat

# 进入部署目录
cd deployment

# 执行部署脚本
chmod +x deploy.sh
./deploy.sh
```

## 📊 部署过程详解

### Phase 1: AWS 基础设施 (10-15分钟)
- ✅ 创建 VPC 网络
- ✅ 部署 RDS PostgreSQL 数据库
- ✅ 设置 ElastiCache Redis
- ✅ 创建 S3 存储桶
- ✅ 配置安全组和 IAM 角色

### Phase 2: Lambda 函数部署 (3-5分钟)
- ✅ 统一 API 入口部署
- ✅ 健康检查端点
- ✅ WebSocket 支持（可选）

### Phase 3: Cloudflare 资源 (2-3分钟)
- ✅ 创建 KV 存储空间
- ✅ 设置 R2 对象存储
- ✅ 部署 Workers API 代理

### Phase 4: 前端部署 (5-8分钟)
- ✅ Next.js 应用构建
- ✅ 部署到 Cloudflare Pages

## 🎯 部署结果

### 访问地址
- **前端**: https://fake-wechat-frontend-dev.pages.dev
- **API 代理**: https://fake-wechat-api-dev.your-subdomain.workers.dev
- **直接 API**: https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com

### 健康检查
```bash
# 测试 Workers
curl https://fake-wechat-api-dev.your-subdomain.workers.dev/health

# 测试 Lambda
curl https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/health
```

## 💰 成本预估

### 前12个月（AWS 免费层）
- **Cloudflare**: $1.67/月
- **AWS**: $11.50/月
- **总计**: ~$13-15/月

### 12个月后
- **总计**: ~$26-30/月

## 🛠️ 手动部署步骤

如果自动脚本失败，可以按以下步骤手动部署：

### 1. 部署 AWS 基础设施
```bash
cd deployment
aws cloudformation create-stack \
  --stack-name dev-fake-wechat-infrastructure \
  --template-body file://aws/infrastructure.yml \
  --parameters ParameterKey=Environment,ParameterValue=dev \
               ParameterKey=DatabasePassword,ParameterValue=DevPassword123! \
  --capabilities CAPABILITY_NAMED_IAM

# 等待完成
aws cloudformation wait stack-create-complete \
  --stack-name dev-fake-wechat-infrastructure
```

### 2. 数据库迁移
```bash
cd ../backend
npm install
npx prisma migrate deploy
npx prisma generate
```

### 3. 部署 Lambda
```bash
cd ../deployment/aws
npm install
cp ../.env.dev .env
serverless deploy --stage dev
```

### 4. 设置 Cloudflare 资源
```bash
cd ../cloudflare
wrangler kv:namespace create "USER_SESSIONS"
wrangler kv:namespace create "CACHE"
wrangler r2 bucket create dev-fake-wechat-media

# 更新 wrangler.toml 中的 namespace ID
# 然后部署
wrangler deploy
```

### 5. 部署前端
```bash
cd ../../frontend
npm install
echo "NEXT_PUBLIC_API_URL=https://your-workers-url.workers.dev/api" > .env.local
npm run build
wrangler pages deploy .next --project-name fake-wechat-frontend-dev
```

## 🔍 故障排除

### 常见问题

#### AWS 凭证错误
```bash
# 解决方案
aws configure list
aws sts get-caller-identity
```

#### CloudFormation 部署失败
```bash
# 查看错误详情
aws cloudformation describe-stack-events \
  --stack-name dev-fake-wechat-infrastructure
```

#### Wrangler 登录失败
```bash
# 重新登录
wrangler logout
wrangler login
```

#### 数据库连接失败
- 检查安全组设置
- 确保 Lambda 在正确的 VPC 中
- 验证数据库端点和凭证

### 日志查看
```bash
# AWS Lambda 日志
aws logs tail /aws/lambda/fake-wechat-backend-dev-api --follow

# Wrangler 日志
wrangler tail fake-wechat-api-dev
```

## 🧹 清理资源

### 删除所有资源
```bash
# 删除 Cloudflare 资源
wrangler kv:namespace delete USER_SESSIONS_ID
wrangler kv:namespace delete CACHE_ID
wrangler r2 bucket delete dev-fake-wechat-media

# 删除 Serverless 服务
cd deployment/aws
serverless remove --stage dev

# 删除 CloudFormation 堆栈
aws cloudformation delete-stack \
  --stack-name dev-fake-wechat-infrastructure
```

## 📞 获取帮助

### 文档资源
- [AWS CLI 文档](https://docs.aws.amazon.com/cli/)
- [Wrangler 文档](https://developers.cloudflare.com/workers/wrangler/)
- [Serverless Framework 文档](https://www.serverless.com/framework/docs/)

### 社区支持
- GitHub Issues: 项目问题反馈
- Discord/Slack: 实时讨论
