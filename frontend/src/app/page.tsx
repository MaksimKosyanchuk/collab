import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_COOKIE } from '@/lib/api';
export default async function HomePage() {
	const jar = await cookies();
	if (jar.get(ACCESS_COOKIE)?.value) {
		redirect('/app');
	}
	redirect('/login');
}
