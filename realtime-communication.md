# 实时通信方案设计

## 技术选型

### WebSocket vs Socket.io
选择 **Socket.io** 作为实时通信解决方案：
- 自动降级支持 (WebSocket → Long Polling)
- 丰富的事件系统
- 断线重连机制
- 房间 (Room) 管理
- 命名空间支持

### AWS 实时通信架构
```
┌─────────────────────────────────────────────────────────────────────┐
│                      Client Applications                             │
├─────────────────────────────────────────────────────────────────────┤
│         Socket.io Client         │         HTTP Client              │
└─────────────────────────────────────────────────────────────────────┘
                    │                              │
                    │ WSS                          │ HTTPS
                    ▼                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     AWS API Gateway                                 │
├─────────────────────────────────────────────────────────────────────┤
│    WebSocket API            │           HTTP API                    │
│    (Connection Management)  │           (Message Delivery)          │
└─────────────────────────────────────────────────────────────────────┘
                    │                              │
                    │ Lambda Invoke                │ Lambda Invoke
                    ▼                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Lambda Functions                               │
├─────────────────────────────────────────────────────────────────────┤
│  Connection Handler  │  Message Handler   │  Broadcast Handler     │
│  (Connect/Disconnect)│  (Send/Receive)    │  (Room Management)     │
└─────────────────────────────────────────────────────────────────────┘
                    │                              │
                    │ DynamoDB                     │ SQS/SNS
                    ▼                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Connection Store & Message Queue                        │
├─────────────────────────────────────────────────────────────────────┤
│  DynamoDB (Connections)  │  SQS (Messages)  │  SNS (Broadcasting)   │
└─────────────────────────────────────────────────────────────────────┘
```

## 连接管理架构

### 1. 连接存储设计

#### DynamoDB 连接表
```javascript
// connections 表结构
{
  "connection_id": "abc123", // 分区键
  "user_id": "user_123",
  "device_info": {
    "platform": "web",
    "version": "1.0.0",
    "user_agent": "Mozilla/5.0..."
  },
  "connected_at": "2024-01-01T12:00:00Z",
  "last_ping": "2024-01-01T12:05:00Z",
  "status": "connected", // connected, disconnected
  "rooms": ["room_1", "room_2"], // 用户加入的房间
  "ttl": 1704110400 // 自动清理过期连接
}

// GSI: user_id-connection_id-index
// 用于快速查找用户的所有连接
```

#### Redis 连接缓存
```javascript
// 用户在线状态缓存
Key: `user:online:${user_id}`
Value: {
  "status": "online",
  "connections": ["connection_id_1", "connection_id_2"],
  "last_seen": "2024-01-01T12:00:00Z"
}
TTL: 300 seconds

// 连接详情缓存
Key: `connection:${connection_id}`
Value: {
  "user_id": "user_123",
  "rooms": ["room_1", "room_2"],
  "device_info": {...}
}
TTL: 3600 seconds
```

### 2. 连接管理 Lambda

#### 连接建立处理
```typescript
// connect-handler.ts
import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

export const handler: APIGatewayProxyHandler = async (event) => {
  const { connectionId, requestContext } = event;
  const { authorizer } = requestContext;
  
  // 从 JWT 获取用户信息
  const userId = authorizer?.userId;
  if (!userId) {
    return { statusCode: 401, body: 'Unauthorized' };
  }
  
  // 存储连接信息
  const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  
  try {
    await dynamoClient.send(new PutCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      Item: {
        connection_id: connectionId,
        user_id: userId,
        connected_at: new Date().toISOString(),
        last_ping: new Date().toISOString(),
        status: 'connected',
        rooms: [],
        ttl: Math.floor(Date.now() / 1000) + 3600, // 1小时TTL
        device_info: {
          platform: event.headers['user-agent'] || 'unknown',
          ip: event.requestContext.identity.sourceIp
        }
      }
    }));
    
    // 更新用户在线状态
    await updateUserOnlineStatus(userId, connectionId, 'online');
    
    // 通知好友用户上线
    await notifyFriendsUserOnline(userId);
    
    return { statusCode: 200, body: 'Connected' };
  } catch (error) {
    console.error('Connection error:', error);
    return { statusCode: 500, body: 'Connection failed' };
  }
};
```

#### 连接断开处理
```typescript
// disconnect-handler.ts
export const handler: APIGatewayProxyHandler = async (event) => {
  const { connectionId } = event;
  
  try {
    // 获取连接信息
    const connection = await getConnection(connectionId);
    if (!connection) {
      return { statusCode: 200, body: 'Already disconnected' };
    }
    
    // 更新连接状态
    await updateConnectionStatus(connectionId, 'disconnected');
    
    // 检查用户是否还有其他连接
    const userConnections = await getUserConnections(connection.user_id);
    const activeConnections = userConnections.filter(c => 
      c.connection_id !== connectionId && c.status === 'connected'
    );
    
    // 如果没有其他连接，标记用户为离线
    if (activeConnections.length === 0) {
      await updateUserOnlineStatus(connection.user_id, null, 'offline');
      await notifyFriendsUserOffline(connection.user_id);
    }
    
    return { statusCode: 200, body: 'Disconnected' };
  } catch (error) {
    console.error('Disconnect error:', error);
    return { statusCode: 500, body: 'Disconnect failed' };
  }
};
```

## 消息传递架构

### 1. 消息处理流程

#### 消息发送流程
```
Client → WebSocket → API Gateway → Lambda → DynamoDB (存储)
                                       ↓
                                    SQS Queue → Lambda → 推送给接收者
```

#### 消息处理 Lambda
```typescript
// message-handler.ts
import { APIGatewayProxyHandler } from 'aws-lambda';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';

export const handler: APIGatewayProxyHandler = async (event) => {
  const { connectionId, body } = event;
  
  try {
    const message = JSON.parse(body);
    const { action, data } = message;
    
    switch (action) {
      case 'send_message':
        await handleSendMessage(connectionId, data);
        break;
      case 'join_room':
        await handleJoinRoom(connectionId, data);
        break;
      case 'leave_room':
        await handleLeaveRoom(connectionId, data);
        break;
      case 'typing_start':
        await handleTypingStart(connectionId, data);
        break;
      case 'typing_stop':
        await handleTypingStop(connectionId, data);
        break;
      default:
        return { statusCode: 400, body: 'Unknown action' };
    }
    
    return { statusCode: 200, body: 'Message processed' };
  } catch (error) {
    console.error('Message handling error:', error);
    return { statusCode: 500, body: 'Message processing failed' };
  }
};

async function handleSendMessage(connectionId: string, data: any) {
  const { conversation_id, message_type, content, reply_to_message_id } = data;
  
  // 获取发送者信息
  const connection = await getConnection(connectionId);
  if (!connection) {
    throw new Error('Connection not found');
  }
  
  // 生成消息ID
  const messageId = generateMessageId();
  const timestamp = new Date().toISOString();
  
  // 构造消息对象
  const messageData = {
    message_id: messageId,
    conversation_id,
    sender_id: connection.user_id,
    message_type,
    content,
    reply_to_message_id,
    timestamp,
    is_read: false,
    is_deleted: false
  };
  
  // 存储消息到 DynamoDB
  await saveMessage(messageData);
  
  // 发送到消息队列进行分发
  const sqsClient = new SQSClient({});
  await sqsClient.send(new SendMessageCommand({
    QueueUrl: process.env.MESSAGE_QUEUE_URL,
    MessageBody: JSON.stringify({
      action: 'deliver_message',
      data: messageData
    })
  }));
}
```

### 2. 消息分发系统

#### 消息分发 Lambda
```typescript
// message-delivery-handler.ts
import { SQSHandler } from 'aws-lambda';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

export const handler: SQSHandler = async (event) => {
  const apiGatewayClient = new ApiGatewayManagementApiClient({
    endpoint: process.env.WEBSOCKET_API_ENDPOINT
  });
  
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      const { action, data } = message;
      
      switch (action) {
        case 'deliver_message':
          await deliverMessage(apiGatewayClient, data);
          break;
        case 'broadcast_to_room':
          await broadcastToRoom(apiGatewayClient, data);
          break;
        case 'notify_typing':
          await notifyTyping(apiGatewayClient, data);
          break;
      }
    } catch (error) {
      console.error('Message delivery error:', error);
    }
  }
};

async function deliverMessage(client: ApiGatewayManagementApiClient, messageData: any) {
  const { conversation_id, sender_id } = messageData;
  
  // 获取对话参与者
  const participants = await getConversationParticipants(conversation_id);
  
  // 获取接收者的连接
  const receiverConnections = await Promise.all(
    participants
      .filter(p => p !== sender_id)
      .map(userId => getUserConnections(userId))
  );
  
  // 发送消息给所有接收者的连接
  const deliveryPromises = receiverConnections
    .flat()
    .filter(conn => conn.status === 'connected')
    .map(async (connection) => {
      try {
        await client.send(new PostToConnectionCommand({
          ConnectionId: connection.connection_id,
          Data: JSON.stringify({
            event: 'message_received',
            data: messageData
          })
        }));
      } catch (error) {
        if (error.statusCode === 410) {
          // 连接已断开，清理
          await cleanupConnection(connection.connection_id);
        }
      }
    });
  
  await Promise.all(deliveryPromises);
}
```

## 房间管理系统

### 1. 房间概念设计

#### 房间类型
```typescript
enum RoomType {
  PRIVATE_CHAT = 'private_chat',    // 私聊房间
  GROUP_CHAT = 'group_chat',        // 群聊房间
  MOMENTS = 'moments',              // 朋友圈更新
  NOTIFICATIONS = 'notifications'   // 系统通知
}

interface Room {
  room_id: string;
  room_type: RoomType;
  participants: string[];
  created_at: string;
  metadata: Record<string, any>;
}
```

#### 房间管理 Lambda
```typescript
// room-manager.ts
export class RoomManager {
  async joinRoom(connectionId: string, roomId: string) {
    // 获取连接信息
    const connection = await getConnection(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }
    
    // 验证用户是否有权限加入房间
    const hasPermission = await checkRoomPermission(connection.user_id, roomId);
    if (!hasPermission) {
      throw new Error('Permission denied');
    }
    
    // 将连接加入房间
    await addConnectionToRoom(connectionId, roomId);
    
    // 通知房间内其他用户
    await broadcastToRoom(roomId, {
      event: 'user_joined',
      data: {
        user_id: connection.user_id,
        room_id: roomId,
        timestamp: new Date().toISOString()
      }
    }, [connectionId]);
  }
  
  async leaveRoom(connectionId: string, roomId: string) {
    const connection = await getConnection(connectionId);
    if (!connection) {
      return;
    }
    
    // 从房间移除连接
    await removeConnectionFromRoom(connectionId, roomId);
    
    // 通知房间内其他用户
    await broadcastToRoom(roomId, {
      event: 'user_left',
      data: {
        user_id: connection.user_id,
        room_id: roomId,
        timestamp: new Date().toISOString()
      }
    }, [connectionId]);
  }
}
```

### 2. 群聊房间管理

#### 群聊消息分发
```typescript
async function handleGroupMessage(messageData: any) {
  const { conversation_id, sender_id, content } = messageData;
  
  // 获取群成员
  const groupMembers = await getGroupMembers(conversation_id);
  
  // 获取所有成员的连接
  const memberConnections = await Promise.all(
    groupMembers
      .filter(member => member.user_id !== sender_id)
      .map(member => getUserConnections(member.user_id))
  );
  
  // 发送消息给群成员
  const deliveryPromises = memberConnections
    .flat()
    .filter(conn => conn.status === 'connected')
    .map(connection => deliverMessageToConnection(connection, messageData));
  
  await Promise.all(deliveryPromises);
}
```

## 状态同步机制

### 1. 在线状态管理

#### 用户状态更新
```typescript
// status-manager.ts
export class StatusManager {
  async updateUserStatus(userId: string, status: 'online' | 'offline' | 'away') {
    // 更新 Redis 缓存
    await this.redisClient.setex(
      `user:status:${userId}`,
      300, // 5分钟TTL
      JSON.stringify({
        status,
        last_updated: new Date().toISOString()
      })
    );
    
    // 通知好友状态变化
    await this.notifyFriendsStatusChange(userId, status);
  }
  
  async notifyFriendsStatusChange(userId: string, status: string) {
    // 获取用户好友列表
    const friends = await getFriends(userId);
    
    // 获取在线好友的连接
    const friendConnections = await Promise.all(
      friends.map(friend => getUserConnections(friend.user_id))
    );
    
    // 发送状态更新通知
    const statusUpdate = {
      event: 'friend_status_update',
      data: {
        user_id: userId,
        status,
        timestamp: new Date().toISOString()
      }
    };
    
    const deliveryPromises = friendConnections
      .flat()
      .filter(conn => conn.status === 'connected')
      .map(connection => deliverMessageToConnection(connection, statusUpdate));
    
    await Promise.all(deliveryPromises);
  }
}
```

### 2. 消息状态同步

#### 已读状态同步
```typescript
async function handleMessageRead(connectionId: string, data: any) {
  const { message_id, conversation_id } = data;
  
  // 获取连接信息
  const connection = await getConnection(connectionId);
  if (!connection) {
    return;
  }
  
  // 更新消息已读状态
  await updateMessageReadStatus(message_id, connection.user_id);
  
  // 获取消息发送者
  const message = await getMessage(message_id);
  if (!message) {
    return;
  }
  
  // 通知消息发送者
  const senderConnections = await getUserConnections(message.sender_id);
  const readReceipt = {
    event: 'message_read',
    data: {
      message_id,
      reader_id: connection.user_id,
      conversation_id,
      read_at: new Date().toISOString()
    }
  };
  
  const deliveryPromises = senderConnections
    .filter(conn => conn.status === 'connected')
    .map(connection => deliverMessageToConnection(connection, readReceipt));
  
  await Promise.all(deliveryPromises);
}
```

## 性能优化策略

### 1. 连接池管理

#### 连接清理机制
```typescript
// connection-cleanup.ts
export const cleanupHandler = async () => {
  const now = Date.now();
  const cutoffTime = now - (5 * 60 * 1000); // 5分钟前
  
  // 查找过期连接
  const expiredConnections = await scanExpiredConnections(cutoffTime);
  
  // 批量清理过期连接
  const cleanupPromises = expiredConnections.map(async (connection) => {
    try {
      // 尝试发送ping消息
      await sendPingToConnection(connection.connection_id);
    } catch (error) {
      // 如果ping失败，清理连接
      await cleanupConnection(connection.connection_id);
    }
  });
  
  await Promise.all(cleanupPromises);
};
```

### 2. 消息缓存策略

#### 热点消息缓存
```typescript
// message-cache.ts
export class MessageCache {
  private redis: Redis;
  
  async cacheRecentMessages(conversationId: string, messages: any[]) {
    const cacheKey = `conversation:${conversationId}:recent`;
    const pipeline = this.redis.pipeline();
    
    // 清除旧缓存
    pipeline.del(cacheKey);
    
    // 添加最新消息
    messages.forEach(message => {
      pipeline.lpush(cacheKey, JSON.stringify(message));
    });
    
    // 设置TTL
    pipeline.expire(cacheKey, 3600); // 1小时
    
    await pipeline.exec();
  }
  
  async getRecentMessages(conversationId: string): Promise<any[]> {
    const cacheKey = `conversation:${conversationId}:recent`;
    const cachedMessages = await this.redis.lrange(cacheKey, 0, 49); // 最新50条
    
    return cachedMessages.map(msg => JSON.parse(msg));
  }
}
```

### 3. 负载均衡策略

#### 连接分片
```typescript
// connection-router.ts
export class ConnectionRouter {
  // 根据用户ID分配连接到不同的WebSocket实例
  getWebSocketEndpoint(userId: string): string {
    const shard = this.hashUserId(userId) % this.shardCount;
    return `wss://ws-${shard}.yourapp.com`;
  }
  
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32位整数
    }
    return Math.abs(hash);
  }
}
```

## 监控和诊断

### 1. 连接监控

#### CloudWatch 指标
```typescript
// metrics.ts
export class ConnectionMetrics {
  private cloudWatch: CloudWatch;
  
  async reportConnectionMetrics() {
    const activeConnections = await this.getActiveConnectionCount();
    const messageRate = await this.getMessageRate();
    
    await this.cloudWatch.putMetricData({
      Namespace: 'WeChat/WebSocket',
      MetricData: [
        {
          MetricName: 'ActiveConnections',
          Value: activeConnections,
          Unit: 'Count'
        },
        {
          MetricName: 'MessageRate',
          Value: messageRate,
          Unit: 'Count/Second'
        }
      ]
    });
  }
}
```

### 2. 错误处理和重试

#### 消息重试机制
```typescript
// retry-handler.ts
export class RetryHandler {
  async handleFailedMessage(messageData: any, error: any) {
    const retryCount = messageData.retry_count || 0;
    
    if (retryCount >= 3) {
      // 超过重试次数，记录到死信队列
      await this.sendToDeadLetterQueue(messageData, error);
      return;
    }
    
    // 指数退避重试
    const delay = Math.pow(2, retryCount) * 1000;
    
    setTimeout(async () => {
      await this.retryMessage({
        ...messageData,
        retry_count: retryCount + 1
      });
    }, delay);
  }
}
```

## 扩展性考虑

### 1. 水平扩展

#### 多实例消息同步
```typescript
// cluster-sync.ts
export class ClusterSync {
  async broadcastToCluster(event: string, data: any) {
    // 使用 Redis Pub/Sub 在集群间同步
    await this.redis.publish('cluster:sync', JSON.stringify({
      event,
      data,
      timestamp: new Date().toISOString(),
      source_instance: process.env.INSTANCE_ID
    }));
  }
  
  async subscribeToClusterEvents() {
    this.redis.subscribe('cluster:sync');
    this.redis.on('message', (channel, message) => {
      if (channel === 'cluster:sync') {
        const event = JSON.parse(message);
        this.handleClusterEvent(event);
      }
    });
  }
}
```

### 2. 地理分布

#### 区域化部署
```typescript
// region-router.ts
export class RegionRouter {
  getOptimalRegion(userLocation: string): string {
    // 根据用户位置选择最近的区域
    const regions = {
      'asia-pacific': ['ap-southeast-1', 'ap-northeast-1'],
      'north-america': ['us-east-1', 'us-west-2'],
      'europe': ['eu-west-1', 'eu-central-1']
    };
    
    // 简化的区域选择逻辑
    if (userLocation.includes('CN')) {
      return regions['asia-pacific'][0];
    } else if (userLocation.includes('US')) {
      return regions['north-america'][0];
    } else {
      return regions['europe'][0];
    }
  }
}
```

这套实时通信方案提供了完整的 WebSocket 连接管理、消息传递、房间管理和状态同步机制，能够支持大规模的实时通信需求。