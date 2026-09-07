import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { CollabControl, CollabControlCommand, CollabControlReply } from './collab-control';

type Pending = {
	resolve: () => void;
	reject: (error: Error) => void;
	timer: NodeJS.Timeout;
};

@Injectable()
export class CollabControlClient implements CollabControl, OnModuleInit, OnModuleDestroy {
	private pub!: Redis;
	private sub!: Redis;
	private readonly pending = new Map<string, Pending>();
	private readonly timeoutMs: number;
	private cmdChannel!: string;
	private replyChannel!: string;

	constructor(private readonly config: ConfigService) {
		this.timeoutMs = Number(this.config.get('COLLAB_CONTROL_TIMEOUT_MS', 15_000));
	}

	async onModuleInit(): Promise<void> {
		this.cmdChannel = this.config.get('COLLAB_CMD_CHANNEL', 'collab:cmd');
		this.replyChannel = this.config.get('COLLAB_REPLY_CHANNEL', 'collab:reply');
		const options = this.redisOptions();
		this.pub = new Redis(options);
		this.sub = new Redis(options);
		await this.sub.subscribe(this.replyChannel);
		this.sub.on('message', (_channel, raw) => {
			this.onReply(raw);
		});
	}

	async onModuleDestroy(): Promise<void> {
		for (const [, pending] of this.pending) {
			clearTimeout(pending.timer);
			pending.reject(new Error('Collab control client shutting down'));
		}
		this.pending.clear();
		await Promise.allSettled([this.sub?.quit(), this.pub?.quit()]);
	}

	flushProjection(documentId: string): Promise<void> {
		return this.request({ op: 'flushProjection', documentId });
	}

	closeDeleted(documentId: string): Promise<void> {
		return this.request({ op: 'closeDeleted', documentId });
	}

	reload(documentId: string): Promise<void> {
		return this.request({ op: 'reload', documentId });
	}

	revalidateUserOnDocument(documentId: string, userId: string): Promise<void> {
		return this.request({
			op: 'revalidateUserOnDocument',
			documentId,
			userId,
		});
	}

	revalidateAllClientsOnDocument(documentId: string): Promise<void> {
		return this.request({ op: 'revalidateAllClientsOnDocument', documentId });
	}

	revalidateUserInWorkspace(workspaceId: string, userId: string): Promise<void> {
		return this.request({
			op: 'revalidateUserInWorkspace',
			workspaceId,
			userId,
		});
	}

	private redisOptions() {
		return {
			host: this.config.get('REDIS_HOST', 'localhost'),
			port: Number(this.config.get('REDIS_PORT', 6379)),
			maxRetriesPerRequest: null as null,
			lazyConnect: false,
		};
	}

	private request(
		cmd:
			| { op: 'flushProjection'; documentId: string }
			| { op: 'closeDeleted'; documentId: string }
			| { op: 'reload'; documentId: string }
			| {
					op: 'revalidateUserOnDocument';
					documentId: string;
					userId: string;
			  }
			| { op: 'revalidateAllClientsOnDocument'; documentId: string }
			| {
					op: 'revalidateUserInWorkspace';
					workspaceId: string;
					userId: string;
			  },
	): Promise<void> {
		const requestId = randomUUID();
		const payload = { ...cmd, requestId } as CollabControlCommand;
		return new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(requestId);
				reject(
					new Error(
						`Collab control timeout (${cmd.op}) after ${this.timeoutMs}ms — is the collab gateway running?`,
					),
				);
			}, this.timeoutMs);
			this.pending.set(requestId, { resolve, reject, timer });
			void this.pub
				.publish(this.cmdChannel, JSON.stringify(payload))
				.catch((error: Error) => {
					clearTimeout(timer);
					this.pending.delete(requestId);
					reject(error);
				});
		});
	}

	private onReply(raw: string): void {
		let reply: CollabControlReply;
		try {
			reply = JSON.parse(raw) as CollabControlReply;
		} catch {
			return;
		}
		const pending = this.pending.get(reply.requestId);
		if (!pending) {
			return;
		}
		clearTimeout(pending.timer);
		this.pending.delete(reply.requestId);
		if (reply.ok) {
			pending.resolve();
		} else {
			pending.reject(new Error(reply.error ?? 'Collab control failed'));
		}
	}
}
