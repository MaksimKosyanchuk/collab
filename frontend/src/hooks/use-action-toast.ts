'use client';
import { useToast } from '@/components/toast-provider';
import { actionFailMessage, messageFromUnknown } from '@/lib/errors';
type ActionResult<T> =
	| {
			ok: true;
			data: T;
	  }
	| {
			ok: false;
			error: string;
	  };
export function useActionToast() {
	const { show } = useToast();
	async function runAction<T>(
		task: () => Promise<ActionResult<T>>,
		opts?: {
			success?: string;
			fallback?: string;
		},
	): Promise<T | null> {
		try {
			const result = await task();
			const fail = actionFailMessage(result, opts?.fallback);
			if (fail) {
				show(fail, 'error');
				return null;
			}
			if (opts?.success) {
				show(opts.success, 'success');
			}
			return result.ok ? result.data : null;
		} catch (error) {
			show(messageFromUnknown(error, opts?.fallback), 'error');
			return null;
		}
	}
	return { show, runAction };
}
