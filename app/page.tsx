'use client'

import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Button,
} from '@heroui/react'
import { Wallet, TrendingUp, Target, BarChart3 } from 'lucide-react'
import NextLink from 'next/link'

export default function LandingPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md text-center" shadow="lg">
        <CardHeader className="flex flex-col items-center gap-3 pb-0">
          <div className="flex items-center justify-center gap-2">
            <Wallet size={36} className="text-primary" aria-hidden="true" />
            <h1 className="text-3xl font-bold">Spendly</h1>
          </div>
          <p className="text-default-500 text-base">
            Track expenses, set budgets, and take control of your finances.
          </p>
        </CardHeader>

        <CardBody className="flex flex-col gap-5 pt-4">
          <div className="flex flex-col gap-2 text-left">
            <div className="flex items-center gap-2 text-sm text-default-500">
              <TrendingUp size={14} className="text-success shrink-0" aria-hidden="true" />
              <span>Track expenses across all categories</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-default-500">
              <Target size={14} className="text-warning shrink-0" aria-hidden="true" />
              <span>Set and monitor monthly spending budgets</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-default-500">
              <BarChart3 size={14} className="text-primary shrink-0" aria-hidden="true" />
              <span>Understand your finances with visual reports</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              as={NextLink}
              href="/signup"
              color="primary"
              size="lg"
              fullWidth
            >
              Get Started
            </Button>
            <Button
              as={NextLink}
              href="/login"
              variant="bordered"
              size="lg"
              fullWidth
            >
              Sign in
            </Button>
          </div>
        </CardBody>

        <CardFooter className="justify-center">
          <p className="text-xs text-default-400">Free forever. No credit card required.</p>
        </CardFooter>
      </Card>
    </main>
  )
}
