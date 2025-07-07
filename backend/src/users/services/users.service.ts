import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { SearchUsersDto } from '../dto/search-users.dto';
import { UpdateUserSettingsDto } from '../dto/user-settings.dto';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const { password, birthday, ...userData } = createUserDto;
    
    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phoneNumber: createUserDto.phoneNumber },
          { username: createUserDto.username },
          ...(createUserDto.email ? [{ email: createUserDto.email }] : []),
        ],
      },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    return this.prisma.user.create({
      data: {
        ...userData,
        passwordHash,
        birthday: birthday ? new Date(birthday) : null,
      },
      select: {
        id: true,
        phoneNumber: true,
        email: true,
        username: true,
        nickname: true,
        avatarUrl: true,
        bio: true,
        gender: true,
        birthday: true,
        location: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findAll(searchDto: SearchUsersDto, currentUserId?: string) {
    const { q, limit = 10, offset = 0 } = searchDto;
    
    const where = q ? {
      OR: [
        { username: { contains: q, mode: 'insensitive' as const } },
        { nickname: { contains: q, mode: 'insensitive' as const } },
        { email: { contains: q, mode: 'insensitive' as const } },
      ],
      isActive: true,
      // 不包括当前用户自己
      ...(currentUserId && { id: { not: currentUserId } }),
    } : { 
      isActive: true,
      ...(currentUserId && { id: { not: currentUserId } }),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          nickname: true,
          avatarUrl: true,
          bio: true,
          isActive: true,
        },
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    // 如果提供了当前用户ID，获取与这些用户的好友关系状态
    let usersWithFriendshipStatus = users;
    if (currentUserId) {
      const friendships = await this.prisma.friendship.findMany({
        where: {
          OR: [
            { 
              userId: currentUserId,
              friendId: { in: users.map(u => u.id) },
            },
            {
              userId: { in: users.map(u => u.id) },
              friendId: currentUserId,
            },
          ],
        },
      });

      usersWithFriendshipStatus = users.map(user => {
        const friendship = friendships.find(f => 
          (f.userId === currentUserId && f.friendId === user.id) ||
          (f.userId === user.id && f.friendId === currentUserId)
        );

        return {
          ...user,
          friendshipStatus: friendship?.status || null, // null: no relationship, 0: pending, 1: friends, 2: rejected, 3: blocked
          isPendingRequest: friendship?.userId === currentUserId && friendship?.status === 0,
          hasReceivedRequest: friendship?.userId === user.id && friendship?.status === 0,
        };
      });
    }

    return {
      users: usersWithFriendshipStatus,
      meta: {
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        phoneNumber: true,
        email: true,
        username: true,
        nickname: true,
        avatarUrl: true,
        bio: true,
        gender: true,
        birthday: true,
        location: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByPhoneNumber(phoneNumber: string) {
    return this.prisma.user.findUnique({
      where: { phoneNumber },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const { birthday, ...userData } = updateUserDto;
    
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...userData,
        birthday: birthday ? new Date(birthday) : undefined,
      },
      select: {
        id: true,
        phoneNumber: true,
        email: true,
        username: true,
        nickname: true,
        avatarUrl: true,
        bio: true,
        gender: true,
        birthday: true,
        location: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async uploadAvatar(userId: string, file: MulterFile) {
    if (!file) {
      throw new NotFoundException('No file uploaded');
    }

    // 简单的文件存储到本地 (生产环境建议使用 AWS S3)
    const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileExtension = path.extname(file.originalname);
    const fileName = `${userId}-${Date.now()}${fileExtension}`;
    const filePath = path.join(uploadDir, fileName);
    
    fs.writeFileSync(filePath, file.buffer);
    
    const avatarUrl = `/uploads/avatars/${fileName}`;
    
    // 更新用户头像
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        id: true,
        avatarUrl: true,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getSettings(userId: string) {
    let settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    // 如果用户没有设置记录，创建默认设置
    if (!settings) {
      settings = await this.prisma.userSettings.create({
        data: { userId },
      });
    }

    return settings;
  }

  async updateSettings(userId: string, updateSettingsDto: UpdateUserSettingsDto) {
    // 确保用户设置记录存在
    await this.getSettings(userId);

    return this.prisma.userSettings.update({
      where: { userId },
      data: updateSettingsDto,
    });
  }

  async resetSettings(userId: string) {
    // 删除现有设置，这将触发创建默认设置
    await this.prisma.userSettings.delete({
      where: { userId },
    }).catch(() => {
      // 忽略删除错误（如果记录不存在）
    });

    // 创建新的默认设置
    return this.prisma.userSettings.create({
      data: { userId },
    });
  }
}