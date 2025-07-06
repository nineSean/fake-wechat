import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from '../services/chat.service';
import { SendMessageDto } from '../dto/send-message.dto';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, string>(); // socketId -> userId

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;
      
      this.connectedUsers.set(client.id, userId);
      client.join(`user_${userId}`);
      
      // Broadcast user online status
      this.server.emit('user:online', {
        userId,
        status: 'online',
        timestamp: new Date(),
      });

      console.log(`User ${userId} connected with socket ${client.id}`);
    } catch (error) {
      console.error('WebSocket connection error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.connectedUsers.get(client.id);
    if (userId) {
      this.connectedUsers.delete(client.id);
      
      // Broadcast user offline status
      this.server.emit('user:offline', {
        userId,
        status: 'offline',
        lastSeen: new Date(),
      });

      console.log(`User ${userId} disconnected`);
    }
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @MessageBody() data: SendMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = this.connectedUsers.get(client.id);
      if (!userId) {
        client.emit('error', { message: 'User not authenticated' });
        return;
      }

      const message = await this.chatService.sendMessage(userId, data);
      
      // Send to conversation participants
      const conversationId = data.conversationId;
      const participantIds = conversationId.includes('#') 
        ? conversationId.split('#') 
        : [conversationId]; // For group chats

      participantIds.forEach(participantId => {
        this.server.to(`user_${participantId}`).emit('message:receive', {
          messageId: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          sender: message.sender,
          messageType: message.messageType,
          content: message.content,
          mediaUrl: message.mediaUrl,
          fileSize: message.fileSize,
          duration: message.duration,
          replyTo: message.replyTo,
          createdAt: message.createdAt,
        });
      });

      // Acknowledge to sender
      client.emit('message:sent', {
        messageId: message.id,
        timestamp: message.createdAt,
      });
    } catch (error) {
      console.error('Error sending message:', error);
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  @SubscribeMessage('message:read')
  async handleMarkAsRead(
    @MessageBody() data: { messageId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = this.connectedUsers.get(client.id);
      if (!userId) {
        client.emit('error', { message: 'User not authenticated' });
        return;
      }

      const result = await this.chatService.markMessageAsRead(data.messageId, userId);
      
      // Notify the sender about read receipt
      this.server.emit('message:read', {
        messageId: data.messageId,
        readerId: userId,
        readAt: result.readAt,
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
      client.emit('error', { message: 'Failed to mark message as read' });
    }
  }

  @SubscribeMessage('typing:start')
  async handleTypingStart(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.connectedUsers.get(client.id);
    if (!userId) return;

    const participantIds = data.conversationId.includes('#') 
      ? data.conversationId.split('#') 
      : [data.conversationId];

    participantIds.forEach(participantId => {
      if (participantId !== userId) {
        this.server.to(`user_${participantId}`).emit('typing:start', {
          conversationId: data.conversationId,
          userId,
        });
      }
    });
  }

  @SubscribeMessage('typing:stop')
  async handleTypingStop(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.connectedUsers.get(client.id);
    if (!userId) return;

    const participantIds = data.conversationId.includes('#') 
      ? data.conversationId.split('#') 
      : [data.conversationId];

    participantIds.forEach(participantId => {
      if (participantId !== userId) {
        this.server.to(`user_${participantId}`).emit('typing:stop', {
          conversationId: data.conversationId,
          userId,
        });
      }
    });
  }
}