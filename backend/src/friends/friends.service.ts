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
              isOnline: true,
              lastSeenAt: true,
            },
          },
        },
        skip: offset,
        take: limit,
        orderBy: [
          {
            friend: {
              isOnline: 'desc', // 在线用户优先
            },
          },
          {
            friend: {
              lastSeenAt: 'desc', // 然后按最后上线时间排序
            },
          },
        ],
      }),
      this.prisma.friendship.count({ where: whereCondition }),
    ]);

    return {
      friends: friends.map(f => ({
        ...f.friend,
        onlineStatus: this.getOnlineStatus(f.friend.isOnline, f.friend.lastSeenAt),
      })),
      meta: {
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
      },
    };
  }

  // 获取在线状态描述
  private getOnlineStatus(isOnline: boolean, lastSeenAt: Date | null): string {
    if (isOnline) {
      return 'online';
    }

    if (!lastSeenAt) {
      return 'unknown';
    }

    const now = new Date();
    const diffMs = now.getTime() - lastSeenAt.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 5) {
      return 'recently';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}分钟前`;
    } else if (diffHours < 24) {
      return `${diffHours}小时前`;
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return 'long_ago';
    }
  }

  // 更新用户在线状态
  async updateOnlineStatus(userId: string, isOnline: boolean) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        isOnline,
        lastSeenAt: new Date(),
        ...(isOnline && { lastLoginAt: new Date() }),
      },
    });
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

  // 拉黑用户
  async blockUser(userId: string, targetUserId: string) {
    // 不能拉黑自己
    if (userId === targetUserId) {
      throw new BadRequestException('Cannot block yourself');
    }

    // 检查目标用户是否存在
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId, isActive: true },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // 删除现有的好友关系（如果存在）
    await this.prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId, friendId: targetUserId },
          { userId: targetUserId, friendId: userId },
        ],
      },
    });

    // 创建拉黑记录
    return this.prisma.friendship.create({
      data: {
        userId,
        friendId: targetUserId,
        status: 3, // blocked
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

  // 取消拉黑
  async unblockUser(userId: string, targetUserId: string) {
    const blockRecord = await this.prisma.friendship.findFirst({
      where: {
        userId,
        friendId: targetUserId,
        status: 3, // blocked
      },
    });

    if (!blockRecord) {
      throw new NotFoundException('Block record not found');
    }

    await this.prisma.friendship.delete({
      where: { id: blockRecord.id },
    });

    return { success: true };
  }

  // 获取拉黑列表
  async getBlockedUsers(userId: string, query: GetFriendsDto) {
    const { q, limit = 20, offset = 0 } = query;

    const whereCondition = {
      userId,
      status: 3, // blocked
      ...(q && {
        friend: {
          OR: [
            { username: { contains: q, mode: 'insensitive' as const } },
            { nickname: { contains: q, mode: 'insensitive' as const } },
          ],
        },
      }),
    };

    const [blockedUsers, total] = await Promise.all([
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
            },
          },
        },
        skip: offset,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.friendship.count({ where: whereCondition }),
    ]);

    return {
      blockedUsers: blockedUsers.map(b => b.friend),
      meta: {
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
      },
    };
  }
}