'use client';

import {
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type TextareaHTMLAttributes,
} from 'react';
import type { PresenceUser } from '@/lib/blocks';

type CaretPos = { top: number; left: number; height: number };

function measureCaret(textarea: HTMLTextAreaElement, offset: number): CaretPos {
	const style = window.getComputedStyle(textarea);
	const mirror = document.createElement('div');
	mirror.setAttribute('aria-hidden', 'true');
	mirror.style.cssText = [
		'position:absolute',
		'visibility:hidden',
		'white-space:pre-wrap',
		'word-wrap:break-word',
		'overflow:hidden',
		`width:${textarea.clientWidth}px`,
		`font:${style.font}`,
		`letter-spacing:${style.letterSpacing}`,
		`line-height:${style.lineHeight}`,
		`padding:${style.padding}`,
		`border:${style.border}`,
		`box-sizing:${style.boxSizing}`,
		`text-align:${style.textAlign}`,
		`text-indent:${style.textIndent}`,
		'top:0',
		'left:-9999px',
	].join(';');

	const clamped = Math.max(0, Math.min(offset, textarea.value.length));
	mirror.textContent = textarea.value.slice(0, clamped);

	const marker = document.createElement('span');
	marker.textContent = textarea.value.slice(clamped) || '.';
	mirror.appendChild(marker);
	document.body.appendChild(mirror);

	const lineHeight =
		Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.2 || 18;
	const top = marker.offsetTop - textarea.scrollTop;
	const left = marker.offsetLeft - textarea.scrollLeft;
	document.body.removeChild(mirror);

	return {
		top: Math.max(0, top),
		left: Math.max(0, left),
		height: lineHeight,
	};
}

export function RemoteCaretField({
	blockId,
	value,
	remoteUsers,
	onCursor,
	className,
	...rest
}: {
	blockId: string;
	value: string;
	remoteUsers: PresenceUser[];
	onCursor: (blockId: string, offset: number) => void;
	className?: string;
} & Omit<
	TextareaHTMLAttributes<HTMLTextAreaElement>,
	'value' | 'onSelect' | 'className' | 'onKeyUp' | 'onClick' | 'onScroll'
>) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [carets, setCarets] = useState<Array<PresenceUser & { pos: CaretPos }>>([]);

	const caretSignature = useMemo(
		() =>
			remoteUsers
				.filter((user) => user.cursor?.blockId === blockId)
				.map((user) => `${user.userId}:${user.cursor?.offset ?? 0}`)
				.sort()
				.join('|'),
		[remoteUsers, blockId],
	);

	useLayoutEffect(() => {
		const el = textareaRef.current;
		if (!el) {
			setCarets([]);
			return;
		}
		const next = remoteUsers
			.filter((user) => user.cursor?.blockId === blockId)
			.map((user) => ({
				...user,
				pos: measureCaret(el, user.cursor?.offset ?? 0),
			}));
		setCarets(next);
	}, [blockId, value, caretSignature, remoteUsers]);

	useEffect(() => {
		const el = textareaRef.current;
		if (!el) return;

		const recompute = () => {
			const next = remoteUsers
				.filter((user) => user.cursor?.blockId === blockId)
				.map((user) => ({
					...user,
					pos: measureCaret(el, user.cursor?.offset ?? 0),
				}));
			setCarets(next);
		};

		el.addEventListener('scroll', recompute);
		window.addEventListener('resize', recompute);
		return () => {
			el.removeEventListener('scroll', recompute);
			window.removeEventListener('resize', recompute);
		};
	}, [blockId, remoteUsers]);

	function reportCursor(target: HTMLTextAreaElement) {
		onCursor(blockId, target.selectionStart);
	}

	const visibleCarets = carets.filter((user) => {
		const el = textareaRef.current;
		if (!el) return false;
		return user.pos.top > -4 && user.pos.top < el.clientHeight;
	});
	const labelPad = visibleCarets.length > 0;

	return (
		<div className={`relative overflow-visible ${labelPad ? 'pt-4' : ''}`}>
			<textarea
				{...rest}
				ref={textareaRef}
				className={className}
				value={value}
				onSelect={(event) => reportCursor(event.target as HTMLTextAreaElement)}
				onKeyUp={(event) => reportCursor(event.target as HTMLTextAreaElement)}
				onClick={(event) => reportCursor(event.target as HTMLTextAreaElement)}
			/>
			<div
				className="pointer-events-none absolute inset-x-0 bottom-0 z-10 overflow-visible"
				style={{ top: labelPad ? '1rem' : 0 }}
			>
				{visibleCarets.map((user) => (
					<div
						key={user.userId}
						className="absolute overflow-visible"
						style={{
							top: user.pos.top,
							left: user.pos.left,
							height: user.pos.height,
						}}
					>
						<span
							className="absolute bottom-full left-0 mb-0.5 whitespace-nowrap rounded px-1 py-px text-[10px] leading-none text-white shadow-sm"
							style={{ background: user.color }}
						>
							{user.displayName}
						</span>
						<span
							className="block w-0.5 animate-pulse"
							style={{
								height: '100%',
								background: user.color,
							}}
						/>
					</div>
				))}
			</div>
		</div>
	);
}
