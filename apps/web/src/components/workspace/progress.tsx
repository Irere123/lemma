import { cn } from '@/lib/utils'

/** A thin progress bar with its percentage, for word targets. */
export function Progress({
  value,
  className,
  label,
}: {
  value: number
  className?: string
  label?: string
}) {
  const percent = Math.max(0, Math.min(100, Math.round(value * 100)))
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className='h-1.5 flex-1 overflow-hidden rounded-full bg-muted'
        role='progressbar'
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className='h-full rounded-full bg-brand transition-[width] duration-500 ease-out'
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className='text-[11.5px] text-muted-foreground tabular-nums'>{percent}%</span>
    </div>
  )
}

/** A ring for compact spots (the editor's top bar). */
export function ProgressRing({ value, size = 18 }: { value: number; size?: number }) {
  const clamped = Math.max(0, Math.min(1, value))
  const stroke = 2.25
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
      className='-rotate-90'
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill='none'
        stroke='currentColor'
        strokeOpacity={0.15}
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill='none'
        stroke='var(--brand)'
        strokeWidth={stroke}
        strokeLinecap='round'
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped)}
        className='transition-[stroke-dashoffset] duration-500 ease-out'
      />
    </svg>
  )
}
