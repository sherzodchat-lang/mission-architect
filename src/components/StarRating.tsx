import { cx } from './cx'
import { Icon } from './Icon'

export interface StarRatingProps {
  /** number of filled stars */
  value: number
  max?: number
  /** px size of one star (default 24) */
  size?: number
  className?: string
}

/** Row of soft-gold filled and faint outlined stars. */
export function StarRating({ value, max = 3, size = 24, className }: StarRatingProps) {
  return (
    <span className={cx('inline-flex items-center gap-1', className)} role="img" aria-label={`${value} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <Icon
          key={i}
          name="star"
          size={size}
          filled={i < value}
          strokeWidth={1.5}
          className={i < value ? 'text-star' : 'text-white/25'}
        />
      ))}
    </span>
  )
}
