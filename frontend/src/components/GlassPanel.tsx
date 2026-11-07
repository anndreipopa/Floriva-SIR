import type { HTMLAttributes } from 'react'

/**
 * The translucent "glass" surface used across the dashboard (see docs/ai/DESIGN.md).
 * `solid` is the normal panel; `skeleton` is the paler variant for loading states.
 */
type GlassPanelProps = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'section'
  variant?: 'solid' | 'skeleton'
}

const baseClasses =
  'rounded-2xl border border-white/85 backdrop-blur-md'

const variantClasses = {
  solid:
    'bg-white/75 shadow-[0_14px_32px_-20px_rgba(20,110,105,0.45)]',
  skeleton:
    'bg-white/55 shadow-[0_14px_32px_-20px_rgba(20,110,105,0.35)]',
} as const

export function GlassPanel({
  as: Tag = 'div',
  variant = 'solid',
  className = '',
  ...rest
}: GlassPanelProps) {
  return (
    <Tag
      className={`${baseClasses} ${variantClasses[variant]} ${className}`.trim()}
      {...rest}
    />
  )
}
