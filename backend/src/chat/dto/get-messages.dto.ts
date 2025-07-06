import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class GetMessagesDto {
  @ApiPropertyOptional({ example: 50, default: 50 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  limit?: number = 50;

  @ApiPropertyOptional({ example: '2024-01-01T12:00:00Z' })
  @IsString()
  @IsOptional()
  beforeTimestamp?: string;
}