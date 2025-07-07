import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendFriendRequestDto {
  @ApiProperty({ description: '要添加的用户ID' })
  @IsString()
  @IsNotEmpty()
  friendId: string;
}

export class HandleFriendRequestDto {
  @ApiProperty({ description: '处理动作', enum: ['accept', 'reject'] })
  @IsString()
  @IsNotEmpty()
  action: 'accept' | 'reject';
}