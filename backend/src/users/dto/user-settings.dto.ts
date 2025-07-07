import { IsBoolean, IsString, IsIn, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UserSettingsDto {
  @ApiProperty({ description: '个人资料可见性', enum: ['public', 'friends', 'private'], default: 'public' })
  @IsString()
  @IsIn(['public', 'friends', 'private'])
  @IsOptional()
  profileVisibility?: string;

  @ApiProperty({ description: '手机号可见性', enum: ['public', 'friends', 'private'], default: 'friends' })
  @IsString()
  @IsIn(['public', 'friends', 'private'])
  @IsOptional()
  phoneVisibility?: string;

  @ApiProperty({ description: '邮箱可见性', enum: ['public', 'friends', 'private'], default: 'private' })
  @IsString()
  @IsIn(['public', 'friends', 'private'])
  @IsOptional()
  emailVisibility?: string;

  @ApiProperty({ description: '最后上线时间可见性', enum: ['everyone', 'contacts', 'nobody'], default: 'everyone' })
  @IsString()
  @IsIn(['everyone', 'contacts', 'nobody'])
  @IsOptional()
  lastSeenVisibility?: string;

  @ApiProperty({ description: '允许通过手机号搜索', default: true })
  @IsBoolean()
  @IsOptional()
  allowSearchByPhone?: boolean;

  @ApiProperty({ description: '允许通过邮箱搜索', default: false })
  @IsBoolean()
  @IsOptional()
  allowSearchByEmail?: boolean;

  @ApiProperty({ description: '消息通知', default: true })
  @IsBoolean()
  @IsOptional()
  messageNotifications?: boolean;

  @ApiProperty({ description: '群聊通知', default: true })
  @IsBoolean()
  @IsOptional()
  groupNotifications?: boolean;

  @ApiProperty({ description: '好友请求通知', default: true })
  @IsBoolean()
  @IsOptional()
  friendRequestNotifications?: boolean;

  @ApiProperty({ description: '邮件通知', default: false })
  @IsBoolean()
  @IsOptional()
  emailNotifications?: boolean;

  @ApiProperty({ description: '推送通知', default: true })
  @IsBoolean()
  @IsOptional()
  pushNotifications?: boolean;

  @ApiProperty({ description: '声音提醒', default: true })
  @IsBoolean()
  @IsOptional()
  soundEnabled?: boolean;

  @ApiProperty({ description: '震动提醒', default: true })
  @IsBoolean()
  @IsOptional()
  vibrationEnabled?: boolean;

  @ApiProperty({ description: '已读回执', default: true })
  @IsBoolean()
  @IsOptional()
  readReceipts?: boolean;

  @ApiProperty({ description: '正在输入提示', default: true })
  @IsBoolean()
  @IsOptional()
  typingIndicators?: boolean;

  @ApiProperty({ description: '自动下载图片', default: true })
  @IsBoolean()
  @IsOptional()
  autoDownloadImages?: boolean;

  @ApiProperty({ description: '自动下载视频', default: false })
  @IsBoolean()
  @IsOptional()
  autoDownloadVideos?: boolean;
}

export class UpdateUserSettingsDto extends UserSettingsDto {}