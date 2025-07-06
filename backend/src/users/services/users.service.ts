import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/services/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import * as bcrypt from 'bcryptjs';

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

  async findAll(searchDto: SearchUsersDto) {
    const { q, limit = 10, offset = 0 } = searchDto;
    
    const where = q ? {
      OR: [
        { username: { contains: q, mode: 'insensitive' as const } },
        { nickname: { contains: q, mode: 'insensitive' as const } },
        { email: { contains: q, mode: 'insensitive' as const } },
      ],
      isActive: true,
    } : { isActive: true };

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

    return {
      users,
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

  async remove(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }
}