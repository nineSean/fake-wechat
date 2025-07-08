# 🔍 Fake WeChat 部署服务查找指南

本指南详细介绍如何查找和管理已部署的 Fake WeChat 应用的所有服务组件。

## 📋 目录

- [AWS 服务查找](#aws-服务查找)
- [Cloudflare 服务查找](#cloudflare-服务查找)
- [命令行工具查找](#命令行工具查找)
- [监控和日志](#监控和日志)
- [故障排除](#故障排除)

## 🔐 前置要求

### 必需工具
- AWS CLI (已配置)
- Wrangler CLI (已登录)
- curl (用于测试)

### 环境变量
确保以下环境变量已设置：
```bash
export AWS_REGION=us-east-1
export STAGE=dev
export PROJECT_NAME=fake-wechat
```

## 🌐 AWS 服务查找

### 1. AWS 控制台访问

#### 登录信息
- **控制台**: https://console.aws.amazon.com
- **区域**: US East (N. Virginia) us-east-1
- **账户**: 你的 AWS 账户

#### 快速导航
```bash
# 主要服务直接链接
echo "AWS 控制台快速访问:"
echo "CloudFormation: https://console.aws.amazon.com/cloudformation/home?region=us-east-1"
echo "Lambda: https://console.aws.amazon.com/lambda/home?region=us-east-1"
echo "API Gateway: https://console.aws.amazon.com/apigateway/home?region=us-east-1"
echo "RDS: https://console.aws.amazon.com/rds/home?region=us-east-1"
echo "VPC: https://console.aws.amazon.com/vpc/home?region=us-east-1"
echo "S3: https://console.aws.amazon.com/s3/home?region=us-east-1"
```

### 2. CloudFormation 堆栈查找

#### 基础设施堆栈
```bash
# 查看基础设施堆栈状态
aws cloudformation describe-stacks \
  --stack-name dev-fake-wechat-infrastructure \
  --query 'Stacks[0].{Status:StackStatus,Created:CreationTime}'

# 查看堆栈输出（重要端点信息）
aws cloudformation describe-stacks \
  --stack-name dev-fake-wechat-infrastructure \
  --query 'Stacks[0].Outputs'

# 查看堆栈资源
aws cloudformation describe-stack-resources \
  --stack-name dev-fake-wechat-infrastructure \
  --query 'StackResources[].{Type:ResourceType,Status:ResourceStatus,LogicalId:LogicalResourceId}'
```

#### Lambda 堆栈
```bash
# 查看 Lambda 堆栈状态
aws cloudformation describe-stacks \
  --stack-name fake-wechat-backend-dev \
  --query 'Stacks[0].{Status:StackStatus,Created:CreationTime}'

# 查看 Lambda 堆栈输出
aws cloudformation describe-stacks \
  --stack-name fake-wechat-backend-dev \
  --query 'Stacks[0].Outputs'
```

### 3. Lambda 函数查找

#### 列出所有 Lambda 函数
```bash
# 查找项目相关的 Lambda 函数
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `fake-wechat`)].{Name:FunctionName,Runtime:Runtime,LastModified:LastModified}' \
  --output table

# 获取特定函数详细信息
aws lambda get-function \
  --function-name fake-wechat-backend-dev-api \
  --query 'Configuration.{Name:FunctionName,Runtime:Runtime,Timeout:Timeout,Memory:MemorySize,Role:Role}'
```

#### 测试 Lambda 函数
```bash
# 测试健康检查函数
aws lambda invoke \
  --function-name fake-wechat-backend-dev-health \
  --payload '{}' \
  response.json && cat response.json

# 测试 API 函数
aws lambda invoke \
  --function-name fake-wechat-backend-dev-api \
  --payload '{"httpMethod":"GET","path":"/test"}' \
  response.json && cat response.json
```

### 4. API Gateway 查找

#### 查找 REST API
```bash
# 列出所有 REST API
aws apigateway get-rest-apis \
  --query 'items[].{Name:name,Id:id,CreatedDate:createdDate}' \
  --output table

# 获取特定 API 详细信息
API_ID=$(aws apigateway get-rest-apis --query 'items[?contains(name, `fake-wechat`)].id' --output text)
echo "API Gateway ID: $API_ID"
echo "API Gateway URL: https://$API_ID.execute-api.us-east-1.amazonaws.com/dev"

# 查看 API 资源
aws apigateway get-resources \
  --rest-api-id $API_ID \
  --query 'items[].{Path:path,Methods:resourceMethods}'
```

#### 测试 API Gateway
```bash
# 测试健康检查端点
curl -s "https://$API_ID.execute-api.us-east-1.amazonaws.com/dev/health" | jq .

# 测试代理端点
curl -s "https://$API_ID.execute-api.us-east-1.amazonaws.com/dev/test" | jq .
```

### 5. RDS 数据库查找

#### 数据库实例查找
```bash
# 查找数据库实例
aws rds describe-db-instances \
  --query 'DBInstances[?contains(DBInstanceIdentifier, `fake-wechat`)].{Name:DBInstanceIdentifier,Status:DBInstanceStatus,Endpoint:Endpoint.Address,Engine:Engine}' \
  --output table

# 获取数据库详细信息
aws rds describe-db-instances \
  --db-instance-identifier dev-fake-wechat-db \
  --query 'DBInstances[0].{Status:DBInstanceStatus,Endpoint:Endpoint.Address,Port:Endpoint.Port,Engine:Engine,Class:DBInstanceClass}'
```

#### 数据库连接测试
```bash
# 注意：由于数据库在私有子网中，只能通过 Lambda 或 VPC 内的资源访问
# 可以通过 Lambda 函数测试数据库连接
aws lambda invoke \
  --function-name fake-wechat-backend-dev-health \
  --payload '{}' \
  response.json && cat response.json | jq .database
```

### 6. ElastiCache Redis 查找

#### Redis 集群查找
```bash
# 查找 Redis 集群
aws elasticache describe-cache-clusters \
  --query 'CacheClusters[?contains(CacheClusterId, `fake-wechat`)].{Id:CacheClusterId,Status:CacheClusterStatus,Endpoint:RedisEndpoint.Address,Engine:Engine}' \
  --output table

# 获取 Redis 详细信息
aws elasticache describe-cache-clusters \
  --cache-cluster-id dev-fake-wechat-redis \
  --show-cache-node-info \
  --query 'CacheClusters[0].{Status:CacheClusterStatus,Endpoint:RedisEndpoint.Address,Port:RedisEndpoint.Port,Engine:Engine}'
```

### 7. VPC 网络资源查找

#### VPC 和子网查找
```bash
# 查找 VPC
aws ec2 describe-vpcs \
  --filters "Name=tag:Name,Values=*fake-wechat*" \
  --query 'Vpcs[].{VpcId:VpcId,CidrBlock:CidrBlock,Name:Tags[?Key==`Name`].Value|[0]}' \
  --output table

# 查找子网
aws ec2 describe-subnets \
  --filters "Name=tag:Name,Values=*fake-wechat*" \
  --query 'Subnets[].{SubnetId:SubnetId,CidrBlock:CidrBlock,AZ:AvailabilityZone,Name:Tags[?Key==`Name`].Value|[0]}' \
  --output table

# 查找安全组
aws ec2 describe-security-groups \
  --filters "Name=tag:Name,Values=*fake-wechat*" \
  --query 'SecurityGroups[].{GroupId:GroupId,GroupName:GroupName,Description:Description,Name:Tags[?Key==`Name`].Value|[0]}' \
  --output table
```

### 8. S3 存储桶查找

#### S3 存储桶查找
```bash
# 查找项目相关的 S3 存储桶
aws s3 ls | grep fake-wechat

# 查看存储桶详细信息
aws s3api head-bucket --bucket dev-fake-wechat-media-$(aws sts get-caller-identity --query Account --output text)

# 查看存储桶内容
aws s3 ls s3://dev-fake-wechat-media-$(aws sts get-caller-identity --query Account --output text)/
```

## ☁️ Cloudflare 服务查找

### 1. Cloudflare Dashboard 访问

#### 登录信息
- **控制台**: https://dash.cloudflare.com
- **区域**: 你的账户域名

#### 快速导航
```bash
echo "Cloudflare Dashboard 快速访问:"
echo "Workers: https://dash.cloudflare.com/workers"
echo "Pages: https://dash.cloudflare.com/pages"
echo "KV Storage: https://dash.cloudflare.com/kv"
echo "R2 Storage: https://dash.cloudflare.com/r2"
```

### 2. Workers 查找

#### 使用 Wrangler CLI
```bash
# 查看当前用户信息
wrangler whoami

# 列出所有 Workers
wrangler list

# 查看特定 Worker 详细信息
wrangler status fake-wechat-api-dev

# 查看 Worker 日志
wrangler tail fake-wechat-api-dev
```

#### 测试 Workers
```bash
# 测试 Workers 健康检查
curl -s "https://fake-wechat-api-dev.ninesean1989.workers.dev/health" | jq .

# 测试 API 代理功能
curl -s "https://fake-wechat-api-dev.ninesean1989.workers.dev/api/health" | jq .
```

### 3. KV 存储查找

#### KV 命名空间查找
```bash
# 列出所有 KV 命名空间
wrangler kv namespace list

# 查看特定命名空间的内容
wrangler kv key list --namespace-id "32c171d6caaf4446bf9b02308cbe4e47"

# 获取特定键的值
wrangler kv key get "test-key" --namespace-id "32c171d6caaf4446bf9b02308cbe4e47"
```

### 4. Pages 查找

#### Pages 项目查找
```bash
# 列出所有 Pages 项目
wrangler pages project list

# 查看特定项目详细信息
wrangler pages project get fake-wechat-frontend-dev

# 查看部署历史
wrangler pages deployment list --project-name fake-wechat-frontend-dev
```

#### 测试 Pages
```bash
# 测试前端应用
curl -s -I "https://fake-wechat-frontend-dev.pages.dev"

# 检查前端 API 配置
curl -s "https://fake-wechat-frontend-dev.pages.dev" | grep -o 'NEXT_PUBLIC_API_URL[^"]*'
```

## 🛠️ 命令行工具查找

### 1. 综合状态检查脚本

创建一个综合检查脚本：

```bash
#!/bin/bash
# 综合状态检查脚本

echo "🔍 Fake WeChat 服务状态检查"
echo "================================"

# 检查 AWS 服务
echo "📊 AWS 服务状态:"
echo "1. CloudFormation 堆栈:"
aws cloudformation describe-stacks --stack-name dev-fake-wechat-infrastructure --query 'Stacks[0].StackStatus' --output text
aws cloudformation describe-stacks --stack-name fake-wechat-backend-dev --query 'Stacks[0].StackStatus' --output text

echo "2. Lambda 函数:"
aws lambda list-functions --query 'Functions[?contains(FunctionName, `fake-wechat`)].{Name:FunctionName,Status:State}' --output table

echo "3. API Gateway:"
API_ID=$(aws apigateway get-rest-apis --query 'items[?contains(name, `fake-wechat`)].id' --output text)
echo "API Gateway ID: $API_ID"
echo "API Gateway URL: https://$API_ID.execute-api.us-east-1.amazonaws.com/dev"

echo "4. RDS 数据库:"
aws rds describe-db-instances --query 'DBInstances[?contains(DBInstanceIdentifier, `fake-wechat`)].{Name:DBInstanceIdentifier,Status:DBInstanceStatus}' --output table

echo "5. ElastiCache:"
aws elasticache describe-cache-clusters --query 'CacheClusters[?contains(CacheClusterId, `fake-wechat`)].{Id:CacheClusterId,Status:CacheClusterStatus}' --output table

# 检查 Cloudflare 服务
echo "☁️ Cloudflare 服务状态:"
echo "1. Workers:"
wrangler list | grep fake-wechat || echo "未找到 Workers"

echo "2. Pages:"
wrangler pages project list | grep fake-wechat || echo "未找到 Pages 项目"

echo "3. KV 存储:"
wrangler kv namespace list | grep -E "(USER_SESSIONS|CACHE)" || echo "未找到 KV 命名空间"

# 运行健康检查
echo "🧪 健康检查测试:"
echo "1. Workers 健康检查:"
curl -s "https://fake-wechat-api-dev.ninesean1989.workers.dev/health" | jq .status

echo "2. Lambda 健康检查:"
curl -s "https://$API_ID.execute-api.us-east-1.amazonaws.com/dev/health" | jq .status

echo "3. API 代理测试:"
curl -s "https://fake-wechat-api-dev.ninesean1989.workers.dev/api/health" | jq .message

echo "✅ 状态检查完成!"
```

### 2. 资源清单生成

```bash
#!/bin/bash
# 资源清单生成脚本

echo "📋 Fake WeChat 资源清单"
echo "======================"

# 生成 AWS 资源清单
echo "## AWS 资源" > resource_inventory.md
echo "" >> resource_inventory.md

echo "### CloudFormation 堆栈" >> resource_inventory.md
aws cloudformation describe-stacks --stack-name dev-fake-wechat-infrastructure --query 'Stacks[0].Outputs' >> resource_inventory.md

echo "### Lambda 函数" >> resource_inventory.md
aws lambda list-functions --query 'Functions[?contains(FunctionName, `fake-wechat`)]' >> resource_inventory.md

echo "### API Gateway" >> resource_inventory.md
aws apigateway get-rest-apis --query 'items[?contains(name, `fake-wechat`)]' >> resource_inventory.md

# 生成 Cloudflare 资源清单
echo "## Cloudflare 资源" >> resource_inventory.md
echo "" >> resource_inventory.md

echo "### Workers" >> resource_inventory.md
wrangler list >> resource_inventory.md

echo "### Pages" >> resource_inventory.md
wrangler pages project list >> resource_inventory.md

echo "### KV 命名空间" >> resource_inventory.md
wrangler kv namespace list >> resource_inventory.md

echo "📄 资源清单已生成: resource_inventory.md"
```

## 📊 监控和日志

### 1. CloudWatch 日志查看

```bash
# 查看 Lambda 函数日志
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/fake-wechat"

# 实时查看日志
aws logs tail /aws/lambda/fake-wechat-backend-dev-api --follow

# 查看最近 1 小时的错误日志
aws logs filter-log-events \
  --log-group-name "/aws/lambda/fake-wechat-backend-dev-api" \
  --start-time $(date -d '1 hour ago' +%s)000 \
  --filter-pattern "ERROR"
```

### 2. Workers 日志查看

```bash
# 实时查看 Workers 日志
wrangler tail fake-wechat-api-dev

# 查看特定时间段的日志
wrangler tail fake-wechat-api-dev --since "2023-01-01T00:00:00Z"
```

### 3. 性能监控

```bash
# 查看 Lambda 函数指标
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=fake-wechat-backend-dev-api \
  --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

## 🔧 故障排除

### 1. 常见问题检查

#### 服务不可用
```bash
# 检查 CloudFormation 堆栈状态
aws cloudformation describe-stacks --stack-name dev-fake-wechat-infrastructure --query 'Stacks[0].StackStatus'

# 检查 Lambda 函数状态
aws lambda get-function --function-name fake-wechat-backend-dev-api --query 'Configuration.State'

# 检查 API Gateway 健康
curl -s -I "https://$(aws apigateway get-rest-apis --query 'items[?contains(name, `fake-wechat`)].id' --output text).execute-api.us-east-1.amazonaws.com/dev/health"
```

#### 数据库连接问题
```bash
# 检查数据库状态
aws rds describe-db-instances --db-instance-identifier dev-fake-wechat-db --query 'DBInstances[0].DBInstanceStatus'

# 检查安全组配置
aws ec2 describe-security-groups --filters "Name=tag:Name,Values=*fake-wechat*" --query 'SecurityGroups[].{GroupId:GroupId,Rules:IpPermissions}'
```

#### Workers 问题
```bash
# 检查 Workers 状态
wrangler status fake-wechat-api-dev

# 检查 KV 绑定
wrangler kv namespace list

# 测试 Workers 响应
curl -s -w "%{http_code}" "https://fake-wechat-api-dev.ninesean1989.workers.dev/health"
```

### 2. 诊断工具

#### 网络连接测试
```bash
# 测试 API 连接
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://fake-wechat-api-dev.ninesean1989.workers.dev/health"

# 测试 Lambda 直连
curl -s -o /dev/null -w "%{http_code} %{time_total}s" "https://$(aws apigateway get-rest-apis --query 'items[?contains(name, `fake-wechat`)].id' --output text).execute-api.us-east-1.amazonaws.com/dev/health"
```

#### 日志分析
```bash
# 分析错误日志
aws logs filter-log-events \
  --log-group-name "/aws/lambda/fake-wechat-backend-dev-api" \
  --start-time $(date -d '1 hour ago' +%s)000 \
  --filter-pattern "ERROR" \
  --query 'events[].message'
```

## 📚 有用的资源

### 官方文档
- [AWS CLI 文档](https://docs.aws.amazon.com/cli/)
- [Wrangler 文档](https://developers.cloudflare.com/workers/wrangler/)
- [CloudFormation 文档](https://docs.aws.amazon.com/cloudformation/)

### 控制台快速链接
- [AWS CloudFormation](https://console.aws.amazon.com/cloudformation/)
- [AWS Lambda](https://console.aws.amazon.com/lambda/)
- [Cloudflare Workers](https://dash.cloudflare.com/workers)
- [Cloudflare Pages](https://dash.cloudflare.com/pages)

### 紧急联系
- AWS 支持：通过 AWS 控制台
- Cloudflare 支持：https://support.cloudflare.com

---

**更新日期**: 2025-07-08  
**版本**: 1.0.0  
**作者**: Claude Code Assistant