import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import helmet from 'helmet';
import { CollabAppModule } from './collab-app.module';

async function bootstrap() {
	const app = await NestFactory.create(CollabAppModule);
	app.useWebSocketAdapter(new WsAdapter(app));

	const port = process.env.COLLAB_PORT ?? process.env.PORT;
	if (!port) {
		throw new Error('COLLAB_PORT (or PORT) must be defined');
	}

	const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:3000';
	app.use(
		helmet({
			crossOriginResourcePolicy: { policy: 'cross-origin' },
			contentSecurityPolicy: false,
		}),
	);
	app.enableCors({
		origin: [clientUrl],
		credentials: true,
	});
	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
		}),
	);

	await app.listen(Number(port));
}

void bootstrap();
