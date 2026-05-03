import { useCanGoBack, useNavigate, useRouterState } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import type { ComponentProps, ReactElement } from 'react'

import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { Tooltip, TooltipPopup, TooltipTrigger } from '../ui/tooltip'

type BackNavigationButtonProps = {
  className?: string
  iconOnly?: boolean
  label?: string
} & Pick<ComponentProps<typeof Button>, 'size' | 'variant'>

export function BackNavigationButton({
  className,
  iconOnly = false,
  label = 'Back',
  size = iconOnly ? 'icon' : 'sm',
  variant = 'ghost',
}: BackNavigationButtonProps) {
  const canGoBack = useCanGoBack()
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const isAtLibrary = pathname.replace(/\/$/, '') === '/app'
  const disabled = !canGoBack && isAtLibrary

  const handleBack = () => {
    if (canGoBack) {
      window.history.back()
      return
    }

    void navigate({ to: '/app' })
  }

  const button = (
    <Button
      aria-label={label}
      className={cn(iconOnly && 'rounded-full', className)}
      disabled={disabled}
      onClick={handleBack}
      size={size}
      variant={variant}
    >
      <ArrowLeft />
      {!iconOnly && <span>{label}</span>}
    </Button>
  )

  if (!iconOnly) {
    return button
  }

  return (
    <Tooltip>
      <TooltipTrigger render={button as ReactElement<Record<string, unknown>>} />
      <TooltipPopup side='right'>{label}</TooltipPopup>
    </Tooltip>
  )
}
