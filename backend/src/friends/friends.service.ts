import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../shared/services/prisma.service';
import { SendFriendRequestDto, HandleFriendRequestDto } from './dto/friend-request.dto';
import { GetFriendsDto } from './dto/get-friends.dto';

@Injectable()
export class FriendsService {
  constructor(private prisma: PrismaService) {}

  // 发送好友请求
  async sendFriendRequest(userId: string, sendFriendRequestDto: SendFriendRequestDto) {
    const { friendId } = sendFriendRequestDto;

    // 不能添加自己为好友
    if (userId === friendId) {
      throw new BadRequestException('Cannot add yourself as friend');
    }

    // 检查目标用户是否存在
    const targetUser = await this.prisma.user.findUnique({
      where: { id: friendId, isActive: true },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // 检查是否已存在好友关系或待处理请求
    const existingFriendship = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    });

    if (existingFriendship) {
      if (existingFriendship.status === 1) {
        throw new ConflictException('Already friends');
      }
      if (existingFriendship.status === 0) {
        throw new ConflictException('Friend request already pending');
      }
      if (existingFriendship.status === 3) {
        throw new ConflictException('User is blocked');
      }
    }

    // 创建好友请求
    return this.prisma.friendship.create({
      data: {
        userId,
        friendId,
        status: 0, // pending
      },
      include: {
        friend: {
          select: {
            id: true,
            username: true,
            nickname: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  // 获取收到的好友请求
  async getFriendRequests(userId: string) {
    return this.prisma.friendship.findMany({
      where: {
        friendId: userId,
        status: 0, // pending
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            avatarUrl: true,
            bio: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // 处理好友请求
  async handleFriendRequest(userId: string, requestId: string, handleDto: HandleFriendRequestDto) {
    const { action } = handleDto;

    // 查找好友请求
    const friendRequest = await this.prisma.friendship.findFirst({
      where: {
        id: requestId,
        friendId: userId,
        status: 0, // pending
      },
    });

    if (!friendRequest) {
      throw new NotFoundException('Friend request not found');
    }

    const newStatus = action === 'accept' ? 1 : 2; // 1: accepted, 2: rejected

    if (action === 'accept') {
      // 接受好友请求：更新状态并创建双向关系
      await this.prisma.$transaction([
        // 更新原请求状态
        this.prisma.friendship.update({
          where: { id: requestId },
          data: { status: newStatus },
        }),
        // 创建反向好友关系
        this.prisma.friendship.create({
          data: {
            userId,
            friendId: friendRequest.userId,
            status: 1, // accepted
          },
        }),
      ]);
    } else {
      // 拒绝好友请求：只更新状态
      await this.prisma.friendship.update({
        where: { id: requestId },
        data: { status: newStatus },
      });
    }

    return { success: true, action };
  }

  // 获取好友列表
  async getFriends(userId: string, query: GetFriendsDto) {
    const { q, limit = 20, offset = 0 } = query;

    const whereCondition = {
      userId,
      status: 1, // accepted
      ...(q && {
        friend: {
          OR: [
            { username: { contains: q, mode: 'insensitive' as const } },
            { nickname: { contains: q, mode: 'insensitive' as const } },
          ],
        },
      }),
    };

    const [friends, total] = await Promise.all([
      this.prisma.friendship.findMany({
        where: whereCondition,
        include: {
          friend: {
            select: {
              id: true,
              username: true,
              nickname: true,
              avatarUrl: true,
              bio: true,
              lastLoginAt: true,
            },
          },
        },
        skip: offset,
        take: limit,
        orderBy: {
          friend: {
            lastLoginAt: 'desc',
          },
        },
      }),
      this.prisma.friendship.count({ where: whereCondition }),
    ]);

    return {
      friends: friends.map(f => f.friend),
      meta: {
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
      },
    };
  }

  // 删除好友
  async deleteFriend(userId: string, friendId: string) {
    // 检查好友关系是否存在
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        userId,
        friendId,
        status: 1, // accepted
      },
    });

    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    // 删除双向好友关系
    await this.prisma.$transaction([
      this.prisma.friendship.deleteMany({
        where: {
          OR: [
            { userId, friendId },
            { userId: friendId, friendId: userId },
          ],
          status: 1, // accepted
        },
      }),
    ]);

    return { success: true };
  }

  // 获取发送的好友请求
  async getSentFriendRequests(userId: string) {
    return this.prisma.friendship.findMany({
      where: {
        userId,
        status: 0, // pending
      },
      include: {
        friend: {
          select: {
            id: true,
            username: true,
            nickname: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}