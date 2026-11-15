import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { audio } from '../audio/audioManager'
import { cx } from './cx'
import { Icon, type IconName } from './Icon'

/**
 * primary   = mint fill, dark text ("Continue to orbit ->")
 * secondary = glass outline ("<- Mission brief", "Undo", "Save draft")
 * ghost     = no frame, dim text that brightens on hover ("Back to overview")
 * danger    = coral outline (destructive / risky)
 * link      = underlined inline text action ("How it works", "Review power options ->")
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'mint-fill hover:brightness-[1.04] active:brightness-95 disabled:brightness-100 disabled:saturate-50',
  secondary:
    'border border-white/[0.14] bg-white/[0.045] text-text shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] hover:border-white/25 hover:bg-white/[0.08] disabled:hover:border-white/[0.14] disabled:hover:bg-white/[0.045]',
  danger:
    'border border-red/50 bg-red/[0.08] text-red hover:border-red/75 hover:bg-red/[0.14] disabled:hover:bg-red/[0.08]',
  ghost: 'text-text-dim hover:bg-white/[0.06] hover:text-text disabled:hover:bg-transparent disabled:hover:text-text-dim',
  link: '!h-auto !px-0 text-text underline decoration-white/40 hover:text-mint hover:decoration-mint/70 disabled:hover:text-text',
}
const SIZE: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 rounded-[10px] px-3.5 text-sm',
  md: 'h-11 gap-2 rounded-control px-[18px] text-base',
  lg: 'h-[52px] gap-2.5 rounded-[14px] px-6 text-lg',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconName
  iconRight?: IconName
  fullWidth?: boolean
  /** do not play the ui_click sound */
  silent?: boolean
  children?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  fullWidth,
  silent,
  className,
  children,
  type = 'button',
  onClick,
  ...rest
}: ButtonProps) {
  const iconSize = size === 'lg' ? 22 : size === 'sm' ? 18 : 20
  return (
    <button
      type={type}
      className={cx(
        'inline-flex select-none items-center justify-center font-medium whitespace-nowrap transition-[background-color,border-color,color,filter,box-shadow] duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-45',
        VARIANT[variant],
        SIZE[size],
        fullWidth && 'w-full',
        className,
      )}
      onClick={(e) => {
        if (!silent) audio.playSfx('ui_click')
        onClick?.(e)
      }}
      {...rest}
    >
      {icon && <Icon name={icon} size={iconSize} strokeWidth={variant === 'primary' ? 1.9 : 1.6} />}
      {children}
      {iconRight && <Icon name={iconRight} size={iconSize} strokeWidth={variant === 'primary' ? 1.9 : 1.6} />}
    </button>
  )
}
