import { auth } from '@/auth'
import { DashboardUI } from './dashboard-ui'

export default async function DashboardPage() {
  const session   = await auth()
  const firstName = session?.user?.name?.split(' ')[0] ?? 'there'
  return <DashboardUI firstName={firstName} />
}
