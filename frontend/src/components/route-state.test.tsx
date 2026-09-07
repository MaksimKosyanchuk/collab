import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouteError, RouteLoading } from '@/components/route-state';

describe('RouteError', () => {
	it('shows title, message, and calls reset', async () => {
		const user = userEvent.setup();
		const reset = vi.fn();
		render(
			<RouteError
				title="Workspace unavailable"
				message="Boom"
				reset={reset}
				homeHref="/app"
				homeLabel="All workspaces"
			/>,
		);

		expect(screen.getByRole('heading', { name: 'Workspace unavailable' })).toBeInTheDocument();
		expect(screen.getByText('Boom')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'All workspaces' })).toHaveAttribute(
			'href',
			'/app',
		);

		await user.click(screen.getByRole('button', { name: 'Try again' }));
		expect(reset).toHaveBeenCalledTimes(1);
	});
});

describe('RouteLoading', () => {
	it('renders the loading label', () => {
		render(<RouteLoading label="Opening document…" />);
		expect(screen.getByText('Opening document…')).toBeInTheDocument();
	});
});
