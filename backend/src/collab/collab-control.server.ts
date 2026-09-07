import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CollabControlCommand, CollabControlReply } from './collab-control';
import { CollabRoomsService } from './collab-rooms.service';

@Injectable()
export class CollabControlServer implements OnModuleInit, OnModuleDestroy {
	private pub!: Redis;
	private sub!: Redis;
	private cmdChannel!: string;
	private replyChannel!: string;

	constructor(
		private readonly config: ConfigService,
		private readonly rooms: CollabRoomsService,
	) {}

	async onModuleInit(): Promise<void> {
		this.cmdChannel = this.config.get('COLLAB_CMD_CHANNEL', 'collab:cmd');
		this.replyChannel = this.config.get('COLLAB_REPLY_CHANNEL', 'collab:reply');
		const options = {
			host: this.config.get('REDIS_HOST', 'localhost'),
			port: Number(this.config.get('REDIS_PORT', 6379)),
			maxRetriesPerRequest: null as null,
		};
		this.pub = new Redis(options);
		this.sub = new Redis(options);
		await this.sub.subscribe(this.cmdChannel);
		this.sub.on('message', (_channel, raw) => {
			void this.handle(raw);
		});
	}

	async onModuleDestroy(): Promise<void> {
		await Promise.allSettled([this.sub?.quit(), this.pub?.quit()]);
	}

	private async handle(raw: string): Promise<void> {
		let cmd: CollabControlCommand;
		try {
			cmd = JSON.parse(raw) as CollabControlCommand;
		} catch {
			return;
		}
		try {
			switch (cmd.op) {
				case 'flushProjection':
					await this.rooms.flushProjection(cmd.documentId);
					break;
				case 'closeDeleted':
					this.rooms.closeDeleted(cmd.documentId);
					break;
				case 'reload':
					await this.rooms.reload(cmd.documentId);
					break;
				case 'revalidateUserOnDocument':
					await this.rooms.revalidateUserOnDocument(cmd.documentId, cmd.userId);
					break;
				case 'revalidateAllClientsOnDocument':
					await this.rooms.revalidateAllClientsOnDocument(cmd.documentId);
					break;
				case 'revalidateUserInWorkspace':
					await this.rooms.revalidateUserInWorkspace(cmd.workspaceId, cmd.userId);
					break;
				default:
					throw new Error(`Unknown collab control op`);
			}
			await this.reply({ requestId: cmd.requestId, ok: true });
		} catch (error) {
			await this.reply({
				requestId: cmd.requestId,
				ok: false,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	private async reply(payload: CollabControlReply): Promise<void> {
		await this.pub.publish(this.replyChannel, JSON.stringify(payload));
	}
}
