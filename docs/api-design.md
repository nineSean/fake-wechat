# API接口设计

## API 设计原则

### RESTful API 设计
- 使用HTTP方法 (GET, POST, PUT, DELETE)
- 资源导向的URL设计
- 统一的响应格式
- 合理的HTTP状态码

### GraphQL API (可选)
- 灵活的数据查询
- 减少网络请求
- 类型安全

## 统一响应格式

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
    };
  };
}
```

## 认证与授权

### JWT Token 结构
```typescript
interface JwtPayload {
  sub: string; // 用户ID
  username: string;
  email: string;
  iat: number; // 签发时间
  exp: number; // 过期时间
  roles: string[];
}
```

### Authorization Header
```
Authorization: Bearer <jwt-token>
```

## API 接口详细设计

### 1. 用户管理 API

#### 用户注册
```http
POST /api/auth/register
Content-Type: application/json

{
  "phone_number": "+8613800138000",
  "password": "hashedPassword",
  "username": "john_doe",
  "nickname": "John Doe",
  "verification_code": "123456"
}

Response:
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "access_token": "jwt-token",
    "refresh_token": "refresh-token",
    "expires_in": 3600
  }
}
```

#### 用户登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "phone_number": "+8613800138000",
  "password": "hashedPassword"
}

Response:
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "access_token": "jwt-token",
    "refresh_token": "refresh-token",
    "expires_in": 3600
  }
}
```

#### 获取用户信息
```http
GET /api/users/me
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "john_doe",
    "nickname": "John Doe",
    "avatar_url": "https://cdn.example.com/avatar.jpg",
    "bio": "Hello world!",
    "phone_number": "+8613800138000",
    "email": "john@example.com",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

#### 更新用户信息
```http
PUT /api/users/me
Authorization: Bearer <token>
Content-Type: application/json

{
  "nickname": "New Nickname",
  "bio": "Updated bio",
  "avatar_url": "https://cdn.example.com/new-avatar.jpg"
}

Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "john_doe",
    "nickname": "New Nickname",
    "bio": "Updated bio",
    "avatar_url": "https://cdn.example.com/new-avatar.jpg"
  }
}
```

#### 搜索用户
```http
GET /api/users/search?q=john&limit=10&offset=0
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "username": "john_doe",
      "nickname": "John Doe",
      "avatar_url": "https://cdn.example.com/avatar.jpg"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1
    }
  }
}
```

### 2. 好友管理 API

#### 发送好友申请
```http
POST /api/friends/requests
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": "target-user-uuid",
  "message": "Hello, let's be friends!"
}

Response:
{
  "success": true,
  "data": {
    "request_id": "uuid",
    "status": "pending"
  }
}
```

#### 处理好友申请
```http
PUT /api/friends/requests/{request_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "accept" // accept, reject
}

Response:
{
  "success": true,
  "data": {
    "request_id": "uuid",
    "status": "accepted"
  }
}
```

#### 获取好友列表
```http
GET /api/friends?limit=50&offset=0
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "username": "jane_doe",
      "nickname": "Jane Doe",
      "avatar_url": "https://cdn.example.com/avatar.jpg",
      "online_status": "online",
      "last_seen": "2024-01-01T12:00:00Z"
    }
  ]
}
```

#### 删除好友
```http
DELETE /api/friends/{friend_id}
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "message": "Friend removed successfully"
  }
}
```

### 3. 聊天消息 API

#### 发送消息
```http
POST /api/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "conversation_id": "user_123#user_456",
  "message_type": "text",
  "content": "Hello world!",
  "reply_to_message_id": null
}

Response:
{
  "success": true,
  "data": {
    "message_id": "uuid",
    "conversation_id": "user_123#user_456",
    "sender_id": "user_123",
    "message_type": "text",
    "content": "Hello world!",
    "created_at": "2024-01-01T12:00:00Z"
  }
}
```

#### 获取聊天历史
```http
GET /api/messages/{conversation_id}?limit=50&before_timestamp=2024-01-01T12:00:00Z
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "message_id": "uuid",
      "sender_id": "user_456",
      "message_type": "text",
      "content": "Hi there!",
      "created_at": "2024-01-01T11:59:00Z",
      "is_read": true
    }
  ]
}
```

#### 标记消息已读
```http
POST /api/messages/{message_id}/read
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "message_id": "uuid",
    "read_at": "2024-01-01T12:00:00Z"
  }
}
```

#### 获取对话列表
```http
GET /api/conversations?limit=20&offset=0
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "conversation_id": "user_123#user_456",
      "conversation_type": "private",
      "participants": [
        {
          "user_id": "user_456",
          "nickname": "Jane Doe",
          "avatar_url": "https://cdn.example.com/avatar.jpg"
        }
      ],
      "last_message": {
        "content": "Hello world!",
        "timestamp": "2024-01-01T12:00:00Z",
        "sender_id": "user_123"
      },
      "unread_count": 0
    }
  ]
}
```

### 4. 群组管理 API

#### 创建群组
```http
POST /api/groups
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Group",
  "description": "A group for friends",
  "avatar_url": "https://cdn.example.com/group-avatar.jpg",
  "is_private": false
}

Response:
{
  "success": true,
  "data": {
    "group_id": "uuid",
    "name": "My Group",
    "description": "A group for friends",
    "owner_id": "user_123",
    "member_count": 1,
    "created_at": "2024-01-01T12:00:00Z"
  }
}
```

#### 邀请用户加入群组
```http
POST /api/groups/{group_id}/members
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_ids": ["user_456", "user_789"]
}

Response:
{
  "success": true,
  "data": {
    "invited_users": [
      {
        "user_id": "user_456",
        "status": "invited"
      }
    ]
  }
}
```

#### 获取群组成员
```http
GET /api/groups/{group_id}/members?limit=50&offset=0
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "user_id": "user_123",
      "nickname": "John Doe",
      "avatar_url": "https://cdn.example.com/avatar.jpg",
      "role": "owner",
      "joined_at": "2024-01-01T12:00:00Z"
    }
  ]
}
```

### 5. 文件上传 API

#### 获取上传凭证
```http
POST /api/media/upload-url
Authorization: Bearer <token>
Content-Type: application/json

{
  "filename": "image.jpg",
  "content_type": "image/jpeg",
  "file_size": 1024000
}

Response:
{
  "success": true,
  "data": {
    "upload_url": "https://s3.amazonaws.com/bucket/presigned-url",
    "file_id": "uuid",
    "expires_at": "2024-01-01T13:00:00Z"
  }
}
```

#### 确认上传完成
```http
POST /api/media/{file_id}/confirm
Authorization: Bearer <token>
Content-Type: application/json

{
  "checksum": "sha256-hash"
}

Response:
{
  "success": true,
  "data": {
    "file_id": "uuid",
    "file_url": "https://cdn.example.com/files/image.jpg",
    "thumbnail_url": "https://cdn.example.com/thumbnails/image.jpg"
  }
}
```

### 6. 朋友圈 API

#### 发布动态
```http
POST /api/moments
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Beautiful sunset today!",
  "media_urls": ["https://cdn.example.com/image1.jpg"],
  "location": "Beijing, China",
  "visibility": "friends"
}

Response:
{
  "success": true,
  "data": {
    "moment_id": "uuid",
    "content": "Beautiful sunset today!",
    "media_urls": ["https://cdn.example.com/image1.jpg"],
    "location": "Beijing, China",
    "like_count": 0,
    "comment_count": 0,
    "created_at": "2024-01-01T12:00:00Z"
  }
}
```

#### 获取朋友圈动态
```http
GET /api/moments?limit=20&before_timestamp=2024-01-01T12:00:00Z
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "moment_id": "uuid",
      "user": {
        "user_id": "user_456",
        "nickname": "Jane Doe",
        "avatar_url": "https://cdn.example.com/avatar.jpg"
      },
      "content": "Beautiful sunset today!",
      "media_urls": ["https://cdn.example.com/image1.jpg"],
      "location": "Beijing, China",
      "like_count": 5,
      "comment_count": 2,
      "is_liked": false,
      "created_at": "2024-01-01T11:00:00Z"
    }
  ]
}
```

#### 点赞动态
```http
POST /api/moments/{moment_id}/like
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "moment_id": "uuid",
    "is_liked": true,
    "like_count": 6
  }
}
```

#### 评论动态
```http
POST /api/moments/{moment_id}/comments
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Nice photo!",
  "reply_to_comment_id": null
}

Response:
{
  "success": true,
  "data": {
    "comment_id": "uuid",
    "content": "Nice photo!",
    "user": {
      "user_id": "user_123",
      "nickname": "John Doe",
      "avatar_url": "https://cdn.example.com/avatar.jpg"
    },
    "created_at": "2024-01-01T12:00:00Z"
  }
}
```

## WebSocket 事件定义

### 连接事件
```typescript
// 客户端连接
{
  event: 'connect',
  data: {
    token: 'jwt-token',
    device_info: {
      platform: 'web',
      version: '1.0.0'
    }
  }
}

// 服务器确认连接
{
  event: 'connected',
  data: {
    user_id: 'user_123',
    session_id: 'session_uuid'
  }
}
```

### 消息事件
```typescript
// 发送消息
{
  event: 'message:send',
  data: {
    conversation_id: 'user_123#user_456',
    message_type: 'text',
    content: 'Hello world!',
    reply_to_message_id: null
  }
}

// 接收消息
{
  event: 'message:receive',
  data: {
    message_id: 'uuid',
    conversation_id: 'user_123#user_456',
    sender_id: 'user_456',
    message_type: 'text',
    content: 'Hi there!',
    created_at: '2024-01-01T12:00:00Z'
  }
}

// 消息已读回执
{
  event: 'message:read',
  data: {
    message_id: 'uuid',
    reader_id: 'user_456',
    read_at: '2024-01-01T12:00:00Z'
  }
}
```

### 状态事件
```typescript
// 用户上线
{
  event: 'user:online',
  data: {
    user_id: 'user_456',
    status: 'online'
  }
}

// 用户下线
{
  event: 'user:offline',
  data: {
    user_id: 'user_456',
    status: 'offline',
    last_seen: '2024-01-01T12:00:00Z'
  }
}

// 正在输入
{
  event: 'typing:start',
  data: {
    conversation_id: 'user_123#user_456',
    user_id: 'user_456'
  }
}

// 停止输入
{
  event: 'typing:stop',
  data: {
    conversation_id: 'user_123#user_456',
    user_id: 'user_456'
  }
}
```

## 错误处理

### 错误码定义
```typescript
enum ErrorCode {
  // 认证错误
  UNAUTHORIZED = 'UNAUTHORIZED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  
  // 权限错误
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // 参数错误
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  MISSING_PARAMETER = 'MISSING_PARAMETER',
  
  // 业务错误
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  FRIEND_REQUEST_EXISTS = 'FRIEND_REQUEST_EXISTS',
  CONVERSATION_NOT_FOUND = 'CONVERSATION_NOT_FOUND',
  
  // 系统错误
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}
```

### 错误响应格式
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": {
      "field": "phone_number",
      "issue": "Invalid phone number format"
    }
  },
  "meta": {
    "timestamp": "2024-01-01T12:00:00Z",
    "requestId": "req_uuid"
  }
}
```