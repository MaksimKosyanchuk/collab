'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
type ToastKind = 'error' | 'success';
type ToastItem = {
	id: number;
	message: string;
	kind: ToastKind;
};
type ToastContextValue = {
	show: (message: string, kind?: ToastKind) => void;
};
const ToastContext = createContext<ToastContextValue | null>(null);
export function useToast() {
	const ctx = useContext(ToastContext);
	if (!ctx) {
		throw new Error('useToast must be used within ToastProvider');
	}
	return ctx;
}
export function ToastProvider({ children }: { children: React.ReactNode }) {
	const [toast, setToast] = useState<ToastItem | null>(null);
	const show = useCallback((message: string, kind: ToastKind = 'error') => {
		setToast({ id: Date.now(), message, kind });
	}, []);
	useEffect(() => {
		if (!toast) return;
		const timer = window.setTimeout(() => setToast(null), 3000);
		return () => window.clearTimeout(timer);
	}, [toast]);
	const value = useMemo(() => ({ show }), [show]);
	return (
		<ToastContext.Provider value={value}>
			{children}
			{toast ? (
				<div
					className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
					role="status"
					aria-live="polite"
				>
					<div
						className={`pointer-events-auto max-w-md rounded-md border px-3 py-2 text-[13px] shadow-sm ${
							toast.kind === 'error'
								? 'border-danger/30 bg-bg-elevated text-danger'
								: 'border-line bg-bg-elevated text-ink'
						}`}
					>
						{toast.message}
					</div>
				</div>
			) : null}
		</ToastContext.Provider>
	);
}
