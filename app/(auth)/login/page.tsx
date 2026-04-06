'use client'

import { Suspense, useState } from 'react'
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
import { Eye, EyeOff, Mail, Wallet } from 'lucide-react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import NextLink from 'next/link'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: 'Invalid email or password.',
  default:           'Something went wrong. Please try again.',
}

function LoginForm() {
  const searchParams  = useSearchParams()
  const callbackUrl   = searchParams.get('callbackUrl') ?? '/dashboard'
  const urlError      = searchParams.get('error')
  const errorMessage  = urlError ? (AUTH_ERROR_MESSAGES[urlError] ?? AUTH_ERROR_MESSAGES.default) : null

  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [formError,    setFormError]    = useState<string | null>(errorMessage)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginInput) {
    setFormError(null)
    const result = await signIn('credentials', {
      email:       data.email,
      password:    data.password,
      redirectTo:  callbackUrl,
      redirect:    false,
    })

    if (result?.error) {
      setFormError(AUTH_ERROR_MESSAGES[result.error] ?? AUTH_ERROR_MESSAGES.default)
      return
    }

    router.push(callbackUrl)
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm">
      <Link as={NextLink} href="/" className="flex items-center gap-2" color="foreground">
        <Wallet size={26} className="text-primary" aria-hidden="true" />
        <span className="text-xl font-bold">Spendly</span>
      </Link>

      <Card className="w-full" shadow="md">
        <CardHeader className="flex flex-col items-start gap-1 pb-0">
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="text-sm text-default-500">Sign in to your account</p>
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
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              variant="bordered"
              autoComplete="email"
              isRequired
              isInvalid={!!errors.email}
              errorMessage={errors.email?.message}
              startContent={<Mail className="text-default-400 pointer-events-none" size={16} />}
              {...register('email')}
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              variant="bordered"
              autoComplete="current-password"
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

            <div className="flex justify-end -mt-2">
              <Link as={NextLink} href="#" size="sm" color="primary">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              color="primary"
              size="lg"
              fullWidth
              isLoading={isSubmitting}
            >
              Sign in
            </Button>
          </form>
        </CardBody>

        <CardFooter className="justify-center">
          <p className="text-sm text-default-500">
            Don&apos;t have an account?{' '}
            <Link as={NextLink} href="/signup" size="sm" color="primary">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
