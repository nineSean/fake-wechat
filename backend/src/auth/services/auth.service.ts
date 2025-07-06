import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/services/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(phoneNumber: string, password: string): Promise<any> {
    const user = await this.usersService.findByPhoneNumber(phoneNumber);
    if (user && await bcrypt.compare(password, user.passwordHash)) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const { phoneNumber, password } = loginDto;
    const user = await this.validateUser(phoneNumber, password);
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const payload = { 
      sub: user.id, 
      username: user.username, 
      phoneNumber: user.phoneNumber,
      email: user.email 
    };

    return {
      access_token: this.jwtService.sign(payload),
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
    
    const payload = { 
      sub: user.id, 
      username: user.username, 
      phoneNumber: user.phoneNumber,
      email: user.email 
    };

    return {
      access_token: this.jwtService.sign(payload),
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
}