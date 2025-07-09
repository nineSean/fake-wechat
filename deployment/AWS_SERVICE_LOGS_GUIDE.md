# AWS服务日志查看指南

## 1. Lambda函数日志

### 通过AWS控制台查看
1. 登录AWS控制台 → 搜索"Lambda"
2. 点击函数名称（如：`fake-wechat-backend-dev-api`）
3. 点击"Monitor"标签
4. 点击"View logs in CloudWatch"

### 通过AWS CLI查看
```bash
# 查看最近的日志
aws logs tail /aws/lambda/fake-wechat-backend-dev-api --follow

# 查看特定时间范围的日志
aws logs filter-log-events \
  --log-group-name /aws/lambda/fake-wechat-backend-dev-api \
  --start-time 1625788800000 \
  --end-time 1625875200000
```

## 2. API Gateway日志

### 启用API Gateway日志
1. AWS控制台 → API Gateway
2. 选择你的API → Stages → dev
3. 点击"Logs/Tracing"
4. 启用"Enable CloudWatch Logs"
5. 设置Log level为"INFO"或"ERROR"

### 查看API Gateway日志
```bash
# 查看API Gateway执行日志
aws logs tail API-Gateway-Execution-Logs_YOUR_API_ID/dev --follow

# 查看API Gateway访问日志
aws logs tail API-Gateway-Access-Logs_YOUR_API_ID/dev --follow
```

## 3. RDS数据库日志

### 通过AWS控制台查看
1. AWS控制台 → RDS
2. 选择数据库实例 → "Logs & events"
3. 查看可用的日志文件：
   - Error logs
   - General logs
   - Slow query logs

### 通过AWS CLI查看
```bash
# 列出可用的日志文件
aws rds describe-db-log-files --db-instance-identifier fake-wechat-db-dev

# 下载日志文件
aws rds download-db-log-file-portion \
  --db-instance-identifier fake-wechat-db-dev \
  --log-file-name error/postgresql.log.2024-07-09-12
```

## 4. ElastiCache Redis日志

### 通过AWS控制台查看
1. AWS控制台 → ElastiCache
2. 选择Redis集群 → "Logs"
3. 查看慢日志：
   - Slow logs
   - Engine logs

### 通过AWS CLI查看
```bash
# 查看Redis慢日志
aws elasticache describe-cache-clusters \
  --cache-cluster-id fake-wechat-cache-dev \
  --show-cache-node-info

# 获取慢日志
aws elasticache describe-log-delivery-configurations \
  --cache-cluster-id fake-wechat-cache-dev
```

## 5. CloudWatch统一日志查看

### 通过AWS控制台
1. AWS控制台 → CloudWatch
2. 左侧菜单 → "Logs" → "Log groups"
3. 常见日志组：
   - `/aws/lambda/fake-wechat-backend-dev-api`
   - `/aws/lambda/fake-wechat-backend-dev-health`
   - `/aws/lambda/fake-wechat-backend-dev-websocket`
   - `/aws/apigateway/fake-wechat-api-dev`

### 通过AWS CLI
```bash
# 列出所有日志组
aws logs describe-log-groups

# 查看特定日志组
aws logs describe-log-streams --log-group-name /aws/lambda/fake-wechat-backend-dev-api

# 实时查看日志
aws logs tail /aws/lambda/fake-wechat-backend-dev-api --follow
```

## 6. 日志搜索和过滤

### CloudWatch Insights查询
```sql
-- 查找错误日志
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100

-- 查找特定API调用
fields @timestamp, @message
| filter @message like /\/api\/auth\/login/
| sort @timestamp desc

-- 统计错误频率
fields @timestamp, @message
| filter @message like /ERROR/
| stats count() by bin(5m)
```

## 7. 设置日志告警

### 创建CloudWatch告警
1. CloudWatch → Alarms → Create Alarm
2. 选择指标源：Logs
3. 设置条件：
   - 日志组：选择Lambda函数日志组
   - 筛选条件：`ERROR` 或 `TIMEOUT`
   - 阈值：错误数量 > 10

### 通过AWS CLI创建告警
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "Lambda-Error-Rate" \
  --alarm-description "Alert when Lambda errors exceed threshold" \
  --metric-name ErrorCount \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold
```

## 8. 日志保留策略

### 设置日志保留期
```bash
# 设置Lambda日志保留30天
aws logs put-retention-policy \
  --log-group-name /aws/lambda/fake-wechat-backend-dev-api \
  --retention-in-days 30

# 设置API Gateway日志保留7天
aws logs put-retention-policy \
  --log-group-name API-Gateway-Execution-Logs_YOUR_API_ID/dev \
  --retention-in-days 7
```

## 9. 常用日志命令快速参考

```bash
# 查看所有Lambda函数日志
aws logs tail /aws/lambda/fake-wechat-backend-dev-api --follow

# 查看最近1小时的错误日志
aws logs filter-log-events \
  --log-group-name /aws/lambda/fake-wechat-backend-dev-api \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s)000

# 查看特定请求ID的日志
aws logs filter-log-events \
  --log-group-name /aws/lambda/fake-wechat-backend-dev-api \
  --filter-pattern "REQUEST_ID_HERE"
```

## 10. 日志分析工具

### 推荐的第三方工具
1. **AWS X-Ray** - 分布式追踪
2. **Datadog** - 日志聚合和分析
3. **New Relic** - 应用性能监控
4. **Elastic Stack** - 日志搜索和可视化

### 本地日志分析
```bash
# 下载日志到本地分析
aws logs create-export-task \
  --log-group-name /aws/lambda/fake-wechat-backend-dev-api \
  --from 1625788800000 \
  --to 1625875200000 \
  --destination s3://your-log-bucket/lambda-logs/
```