import type { ReactNode } from 'react'
import { audio } from '../../audio/audioManager'
import { useSettingsStore } from '../../store/settingsStore'
import { cx } from '../cx'
import { Icon } from '../Icon'
import { Stepper } from '../Stepper'
import { Tooltip } from '../Tooltip'

export interface SoundButtonProps {
  /** round 40px icon button (top bar). Default false = glass pill "Sound: On". */
  compact?: boolean
  className?: string
}

/** Sound on/off (settings store). */
export function SoundButton({ compact, className }: SoundButtonProps) {
  const soundOn = useSettingsStore((s) => s.soundOn)
  const toggle = useSettingsStore((s) => s.toggleSound)
  const onClick = () => {
    toggle()
    if (!soundOn) audio.playSfx('ui_click')
  }
  if (compact) {
    return (
      <Tooltip content={soundOn ? 'Sound on' : 'Sound off'} placement="bottom">
        <button
          type="button"
          onClick={onClick}
          aria-pressed={soundOn}
          aria-label={soundOn ? 'Sound on - click to mute' : 'Sound off - click to unmute'}
          className={cx(
            'flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04] transition-colors hover:border-white/25 hover:bg-white/[0.08]',
            soundOn ? 'text-text' : 'text-text-dim',
            className,
          )}
        >
          <Icon name={soundOn ? 'soundOn' : 'soundOff'} size={20} />
        </button>
      </Tooltip>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={soundOn}
      className={cx(
        'inline-flex h-10 items-center gap-2 rounded-control border border-white/[0.12] bg-white/[0.04] px-3.5 text-sm font-medium whitespace-nowrap text-text transition-colors hover:border-white/25 hover:bg-white/[0.08]',
        className,
      )}
    >
      <Icon name={soundOn ? 'soundOn' : 'soundOff'} size={18} />
      Sound: {soundOn ? 'On' : 'Off'}
    </button>
  )
}

export interface GameHeaderProps {
  missionName?: string
  /** active step 0..4 (Mission, Design, Orbit, Launch, Operations); omit to hide the stepper */
  step?: number
  /** @deprecated the shell top bar shows the workspace mode */
  mode?: ReactNode
  /** @deprecated the shell top bar shows the Autosaved state */
  autosaved?: boolean
  /** extra controls on the right (e.g. Pause / speed buttons in simulation) */
  rightSlot?: ReactNode
  className?: string
}

/**
 * @deprecated Legacy per-screen header. Inside `AppShell` the logo, section tabs, sound and autosave live in the
 * shell, so this now renders only a slim 52px context row (mission name, stepper, `rightSlot`). New screens use
 * `PageHeader` instead.
 */
export function GameHeader({ missionName, step, rightSlot, className }: GameHeaderProps) {
  if (!missionName && step == null && !rightSlot) return null
  return (
    <header className={cx('flex h-[52px] shrink-0 items-center gap-5 px-6', className)}>
      {missionName && <span className="text-base whitespace-nowrap text-text-dim">{missionName}</span>}
      {missionName && step != null && <span className="h-5 w-px bg-hairline" aria-hidden="true" />}
      {step != null && <Stepper current={step} className="shrink-0" />}
      {rightSlot && <div className="ml-auto flex shrink-0 items-center gap-3">{rightSlot}</div>}
    </header>
  )
}
