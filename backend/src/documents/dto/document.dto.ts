import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentAccess } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateDocumentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}

export class MoveDocumentDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rank?: string;
}

export class RenameDocumentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title: string;
}

export class ShareDocumentDto {
  @ApiPropertyOptional()
  @ValidateIf((dto: ShareDocumentDto) => !dto.email)
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: ShareDocumentDto) => !dto.userId)
  @IsEmail()
  email?: string;

  @ApiProperty({ enum: DocumentAccess })
  @IsEnum(DocumentAccess)
  access: DocumentAccess;
}

export class CreatePublicLinkDto {
  @ApiProperty({ enum: DocumentAccess })
  @IsEnum(DocumentAccess)
  access: DocumentAccess;

  @ApiPropertyOptional()
  @IsOptional()
  expiresAt?: string;
}

export class PublishDocumentDto {
  @ApiProperty()
  @IsBoolean()
  published: boolean;
}
