import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateThreadDto {
  @ApiProperty()
  @IsString()
  blockId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  body: string;
}

export class CreateCommentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  body: string;
}

export class ResolveThreadDto {
  @ApiPropertyOptional()
  @IsOptional()
  resolved?: boolean;
}
