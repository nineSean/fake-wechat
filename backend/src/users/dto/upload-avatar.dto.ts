import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UploadAvatarDto {
  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  avatar?: any;
}