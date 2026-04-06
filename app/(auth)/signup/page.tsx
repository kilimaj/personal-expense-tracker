'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Input,
  Button,
  Link,
  Alert,
} from '@heroui/react'
import { Eye, EyeOff, Wallet } from 'lucide-react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import NextLink from 'next/link'
import { registerSchema, type RegisterInput } from '@/lib/validations/auth'

export default function SignupPage() {
  const router = useRouter()
  const [showPassword,  setShowPassword]  = useState(false)
  const [showConfirm,   setShowConfirm]   = useState(false)
  const [formError,     setFormError]     = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  })

  async function onSubmit(data: RegisterInput) {
    setFormError(null)

    const res = await fetch('/api/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    })

    const json = await res.json()

    if (!res.ok) {
      if (json.fields) {
        Object.entries(json.fields as Record<string, string>).forEach(
          ([field, message]) => {
            setError(field as keyof RegisterInput, { message })
          },
        )
      }
      setFormError(json.error ?? 'Something went wrong. Please try again.')
      return
    }

    const result = await signIn('credentials', {
      email:      data.email,
      password:   data.password,
      redirectTo: '/dashboard',
      redirect:   false,
    })

    if (result?.error) {
      setFormError('Account created but sign-in failed. Please go to the login page.')
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm">
      <Link as={NextLink} href="/" className="flex items-center gap-2" color="foreground">
        <Wallet size={26} className="text-primary" aria-hidden="true" />
        <span className="text-xl font-bold">Spendly</span>
      </Link>

      <Card className="w-full" shadow="md">
        <CardHeader className="flex flex-col items-start gap-1 pb-0">
          <h1 className="text-2xl font-semibold">Create an account</h1>
          <p className="text-sm text-default-500">Start tracking your expenses today</p>
        </CardHeader>

        <CardBody className="gap-4">
          {formError && (
            <Alert color="danger" title={formError} />
          )}

          <form
            className="flex flex-col gap-4"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First name"
                placeholder="John"
                variant="bordered"
                autoComplete="given-name"
                isRequired
                isInvalid={!!errors.firstName}
                errorMessage={errors.firstName?.message}
                {...register('firstName')}
              />
              <Input
                label="Last name"
                placeholder="Doe"
                variant="bordered"
                autoComplete="family-name"
                isRequired
                isInvalid={!!errors.lastName}
                errorMessage={errors.lastName?.message}
                {...register('lastName')}
              />
            </div>

            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              variant="bordered"
              autoComplete="email"
              isRequired
              isInvalid={!!errors.email}
              errorMessage={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="At least 8 characters"
              variant="bordered"
              autoComplete="new-password"
              isRequired
              isInvalid={!!errors.password}
              errorMessage={errors.password?.message}
              endContent={
                <Button
                  type="button"
                  variant="light"
                  isIconOnly
                  size="sm"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onPress={() => setShowPassword((v) => !v)}
                >
                  {showPassword
                    ? <EyeOff size={16} className="text-default-400" />
                    : <Eye    size={16} className="text-default-400" />}
                </Button>
              }
              {...register('password')}
            />

            <Input
              label="Confirm password"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Repeat your password"
              variant="bordered"
              autoComplete="new-password"
              isRequired
              isInvalid={!!errors.confirm}
              errorMessage={errors.confirm?.message}
              endContent={
                <Button
                  type="button"
                  variant="light"
                  isIconOnly
                  size="sm"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  onPress={() => setShowConfirm((v) => !v)}
                >
                  {showConfirm
                    ? <EyeOff size={16} className="text-default-400" />
                    : <Eye    size={16} className="text-default-400" />}
                </Button>
              }
              {...register('confirm')}
            />

            <Button
              type="submit"
              color="primary"
              size="lg"
              fullWidth
              isLoading={isSubmitting}
            >
              Create account
            </Button>
          </form>
        </CardBody>

        <CardFooter className="justify-center">
          <p className="text-sm text-default-500">
            Already have an account?{' '}
            <Link as={NextLink} href="/login" size="sm" color="primary">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
