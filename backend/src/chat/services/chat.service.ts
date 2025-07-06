import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { SendMessageDto } from '../dto/send-message.dto';
import { GetMessagesDto } from '../dto/get-messages.dto';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async sendMessage(senderId: string, sendMessageDto: SendMessageDto) {
    const message = await this.prisma.message.create({
      data: {
        conversationId: sendMessageDto.conversationId,
        senderId,
        messageType: sendMessageDto.messageType,
        content: sendMessageDto.content,
        mediaUrl: sendMessageDto.mediaUrl,
        fileSize: sendMessageDto.fileSize,
        duration: sendMessageDto.duration,
        replyToId: sendMessageDto.replyToId,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            nickname: true,
            avatarUrl: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            messageType: true,
            sender: {
              select: {
                nickname: true,
              },
            },
          },
        },
      },
    });

    return message;
  }

  async getMessages(conversationId: string, getMessagesDto: GetMessagesDto) {
    const { limit = 50, beforeTimestamp } = getMessagesDto;
    
    const where = {
      conversationId,
      isDeleted: false,
      ...(beforeTimestamp && { createdAt: { lt: new Date(beforeTimestamp) } }),
    };

    const messages = await this.prisma.message.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            nickname: true,
            avatarUrl: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            messageType: true,
            sender: {
              select: {
                nickname: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages.reverse(); // Return in chronological order
  }

  async getConversations(userId: string) {
    // Get all conversations where user is either sender or receiver
    const conversations = await this.prisma.$queryRaw`
      SELECT DISTINCT 
        m.conversation_id,
        m.content as last_message_content,
        m.created_at as last_message_timestamp,
        m.sender_id as last_message_sender_id,
        u.nickname as last_message_sender_nickname
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id LIKE ${`%${userId}%`}
      AND m.id IN (
        SELECT id FROM messages m2 
        WHERE m2.conversation_id = m.conversation_id 
        ORDER BY m2.created_at DESC 
        LIMIT 1
      )
      ORDER BY m.created_at DESC
    ` as any[];

    // Get conversation participants
    const conversationsWithParticipants = await Promise.all(
      conversations.map(async (conv: any) => {
        const participantIds = conv.conversation_id.split('#');
        const otherUserId = participantIds.find((id: string) => id !== userId);
        
        if (otherUserId) {
          const otherUser = await this.prisma.user.findUnique({
            where: { id: otherUserId },
            select: {
              id: true,
              username: true,
              nickname: true,
              avatarUrl: true,
            },
          });

          return {
            conversationId: conv.conversation_id,
            conversationType: 'private',
            participants: [otherUser],
            lastMessage: {
              content: conv.last_message_content,
              timestamp: conv.last_message_timestamp,
              senderId: conv.last_message_sender_id,
              senderNickname: conv.last_message_sender_nickname,
            },
            unreadCount: 0, // TODO: Implement unread count
          };
        }
        return null;
      }),
    );

    return conversationsWithParticipants.filter(Boolean);
  }

  async markMessageAsRead(messageId: string, userId: string) {
    // For MVP, we'll just update the message
    // In production, you might want a separate read receipts table
    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        // Only allow marking as read if user is not the sender
        NOT: { senderId: userId },
      },
    });

    if (message) {
      await this.prisma.message.update({
        where: { id: messageId },
        data: { isRead: true },
      });
    }

    return { messageId, readAt: new Date() };
  }
}