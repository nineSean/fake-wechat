import { CreateUserDto } from '../../users/dto/create-user.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RegisterDto extends CreateUserDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  verificationCode: string;
}