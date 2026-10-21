import { cn } from '@/lib/utils'

// Covers without an image get one of these tints, chosen by the title so a
// book keeps its colour.
const TINTS = [
  ['oklch(0.36 0.06 262)', 'oklch(0.27 0.05 262)'],
  ['oklch(0.42 0.07 160)', 'oklch(0.31 0.05 160)'],
  ['oklch(0.45 0.09 35)', 'oklch(0.33 0.07 35)'],
  ['oklch(0.4 0.05 300)', 'oklch(0.29 0.04 300)'],
  ['oklch(0.46 0.07 85)', 'oklch(0.34 0.05 85)'],
  ['oklch(0.33 0.02 250)', 'oklch(0.24 0.02 250)'],
] as const

function tint(title: string) {
  let hash = 0
  for (const char of title) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0
  return TINTS[hash % TINTS.length] ?? TINTS[0]
}

/** A book's cover at 2:3: its image, or a typeset placeholder. */
export function BookCover({
  title,
  image,
  className,
}: {
  title: string | null | undefined
  image?: string | null
  className?: string
}) {
  const label = title?.trim() || 'Untitled'
  if (image) {
    return (
      <img
        src={image}
        alt=''
        className={cn(
          'aspect-[2/3] shrink-0 rounded-[4px] object-cover shadow-[0_1px_3px_rgb(0_0_0/0.25)]',
          className
        )}
      />
    )
  }
  const [from, to] = tint(label)
  return (
    <div
      aria-hidden
      className={cn(
        // Sized from its own width, so a thumbnail and a full cover read alike.
        'relative flex aspect-[2/3] shrink-0 flex-col justify-between overflow-hidden rounded-[4px] p-[9%] text-white shadow-[0_1px_3px_rgb(0_0_0/0.25)] [container-type:inline-size]',
        className
      )}
      style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}
    >
      {/* The spine's crease. */}
      <span className='absolute inset-y-0 left-[6%] w-px bg-white/15' />
      <span className='line-clamp-5 hyphens-auto font-serif text-[clamp(5px,13cqw,24px)] leading-[1.12] [font-variation-settings:"opsz"_24]'>
        {label}
      </span>
      <span className='h-px w-1/3 bg-white/40' />
    </div>
  )
}
