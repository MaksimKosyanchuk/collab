import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class PresignAssetDto {
  @ApiProperty()
  @IsString()
  mimeType: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  sizeBytes: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  documentId?: string;
}

export class ConfirmAssetDto {
  @ApiProperty()
  @IsString()
  objectKey: string;

  @ApiProperty()
  @IsString()
  mimeType: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  sizeBytes: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  documentId?: string;
}
