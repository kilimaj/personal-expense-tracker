import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AppNavbar } from '@/components/app-navbar'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  return (
    <>
      <AppNavbar />
      {children}
    </>
  )
}
