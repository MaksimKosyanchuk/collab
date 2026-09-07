import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const ACCESS_TTL = '15m';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly jwt: JwtService,
		private readonly config: ConfigService,
	) {}

	async register(dto: RegisterDto) {
		const email = dto.email.toLowerCase().trim();
		const existing = await this.prisma.user.findUnique({ where: { email } });
		if (existing) {
			throw new ConflictException('Email already registered');
		}
		const passwordHash = await bcrypt.hash(dto.password, 12);
		const user = await this.prisma.user.create({
			data: {
				email,
				passwordHash,
				displayName: dto.displayName,
			},
		});
		return this.issueTokens(user.id, user.email, user.displayName);
	}

	async login(dto: LoginDto) {
		const email = dto.email.toLowerCase().trim();
		const user = await this.prisma.user.findUnique({ where: { email } });
		if (!user) {
			throw new UnauthorizedException('Invalid credentials');
		}
		const ok = await bcrypt.compare(dto.password, user.passwordHash);
		if (!ok) {
			throw new UnauthorizedException('Invalid credentials');
		}
		return this.issueTokens(user.id, user.email, user.displayName);
	}

	async refresh(rawToken?: string) {
		if (!rawToken) {
			throw new UnauthorizedException('Missing refresh token');
		}
		const tokenHash = hashToken(rawToken);
		const stored = await this.prisma.refreshToken.findUnique({
			where: { tokenHash },
			include: { user: true },
		});
		if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
			throw new UnauthorizedException('Invalid refresh token');
		}
		await this.prisma.refreshToken.update({
			where: { id: stored.id },
			data: { revokedAt: new Date() },
		});
		return this.issueTokens(stored.user.id, stored.user.email, stored.user.displayName);
	}

	async logout(rawToken?: string) {
		if (!rawToken) {
			return;
		}
		await this.prisma.refreshToken.updateMany({
			where: { tokenHash: hashToken(rawToken), revokedAt: null },
			data: { revokedAt: new Date() },
		});
	}

	private async issueTokens(userId: string, email: string, displayName: string) {
		const accessToken = await this.jwt.signAsync(
			{ sub: userId, email },
			{
				secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
				expiresIn: ACCESS_TTL,
			},
		);
		const refreshToken = randomBytes(48).toString('base64url');
		await this.prisma.refreshToken.create({
			data: {
				userId,
				tokenHash: hashToken(refreshToken),
				expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
			},
		});
		return {
			accessToken,
			refreshToken,
			user: { id: userId, email, displayName },
		};
	}
}

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}
