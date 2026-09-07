import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
export class RegisterDto {
	@ApiProperty()
	@IsEmail()
	email: string;
	@ApiProperty({ minLength: 8, maxLength: 72 })
	@IsString()
	@MinLength(8)
	@MaxLength(72)
	password: string;
	@ApiProperty({ minLength: 2, maxLength: 40 })
	@IsString()
	@MinLength(2)
	@MaxLength(40)
	displayName: string;
}
