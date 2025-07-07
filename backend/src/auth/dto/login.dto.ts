import { IsString, IsEmail, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ 
    example: '+8613800138000', 
    description: '手机号或邮箱' 
  })
  @IsString()
  identifier: string; // 可以是手机号或邮箱

  @ApiProperty({ example: 'securePassword123' })
  @IsString()
  password: string;
}