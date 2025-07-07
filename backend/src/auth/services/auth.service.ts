import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/services/users.service';
import { PrismaService } from '../../shared/services/prisma.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async validateUser(identifier: string, password: string): Promise<any> {
    // 判断是邮箱还是手机号
    const isEmail = identifier.includes('@');
    const user = isEmail 
      ? await this.usersService.findByEmail(identifier)
      : await this.usersService.findByPhoneNumber(identifier);
      
    if (user && await bcrypt.compare(password, user.passwordHash)) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async generateTokens(user: any) {
    const payload = { 
      sub: user.id, 
      username: user.username, 
      phoneNumber: user.phoneNumber,
      email: user.email 
    };

    // 生成 access token (15分钟)
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRES_IN'),
    });

    // 生成 refresh token (7天)
    const refreshTokenPayload = { sub: user.id, type: 'refresh' };
    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN'),
    });

    // 存储 refresh token 到数据库
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7天后过期

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900, // 15分钟 = 900秒
      token_type: 'Bearer',
    };
  }

  async refreshAccessToken(refreshTokenDto: RefreshTokenDto) {
    const { refreshToken } = refreshTokenDto;

    try {
      // 验证 refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      // 检查 refresh token 是否在数据库中且未被撤销
      const storedToken = await this.prisma.refreshToken.findFirst({
        where: {
          token: refreshToken,
          isRevoked: false,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });

      if (!storedToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // 检查用户是否仍然活跃
      if (!storedToken.user.isActive) {
        throw new UnauthorizedException('User account is deactivated');
      }

      // 撤销旧的 refresh token
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { isRevoked: true },
      });

      // 生成新的 token 对
      return this.generateTokens(storedToken.user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async revokeRefreshToken(userId: string, refreshToken?: string) {
    if (refreshToken) {
      // 撤销特定的 refresh token
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          token: refreshToken,
        },
        data: { isRevoked: true },
      });
    } else {
      // 撤销用户的所有 refresh token (用于登出所有设备)
      await this.prisma.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true },
      });
    }
  }
  async login(loginDto: LoginDto) {
    const { identifier, password } = loginDto;
    const user = await this.validateUser(identifier, password);
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // 更新最后登录时间
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        phoneNumber: user.phoneNumber,
        email: user.email,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const { verificationCode, ...createUserDto } = registerDto;
    
    // For MVP, we'll skip SMS verification
    // In production, you should verify the verification code here
    
    const user = await this.usersService.create(createUserDto);
    
    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        phoneNumber: user.phoneNumber,
        email: user.email,
      },
    };
  }

  async logout(userId: string, refreshToken?: string) {
    await this.revokeRefreshToken(userId, refreshToken);
    return { message: 'Logged out successfully' };
  }
}