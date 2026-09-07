import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser, AuthUser } from './current-user.decorator';

const REFRESH_COOKIE = 'refreshToken';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.register(dto);
    this.setRefreshCookie(res, tokens.refreshToken);
    return tokens;
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.login(dto);
    this.setRefreshCookie(res, tokens.refreshToken);
    return tokens;
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieToken =
      typeof req.cookies?.[REFRESH_COOKIE] === 'string'
        ? req.cookies[REFRESH_COOKIE]
        : undefined;
    const tokens = await this.auth.refresh(dto.refreshToken ?? cookieToken);
    this.setRefreshCookie(res, tokens.refreshToken);
    return tokens;
  }

  @Post('logout')
  @HttpCode(204)
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieToken =
      typeof req.cookies?.[REFRESH_COOKIE] === 'string'
        ? req.cookies[REFRESH_COOKIE]
        : undefined;
    await this.auth.logout(dto.refreshToken ?? cookieToken);
    res.clearCookie(REFRESH_COOKIE);
  }

  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
