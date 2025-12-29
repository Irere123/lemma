import {
  IconArrowLeft,
  IconBrandGoogle,
  IconCheck,
  IconLoader2,
  IconMail,
} from '@tabler/icons-react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryState } from 'nuqs'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'

export const Route = createFileRoute('/login')({
  component: RouteComponent,
  head: () => {
    return { meta: [{ title: 'Login - Lemma' }] }
  },
})

type AuthMode = 'options' | 'email-signin' | 'email-signup' | 'otp-verify' | 'forgot-password'

interface EmailFormData {
  email: string
  password?: string
  name?: string
}

interface OTPFormData {
  code: string
}

function RouteComponent() {
  const navigate = useNavigate()
  const [mode, setMode] = useQueryState<AuthMode>('mode', {
    defaultValue: 'options',
    parse: (value) => {
      if (
        value === 'email-signin' ||
        value === 'email-signup' ||
        value === 'otp-verify' ||
        value === 'forgot-password'
      ) {
        return value
      }
      return 'options'
    },
  })
  const [email, setEmail] = useQueryState('email', {
    defaultValue: '',
    parse: (value) => value || '',
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: `${import.meta.env.VITE_PUBLIC_APP_URL}/documents`,
      })
    } catch {
      toast.error('Failed to sign in with Google')
      setIsLoading(false)
    }
  }

  const handleEmailSignIn = async (data: EmailFormData) => {
    setIsLoading(true)
    try {
      const result = await authClient.signIn.email({
        email: data.email,
        password: data.password!,
      })

      if (result.error) {
        toast.error(result.error.message || 'Invalid credentials')
        setIsLoading(false)
        return
      }

      navigate({ to: '/documents' })
    } catch {
      toast.error('Failed to sign in')
      setIsLoading(false)
    }
  }

  const handleEmailSignUp = async (data: EmailFormData) => {
    setIsLoading(true)
    try {
      const result = await authClient.signUp.email({
        email: data.email,
        password: data.password!,
        name: data.name!,
      })

      if (result.error) {
        toast.error(result.error.message || 'Failed to create account')
        setIsLoading(false)
        return
      }

      setEmail(data.email)
      setMode('otp-verify')
      toast.success('Check your email for verification code')
    } catch {
      toast.error('Failed to create account')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOTPVerify = async (data: OTPFormData) => {
    setIsLoading(true)
    try {
      const result = await authClient.emailOtp.verifyEmail({
        email,
        otp: data.code,
      })

      if (result.error) {
        toast.error(result.error.message || 'Invalid verification code')
        setIsLoading(false)
        return
      }

      toast.success('Email verified successfully!')
      navigate({ to: '/documents' })
    } catch {
      toast.error('Failed to verify code')
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (data: EmailFormData) => {
    setIsLoading(true)
    try {
      await authClient.emailOtp.sendVerificationOtp({
        email: data.email,
        type: 'forget-password',
      })
      toast.success('Password reset email sent!')
      await setMode('options')
    } catch {
      toast.error('Failed to send reset email')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendOTP = async () => {
    if (!email) return
    setIsLoading(true)
    try {
      await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'email-verification',
      })
      toast.success('Verification code sent!')
    } catch {
      toast.error('Failed to send verification code')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4'>
      <div className='w-full max-w-sm space-y-8'>
        <div className='text-center'>
          <h1 className='font-bold text-3xl tracking-tight'>Lemma</h1>
          <p className='mt-2 text-muted-foreground text-sm'>
            {mode === 'options' && 'Sign in to continue to your workspace'}
            {mode === 'email-signin' && 'Sign in with your email'}
            {mode === 'email-signup' && 'Create your account'}
            {mode === 'otp-verify' && 'Verify your email'}
            {mode === 'forgot-password' && 'Reset your password'}
          </p>
        </div>

        <div className='p-6'>
          {mode === 'options' && (
            <AuthOptions
              onGoogleClick={handleGoogleSignIn}
              onEmailClick={() => setMode('email-signin')}
              isLoading={isLoading}
            />
          )}

          {mode === 'email-signin' && (
            <EmailSignInForm
              onSubmit={handleEmailSignIn}
              onBack={() => setMode('options')}
              onSignUp={() => setMode('email-signup')}
              onForgotPassword={() => setMode('forgot-password')}
              isLoading={isLoading}
            />
          )}

          {mode === 'email-signup' && (
            <EmailSignUpForm
              onSubmit={handleEmailSignUp}
              onBack={() => setMode('email-signin')}
              isLoading={isLoading}
            />
          )}

          {mode === 'otp-verify' && (
            <OTPVerifyForm
              email={email}
              onSubmit={handleOTPVerify}
              onResend={handleSendOTP}
              onBack={() => setMode('email-signin')}
              isLoading={isLoading}
            />
          )}

          {mode === 'forgot-password' && (
            <ForgotPasswordForm
              onSubmit={handleForgotPassword}
              onBack={() => setMode('email-signin')}
              isLoading={isLoading}
            />
          )}
        </div>

        <p className='text-center text-muted-foreground text-xs'>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  )
}

function AuthOptions({
  onGoogleClick,
  onEmailClick,
  isLoading,
}: {
  onGoogleClick: () => void
  onEmailClick: () => void
  isLoading: boolean
}) {
  return (
    <div className='space-y-4'>
      <Button
        variant='outline'
        className='h-11 w-full gap-3'
        onClick={onGoogleClick}
        disabled={isLoading}
      >
        {isLoading ? (
          <IconLoader2 className='animate-spin' size={18} />
        ) : (
          <IconBrandGoogle size={18} />
        )}
        Continue with Google
      </Button>

      <div className='relative'>
        <div className='absolute inset-0 flex items-center'>
          <span className='w-full border-t' />
        </div>
        <div className='relative flex justify-center text-xs uppercase'>
          <span className='bg-card px-2 text-muted-foreground'>or</span>
        </div>
      </div>

      <Button variant='outline' className='h-11 w-full gap-3' onClick={onEmailClick}>
        <IconMail size={18} />
        Continue with Email
      </Button>
    </div>
  )
}

function EmailSignInForm({
  onSubmit,
  onBack,
  onSignUp,
  onForgotPassword,
  isLoading,
}: {
  onSubmit: (data: EmailFormData) => void
  onBack: () => void
  onSignUp: () => void
  onForgotPassword: () => void
  isLoading: boolean
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailFormData>()

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
      <button
        type='button'
        onClick={onBack}
        className='flex items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-foreground'
      >
        <IconArrowLeft size={14} />
        Back
      </button>

      <div className='space-y-2'>
        <Label htmlFor='email'>Email</Label>
        <Input
          id='email'
          type='email'
          placeholder='you@example.com'
          {...register('email', { required: 'Email is required' })}
        />
        {errors.email && <p className='text-destructive text-xs'>{errors.email.message}</p>}
      </div>

      <div className='space-y-2'>
        <div className='flex items-center justify-between'>
          <Label htmlFor='password'>Password</Label>
          <button
            type='button'
            onClick={onForgotPassword}
            className='text-muted-foreground text-xs hover:text-foreground'
          >
            Forgot password?
          </button>
        </div>
        <Input
          id='password'
          type='password'
          placeholder='Your password'
          {...register('password', { required: 'Password is required' })}
        />
        {errors.password && <p className='text-destructive text-xs'>{errors.password.message}</p>}
      </div>

      <Button type='submit' className='h-11 w-full' disabled={isLoading}>
        {isLoading && <IconLoader2 className='animate-spin' size={16} />}
        Sign In
      </Button>

      <p className='text-center text-muted-foreground text-sm'>
        Don&apos;t have an account?{' '}
        <button
          type='button'
          onClick={onSignUp}
          className='font-medium text-primary hover:underline'
        >
          Sign up
        </button>
      </p>
    </form>
  )
}

function EmailSignUpForm({
  onSubmit,
  onBack,
  isLoading,
}: {
  onSubmit: (data: EmailFormData) => void
  onBack: () => void
  isLoading: boolean
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailFormData>()

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
      <button
        type='button'
        onClick={onBack}
        className='flex items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-foreground'
      >
        <IconArrowLeft size={14} />
        Back to sign in
      </button>

      <div className='space-y-2'>
        <Label htmlFor='name'>Name</Label>
        <Input
          id='name'
          type='text'
          placeholder='Your name'
          {...register('name', { required: 'Name is required' })}
        />
        {errors.name && <p className='text-destructive text-xs'>{errors.name.message}</p>}
      </div>

      <div className='space-y-2'>
        <Label htmlFor='email'>Email</Label>
        <Input
          id='email'
          type='email'
          placeholder='you@example.com'
          {...register('email', { required: 'Email is required' })}
        />
        {errors.email && <p className='text-destructive text-xs'>{errors.email.message}</p>}
      </div>

      <div className='space-y-2'>
        <Label htmlFor='password'>Password</Label>
        <Input
          id='password'
          type='password'
          placeholder='Create a password'
          {...register('password', {
            required: 'Password is required',
            minLength: { value: 8, message: 'Password must be at least 8 characters' },
          })}
        />
        {errors.password && <p className='text-destructive text-xs'>{errors.password.message}</p>}
      </div>

      <Button type='submit' className='h-11 w-full' disabled={isLoading}>
        {isLoading && <IconLoader2 className='animate-spin' size={16} />}
        Create Account
      </Button>
    </form>
  )
}

function OTPVerifyForm({
  email,
  onSubmit,
  onResend,
  onBack,
  isLoading,
}: {
  email: string
  onSubmit: (data: OTPFormData) => void
  onResend: () => void
  onBack: () => void
  isLoading: boolean
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OTPFormData>()

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
      <button
        type='button'
        onClick={onBack}
        className='flex items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-foreground'
      >
        <IconArrowLeft size={14} />
        Back
      </button>

      <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10'>
        <IconCheck className='text-primary' size={24} />
      </div>

      <div className='text-center'>
        <p className='text-muted-foreground text-sm'>We sent a verification code to</p>
        <p className='font-medium'>{email}</p>
      </div>

      <div className='space-y-2'>
        <Label htmlFor='code'>Verification Code</Label>
        <Input
          id='code'
          type='text'
          placeholder='Enter 6-digit code'
          maxLength={6}
          className='text-center text-lg tracking-widest'
          {...register('code', {
            required: 'Code is required',
            minLength: { value: 6, message: 'Enter the 6-digit code' },
          })}
        />
        {errors.code && <p className='text-destructive text-xs'>{errors.code.message}</p>}
      </div>

      <Button type='submit' className='h-11 w-full' disabled={isLoading}>
        {isLoading && <IconLoader2 className='animate-spin' size={16} />}
        Verify Email
      </Button>

      <p className='text-center text-muted-foreground text-sm'>
        Didn&apos;t receive the code?{' '}
        <button
          type='button'
          onClick={onResend}
          className='font-medium text-primary hover:underline'
        >
          Resend
        </button>
      </p>
    </form>
  )
}

function ForgotPasswordForm({
  onSubmit,
  onBack,
  isLoading,
}: {
  onSubmit: (data: EmailFormData) => void
  onBack: () => void
  isLoading: boolean
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailFormData>()

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
      <button
        type='button'
        onClick={onBack}
        className='flex items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-foreground'
      >
        <IconArrowLeft size={14} />
        Back to sign in
      </button>

      <div className='space-y-2'>
        <Label htmlFor='email'>Email</Label>
        <Input
          id='email'
          type='email'
          placeholder='you@example.com'
          {...register('email', { required: 'Email is required' })}
        />
        {errors.email && <p className='text-destructive text-xs'>{errors.email.message}</p>}
      </div>

      <Button type='submit' className='h-11 w-full' disabled={isLoading}>
        {isLoading && <IconLoader2 className='animate-spin' size={16} />}
        Send Reset Link
      </Button>
    </form>
  )
}
