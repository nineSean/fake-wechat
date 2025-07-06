# 数据库模型设计

## 数据库架构选择

### PostgreSQL (RDS) - 关系型数据
- 用户信息
- 好友关系
- 群组信息
- 朋友圈数据

### DynamoDB - NoSQL数据
- 聊天消息
- 用户会话
- 实时状态

### Redis (ElastiCache) - 缓存
- 用户在线状态
- 会话信息
- 热点数据缓存

## PostgreSQL 数据模型

### 用户表 (users)
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    username VARCHAR(50) UNIQUE NOT NULL,
    nickname VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    gender SMALLINT, -- 0: 未知, 1: 男, 2: 女
    birthday DATE,
    location VARCHAR(100),
    privacy_settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
```

### 好友关系表 (friendships)
```sql
CREATE TABLE friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status SMALLINT NOT NULL DEFAULT 0, -- 0: 待确认, 1: 已确认, 2: 已拒绝, 3: 已拉黑
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, friend_id)
);

-- 索引
CREATE INDEX idx_friendships_user_id ON friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX idx_friendships_status ON friendships(status);
```

### 群组表 (groups)
```sql
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    avatar_url TEXT,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    max_members INTEGER DEFAULT 500,
    is_private BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_groups_owner_id ON groups(owner_id);
CREATE INDEX idx_groups_name ON groups(name);
```

### 群组成员表 (group_members)
```sql
CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role SMALLINT NOT NULL DEFAULT 0, -- 0: 普通成员, 1: 管理员, 2: 群主
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, user_id)
);

-- 索引
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
```

### 朋友圈表 (moments)
```sql
CREATE TABLE moments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    media_urls TEXT[], -- 图片/视频URL数组
    location VARCHAR(100),
    visibility SMALLINT DEFAULT 0, -- 0: 公开, 1: 仅好友, 2: 私密
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_moments_user_id ON moments(user_id);
CREATE INDEX idx_moments_created_at ON moments(created_at DESC);
```

### 朋友圈点赞表 (moment_likes)
```sql
CREATE TABLE moment_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moment_id UUID NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(moment_id, user_id)
);

-- 索引
CREATE INDEX idx_moment_likes_moment_id ON moment_likes(moment_id);
CREATE INDEX idx_moment_likes_user_id ON moment_likes(user_id);
```

### 朋友圈评论表 (moment_comments)
```sql
CREATE TABLE moment_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moment_id UUID NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    reply_to_id UUID REFERENCES moment_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_moment_comments_moment_id ON moment_comments(moment_id);
CREATE INDEX idx_moment_comments_user_id ON moment_comments(user_id);
```

## DynamoDB 数据模型

### 消息表 (messages)
```javascript
{
  // 分区键: 对话ID (单聊: user1_id#user2_id, 群聊: group_id)
  "conversation_id": "user_123#user_456",
  
  // 排序键: 时间戳 + 消息ID
  "timestamp_message_id": "2024-01-01T12:00:00Z#msg_789",
  
  // 消息属性
  "message_id": "msg_789",
  "sender_id": "user_123",
  "message_type": "text", // text, image, video, audio, file, location
  "content": "Hello world!",
  "media_url": null,
  "file_size": null,
  "duration": null, // 音频/视频时长
  "is_read": false,
  "is_deleted": false,
  "reply_to_message_id": null,
  "created_at": "2024-01-01T12:00:00Z",
  "updated_at": "2024-01-01T12:00:00Z",
  
  // GSI索引属性
  "sender_timestamp": "user_123#2024-01-01T12:00:00Z"
}
```

### 对话表 (conversations)
```javascript
{
  // 分区键: 对话ID
  "conversation_id": "user_123#user_456",
  
  // 对话属性
  "conversation_type": "private", // private, group
  "participants": ["user_123", "user_456"],
  "last_message_id": "msg_789",
  "last_message_content": "Hello world!",
  "last_message_timestamp": "2024-01-01T12:00:00Z",
  "unread_count": {
    "user_123": 0,
    "user_456": 1
  },
  "created_at": "2024-01-01T10:00:00Z",
  "updated_at": "2024-01-01T12:00:00Z"
}
```

### 用户会话表 (user_sessions)
```javascript
{
  // 分区键: 用户ID
  "user_id": "user_123",
  
  // 排序键: 对话ID
  "conversation_id": "user_123#user_456",
  
  // 会话属性
  "last_read_message_id": "msg_788",
  "unread_count": 1,
  "is_muted": false,
  "is_pinned": false,
  "last_accessed_at": "2024-01-01T12:00:00Z"
}
```

## Redis 缓存模型

### 用户在线状态
```
Key: user:online:{user_id}
Value: {
  "status": "online", // online, offline, away
  "last_seen": "2024-01-01T12:00:00Z",
  "device_info": {
    "platform": "web",
    "version": "1.0.0"
  }
}
TTL: 300 seconds (5分钟)
```

### 会话缓存
```
Key: session:{session_id}
Value: {
  "user_id": "user_123",
  "expires_at": "2024-01-01T18:00:00Z",
  "permissions": ["read", "write"]
}
TTL: 3600 seconds (1小时)
```

### 热点数据缓存
```
Key: hot:moments:{user_id}
Value: [moment_ids] // 用户朋友圈热点动态ID列表
TTL: 1800 seconds (30分钟)
```

## 数据库优化策略

### 1. 读写分离
- 主库处理写操作
- 从库处理读操作
- 读写分离中间件

### 2. 分库分表
- 按用户ID分片
- 按时间分区
- 历史数据归档

### 3. 缓存策略
- Redis缓存热点数据
- 多级缓存架构
- 缓存预热和更新策略

### 4. 索引优化
- 复合索引设计
- 部分索引使用
- 索引监控和维护