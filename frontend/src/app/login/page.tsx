import { AuthForm } from '@/components/auth-form';
import { safeNextPath } from '@/lib/api';

type Props = {
	searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
	const { next } = await searchParams;
	return <AuthForm mode="login" next={safeNextPath(next)} />;
}
