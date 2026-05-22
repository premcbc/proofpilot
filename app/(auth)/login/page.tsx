import { LoginForm } from '@/components/auth/login-form'

interface Props {
  searchParams: Promise<{ redirectTo?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams
  return <LoginForm redirectTo={params.redirectTo} />
}
