import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  FILE = 'file',
  LOCATION = 'location',
}

export class SendMessageDto {
  @ApiProperty({ example: 'user_123#user_456' })
  @IsString()
  conversationId: string;

  @ApiProperty({ enum: MessageType, example: MessageType.TEXT })
  @IsEnum(MessageType)
  messageType: MessageType;

  @ApiPropertyOptional({ example: 'Hello world!' })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({ example: 'https://example.com/image.jpg' })
  @IsString()
  @IsOptional()
  mediaUrl?: string;

  @ApiPropertyOptional({ example: 1024 })
  @IsOptional()
  fileSize?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  duration?: number;

  @ApiPropertyOptional({ example: 'msg_123' })
  @IsString()
  @IsOptional()
  replyToId?: string;
}