import Link from 'next/link';
import { logoutAction } from '@/lib/actions';
import { NotificationsBell } from '@/components/notifications-bell';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-bg-elevated/90 backdrop-blur">
        <div className="mx-auto flex h-11 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/app" className="brand text-[15px]">
            Collab Docs
          </Link>
          <div className="flex items-center gap-1.5">
            <NotificationsBell />
            <form action={logoutAction}>
              <button className="btn btn-ghost" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
    </div>
  );
}
