# AWS数据库操作指南

## 1. RDS PostgreSQL数据库连接信息

### 连接参数
- **主机**: dev-fake-wechat-db.cm728e8carsq.us-east-1.rds.amazonaws.com
- **端口**: 5432
- **数据库**: fakewechat
- **用户名**: postgres
- **密码**: DevPassword123!

### 完整连接字符串
```
postgresql://postgres:DevPassword123!@dev-fake-wechat-db.cm728e8carsq.us-east-1.rds.amazonaws.com:5432/fakewechat
```

## 2. 通过AWS控制台查看数据库

### RDS控制台操作
1. 登录AWS控制台 → 搜索"RDS"
2. 点击"Databases" → 选择`dev-fake-wechat-db`
3. 查看数据库基本信息：
   - 状态、可用性
   - 连接信息
   - 配置详情
   - 监控指标

### 数据库性能监控
1. 在RDS控制台选择数据库
2. 点击"Monitoring"标签查看：
   - CPU使用率
   - 数据库连接数
   - 读/写IOPS
   - 延迟统计

## 3. 直接连接数据库进行CRUD操作

### 方法1: 使用psql命令行工具
```bash
# 安装PostgreSQL客户端
# macOS: brew install postgresql
# Ubuntu: sudo apt-get install postgresql-client

# 连接数据库
psql "postgresql://postgres:DevPassword123!@dev-fake-wechat-db.cm728e8carsq.us-east-1.rds.amazonaws.com:5432/fakewechat"

# 或者分别指定参数
psql -h dev-fake-wechat-db.cm728e8carsq.us-east-1.rds.amazonaws.com \
     -p 5432 \
     -U postgres \
     -d fakewechat
```

### 方法2: 使用图形化工具
推荐工具：
- **pgAdmin** (免费)
- **DBeaver** (免费)
- **TablePlus** (付费)
- **Postico** (付费，macOS)

连接配置：
- Host: dev-fake-wechat-db.cm728e8carsq.us-east-1.rds.amazonaws.com
- Port: 5432
- Database: fakewechat
- Username: postgres
- Password: DevPassword123!

## 4. 数据库Schema查看

### 查看所有表
```sql
-- 查看当前数据库所有表
\dt

-- 或者使用SQL查询
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

### 查看表结构
```sql
-- 查看特定表的结构
\d users

-- 查看详细表信息
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'users';
```

## 5. 基本CRUD操作示例

### 创建表 (CREATE)
```sql
-- 创建用户表
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    avatar_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建好友关系表
CREATE TABLE friendships (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    friend_id INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, friend_id)
);

-- 创建消息表
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id),
    receiver_id INTEGER REFERENCES users(id),
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);
```

### 插入数据 (INSERT)
```sql
-- 插入用户数据
INSERT INTO users (username, email, password_hash, display_name) 
VALUES 
    ('john_doe', 'john@example.com', 'hashed_password_1', 'John Doe'),
    ('jane_smith', 'jane@example.com', 'hashed_password_2', 'Jane Smith'),
    ('bob_wilson', 'bob@example.com', 'hashed_password_3', 'Bob Wilson');

-- 插入好友关系
INSERT INTO friendships (user_id, friend_id, status) 
VALUES 
    (1, 2, 'accepted'),
    (2, 3, 'pending');

-- 插入消息
INSERT INTO messages (sender_id, receiver_id, content) 
VALUES 
    (1, 2, 'Hello Jane!'),
    (2, 1, 'Hi John, how are you?');
```

### 查询数据 (SELECT)
```sql
-- 查询所有用户
SELECT * FROM users;

-- 查询特定用户
SELECT * FROM users WHERE username = 'john_doe';

-- 查询用户的好友
SELECT 
    u1.username as user,
    u2.username as friend,
    f.status
FROM friendships f
JOIN users u1 ON f.user_id = u1.id
JOIN users u2 ON f.friend_id = u2.id
WHERE u1.username = 'john_doe';

-- 查询用户间的消息
SELECT 
    u1.username as sender,
    u2.username as receiver,
    m.content,
    m.created_at
FROM messages m
JOIN users u1 ON m.sender_id = u1.id
JOIN users u2 ON m.receiver_id = u2.id
ORDER BY m.created_at DESC;

-- 分页查询
SELECT * FROM users 
ORDER BY created_at DESC 
LIMIT 10 OFFSET 0;
```

### 更新数据 (UPDATE)
```sql
-- 更新用户信息
UPDATE users 
SET display_name = 'John Smith', 
    updated_at = CURRENT_TIMESTAMP
WHERE username = 'john_doe';

-- 更新好友状态
UPDATE friendships 
SET status = 'accepted' 
WHERE user_id = 2 AND friend_id = 3;

-- 标记消息为已读
UPDATE messages 
SET read_at = CURRENT_TIMESTAMP 
WHERE receiver_id = 1 AND read_at IS NULL;
```

### 删除数据 (DELETE)
```sql
-- 删除特定消息
DELETE FROM messages 
WHERE id = 1;

-- 删除好友关系
DELETE FROM friendships 
WHERE user_id = 1 AND friend_id = 2;

-- 删除用户（注意外键约束）
DELETE FROM users 
WHERE username = 'john_doe';
```

## 6. 高级查询操作

### 聚合查询
```sql
-- 统计每个用户的消息数量
SELECT 
    u.username,
    COUNT(m.id) as message_count
FROM users u
LEFT JOIN messages m ON u.id = m.sender_id
GROUP BY u.id, u.username
ORDER BY message_count DESC;

-- 查找最活跃的用户
SELECT 
    u.username,
    COUNT(m.id) as sent_messages,
    COUNT(DISTINCT f.friend_id) as friends_count
FROM users u
LEFT JOIN messages m ON u.id = m.sender_id
LEFT JOIN friendships f ON u.id = f.user_id AND f.status = 'accepted'
GROUP BY u.id, u.username
ORDER BY sent_messages DESC, friends_count DESC;
```

### 复杂连接查询
```sql
-- 查找共同好友
SELECT 
    u1.username as user1,
    u2.username as user2,
    u3.username as mutual_friend
FROM users u1
JOIN friendships f1 ON u1.id = f1.user_id
JOIN users u3 ON f1.friend_id = u3.id
JOIN friendships f2 ON u3.id = f2.user_id
JOIN users u2 ON f2.friend_id = u2.id
WHERE u1.id != u2.id 
  AND f1.status = 'accepted' 
  AND f2.status = 'accepted';
```

## 7. 数据库维护操作

### 备份数据库
```sql
-- 通过pg_dump备份
pg_dump -h dev-fake-wechat-db.cm728e8carsq.us-east-1.rds.amazonaws.com \
        -p 5432 \
        -U postgres \
        -d fakewechat \
        -f backup_$(date +%Y%m%d_%H%M%S).sql

-- 备份特定表
pg_dump -h dev-fake-wechat-db.cm728e8carsq.us-east-1.rds.amazonaws.com \
        -p 5432 \
        -U postgres \
        -d fakewechat \
        -t users \
        -f users_backup.sql
```

### 恢复数据库
```sql
-- 恢复整个数据库
psql -h dev-fake-wechat-db.cm728e8carsq.us-east-1.rds.amazonaws.com \
     -p 5432 \
     -U postgres \
     -d fakewechat \
     -f backup_20240709_120000.sql
```

### 数据库性能优化
```sql
-- 查看表大小
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 查看索引使用情况
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_tup_read DESC;

-- 创建索引
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_messages_sender_receiver ON messages(sender_id, receiver_id);
CREATE INDEX idx_friendships_user_status ON friendships(user_id, status);
```

## 8. 通过Lambda函数操作数据库

### 在Lambda中执行数据库操作
```bash
# 调用Lambda函数执行数据库迁移
aws lambda invoke \
    --function-name fake-wechat-backend-dev-migrate \
    --payload '{"action": "migrate"}' \
    response.json

# 查看响应
cat response.json
```

### 通过API Gateway操作数据库
```bash
# 通过API创建用户
curl -X POST "https://2223vdgz78.execute-api.us-east-1.amazonaws.com/dev/api/users" \
  -H "Content-Type: application/json" \
  -d '{"username": "newuser", "email": "newuser@example.com", "password": "password123"}'

# 通过API查询用户
curl "https://2223vdgz78.execute-api.us-east-1.amazonaws.com/dev/api/users/profile" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 9. 数据库监控和告警

### 设置CloudWatch监控
```bash
# 创建数据库连接数告警
aws cloudwatch put-metric-alarm \
    --alarm-name "RDS-High-Connection-Count" \
    --alarm-description "RDS connection count is high" \
    --metric-name DatabaseConnections \
    --namespace AWS/RDS \
    --statistic Average \
    --period 300 \
    --threshold 80 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=DBInstanceIdentifier,Value=dev-fake-wechat-db

# 创建CPU使用率告警
aws cloudwatch put-metric-alarm \
    --alarm-name "RDS-High-CPU" \
    --alarm-description "RDS CPU utilization is high" \
    --metric-name CPUUtilization \
    --namespace AWS/RDS \
    --statistic Average \
    --period 300 \
    --threshold 80 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=DBInstanceIdentifier,Value=dev-fake-wechat-db
```

## 10. 安全最佳实践

### 数据库安全配置
```sql
-- 创建只读用户
CREATE USER readonly_user WITH PASSWORD 'readonly_password';
GRANT CONNECT ON DATABASE fakewechat TO readonly_user;
GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;

-- 创建应用专用用户
CREATE USER app_user WITH PASSWORD 'app_password';
GRANT CONNECT ON DATABASE fakewechat TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;
```

### 定期维护脚本
```sql
-- 清理过期数据
DELETE FROM messages WHERE created_at < NOW() - INTERVAL '1 year';

-- 更新表统计信息
ANALYZE;

-- 清理无用数据
VACUUM;
```

## 11. 故障排查

### 常见问题和解决方案
```sql
-- 查看当前连接数
SELECT count(*) FROM pg_stat_activity;

-- 查看长时间运行的查询
SELECT 
    pid, 
    now() - pg_stat_activity.query_start AS duration, 
    query 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';

-- 杀掉长时间运行的查询
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid = 'PID_NUMBER';

-- 查看锁信息
SELECT * FROM pg_locks WHERE NOT granted;
```