import { IsEmail, IsOptional, IsString, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: '+8613800138000' })
  @IsString()
  phoneNumber: string;

  @ApiProperty({ example: 'securePassword123' })
  @IsString()
  password: string;

  @ApiProperty({ example: 'john_doe' })
  @IsString()
  username: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  nickname: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 'Hello, I am John!' })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiPropertyOptional({ example: 1, description: '0: unknown, 1: male, 2: female' })
  @IsInt()
  @Min(0)
  @Max(2)
  @IsOptional()
  gender?: number;

  @ApiPropertyOptional({ example: '1990-01-01' })
  @IsString()
  @IsOptional()
  birthday?: string;

  @ApiPropertyOptional({ example: 'Beijing, China' })
  @IsString()
  @IsOptional()
  location?: string;
}