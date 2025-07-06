import { IsString, IsPhoneNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: '+8613800138000' })
  @IsString()
  phoneNumber: string;

  @ApiProperty({ example: 'securePassword123' })
  @IsString()
  password: string;
}