'use client'

import {
  Card,
  CardHeader,
  CardBody,
  Chip,
  Progress,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  Button,
} from '@heroui/react'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Receipt,
  Plus,
} from 'lucide-react'

const CATEGORIES = [
  { label: 'Food & Dining', color: 'warning'   },
  { label: 'Transport',     color: 'primary'   },
  { label: 'Shopping',      color: 'secondary' },
  { label: 'Bills',         color: 'danger'    },
] as const

interface DashboardUIProps {
  firstName: string
}

export function DashboardUI({ firstName }: DashboardUIProps) {
  return (
    <main className="flex flex-1 flex-col gap-6 px-4 py-6 max-w-screen-xl mx-auto w-full">

      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold">Welcome back, {firstName}</h1>
        <p className="text-sm text-default-500 mt-0.5">
          Here&apos;s your financial overview for this month.
        </p>
      </div>

      {/* Summary Cards — 1 col → 2 col → 4 col */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

        <Card shadow="sm">
          <CardHeader className="flex items-center gap-2 pb-1">
            <Wallet size={15} className="text-success" aria-hidden="true" />
            <span className="text-sm text-default-500">Total Balance</span>
          </CardHeader>
          <CardBody className="pt-1 gap-2">
            <p className="text-3xl font-semibold">$0.00</p>
            <Chip size="sm" variant="flat" color="default">No data yet</Chip>
          </CardBody>
        </Card>

        <Card shadow="sm">
          <CardHeader className="flex items-center gap-2 pb-1">
            <TrendingUp size={15} className="text-success" aria-hidden="true" />
            <span className="text-sm text-default-500">Monthly Income</span>
          </CardHeader>
          <CardBody className="pt-1 gap-2">
            <p className="text-3xl font-semibold">$0.00</p>
            <Chip size="sm" variant="flat" color="default">No income tracked</Chip>
          </CardBody>
        </Card>

        <Card shadow="sm">
          <CardHeader className="flex items-center gap-2 pb-1">
            <TrendingDown size={15} className="text-danger" aria-hidden="true" />
            <span className="text-sm text-default-500">Monthly Expenses</span>
          </CardHeader>
          <CardBody className="pt-1 gap-2">
            <p className="text-3xl font-semibold">$0.00</p>
            <Chip size="sm" variant="flat" color="default">No expenses tracked</Chip>
          </CardBody>
        </Card>

        <Card shadow="sm">
          <CardHeader className="flex items-center gap-2 pb-1">
            <PiggyBank size={15} className="text-primary" aria-hidden="true" />
            <span className="text-sm text-default-500">Savings Rate</span>
          </CardHeader>
          <CardBody className="pt-1 gap-3">
            <p className="text-3xl font-semibold">0%</p>
            <Progress
              color="primary"
              value={0}
              size="sm"
              aria-label="Savings rate"
            />
          </CardBody>
        </Card>

      </div>

      {/* Transactions + Category Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Recent Transactions */}
        <Card className="lg:col-span-2" shadow="sm">
          <CardHeader className="flex justify-between items-center">
            <span className="font-semibold">Recent Transactions</span>
          </CardHeader>
          <CardBody className="px-0 pt-0">
            <Table aria-label="Recent transactions" removeWrapper>
              <TableHeader>
                <TableColumn>Date</TableColumn>
                <TableColumn>Description</TableColumn>
                <TableColumn>Category</TableColumn>
                <TableColumn align="end">Amount</TableColumn>
              </TableHeader>
              <TableBody
                emptyContent={
                  <div className="flex flex-col items-center gap-3 py-10">
                    <div className="p-4 rounded-full bg-default-100">
                      <Receipt size={28} className="text-default-400" aria-hidden="true" />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <p className="font-medium text-default-600">No transactions yet</p>
                      <p className="text-sm text-default-400">
                        Add your first expense to get started
                      </p>
                    </div>
                    <Button
                      size="sm"
                      color="primary"
                      startContent={<Plus size={14} aria-hidden="true" />}
                    >
                      Add Expense
                    </Button>
                  </div>
                }
              >
                {[]}
              </TableBody>
            </Table>
          </CardBody>
        </Card>

        {/* Spending by Category */}
        <Card shadow="sm">
          <CardHeader>
            <span className="font-semibold">Spending by Category</span>
          </CardHeader>
          <CardBody className="gap-5">
            {CATEGORIES.map(({ label, color }) => (
              <div key={label} className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-default-600">{label}</span>
                  <span className="text-default-400 text-xs">$0</span>
                </div>
                <Progress
                  color={color}
                  value={0}
                  size="sm"
                  aria-label={`${label} spending`}
                />
                <p className="text-xs text-default-400">of $0 budget</p>
              </div>
            ))}
          </CardBody>
        </Card>

      </div>
    </main>
  )
}
