import { AuthForm } from '@/components/auth-form';
import { safeNextPath } from '@/lib/api';
type Props = {
	searchParams: Promise<{
		next?: string;
	}>;
};
export default async function RegisterPage({ searchParams }: Props) {
	const { next } = await searchParams;
	return <AuthForm mode="register" next={safeNextPath(next)} />;
}
