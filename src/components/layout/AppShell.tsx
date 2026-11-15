import { useEffect, useRef, useState, type ReactNode } from 'react'
import { audio } from '../../audio/audioManager'
import { useGameStore } from '../../store/gameStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Button } from '../Button'
import { cx } from '../cx'
import { Icon } from '../Icon'
import { Modal } from '../Modal'
import { Toggle } from '../Toggle'
import { Tooltip } from '../Tooltip'
import { LogoMark } from './Logo'
import { TeamSetupModal } from '../../screens/team/TeamSetupModal'
import { useSections, type Section } from './nav'

/** Shell geometry in design px (measured on the 1672x941 mockups). */
export const SHELL = { railW: 96, topH: 0, gutter: 16, contentW: 1672 - 96, contentH: 941 } as const

function go(s: Section) {
  if (!s.enabled || s.active) return
  audio.playSfx('ui_click')
  s.go()
}

/* ------------------------------------------------------------------ rail */

function RailItem({ s }: { s: Section }) {
  return (
    <Tooltip content={s.enabled ? s.label : `${s.label} - ${s.reason}`} placement="right">
      <button
        type="button"
        aria-label={s.label}
        aria-current={s.active ? 'page' : undefined}
        aria-disabled={!s.enabled || undefined}
        onClick={() => go(s)}
        className={cx(
          'flex h-[52px] w-[62px] items-center justify-center rounded-[14px] transition-[background-color,color] duration-200',
          s.active && 'mint-fill',
          !s.active && s.enabled && 'text-text hover:bg-white/[0.07]',
          !s.enabled && 'cursor-not-allowed text-white/25',
        )}
      >
        <Icon name={s.icon} size={26} strokeWidth={s.active ? 1.7 : 1.5} />
      </button>
    </Tooltip>
  )
}

function Rail({ sections, onSettings }: { sections: Section[]; onSettings: () => void }) {
  return (
    <nav
      aria-label="Sections"
      className="relative z-30 flex h-full w-24 shrink-0 flex-col items-center border-r border-hairline bg-[#0a1a21]/55 pt-[14px] pb-[14px] backdrop-blur-xl"
    >
      <LogoMark size={50} className="text-text" />
      <div className="mt-[34px] flex flex-col items-center gap-[14px]">
        {sections.map((s) => (
          <RailItem key={s.id} s={s} />
        ))}
      </div>
      <div className="mt-auto flex flex-col items-center gap-1">
        <span className="mb-3 h-px w-10 bg-hairline" aria-hidden="true" />
        <RailSound />
        <ProfileButton />
        <Tooltip content="Settings" placement="right">
          <button
            type="button"
            aria-label="Settings"
            onClick={() => {
              audio.playSfx('ui_click')
              onSettings()
            }}
            className="flex h-[52px] w-[62px] items-center justify-center rounded-[14px] text-text transition-colors hover:bg-white/[0.07]"
          >
            <Icon name="settings" size={26} />
          </button>
        </Tooltip>
      </div>
    </nav>
  )
}

/* --------------------------------------------------------------- profile */

/** "just now" / "N min ago" since the last autosave; null when there is nothing to show (menu, how to play). */
function useAutosaveLabel(): string | null {
  const at = useGameStore((s) => s.lastAutosaveAt)
  const screen = useGameStore((s) => s.screen)
  const [, tick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])
  if (at == null || screen === 'menu' || screen === 'howto' || screen === 'nasa') return null
  const mins = Math.floor((Date.now() - at) / 60_000)
  return mins < 1 ? 'just now' : `${mins} min ago`
}

/** Round icon avatar (never a photo) with a small autosave dot; click opens a popover (Solo mode, Team mode soon). */
function ProfileButton() {
  const saved = useAutosaveLabel()
  const team = useGameStore((s) => s.team)
  const [open, setOpen] = useState(false)
  const [teamSetup, setTeamSetup] = useState(false)
  const workspace = team ? `Team mode · ${team.players.length} players` : 'Solo workspace'
  const at = team ? team.players[team.active] : null
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <span ref={ref} className="relative inline-flex">
      <Tooltip
        placement="right"
        disabled={open}
        content={
          <span className="flex flex-col">
            <span>Profile &middot; {workspace}</span>
            {saved && <span className="text-text-dim">Autosaved {saved}</span>}
          </span>
        }
      >
        <button
          type="button"
          aria-label={`Profile - ${workspace}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => {
            audio.playSfx('ui_click')
            setOpen((o) => !o)
          }}
          className="flex h-[52px] w-[62px] items-center justify-center rounded-[14px] transition-colors hover:bg-white/[0.07]"
        >
          <span
            className={cx(
              'relative flex h-[44px] w-[44px] items-center justify-center rounded-full border bg-gradient-to-b from-white/[0.12] to-white/[0.03] text-text transition-colors',
              open ? 'border-mint/60' : 'border-white/20',
            )}
          >
            <Icon name={team ? 'users' : 'user'} size={22} />
            {saved && (
              <span
                className="absolute right-0 bottom-0 h-[10px] w-[10px] rounded-full border-2 border-[#0d1f27] bg-green"
                aria-hidden="true"
              />
            )}
          </span>
        </button>
      </Tooltip>
      {open && (
        <div
          role="dialog"
          aria-label="Profile"
          className="absolute bottom-0 left-full z-40 ml-5 w-64 rounded-control border border-white/[0.14] bg-panel p-4 text-left shadow-[0_18px_40px_-12px_rgb(0_0_0/0.6)]"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/[0.06] text-text">
              <Icon name={team ? 'users' : 'user'} size={20} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-text">{at ? at.name || 'Team' : 'Player'}</div>
              <div className="text-sm text-text-dim">{workspace}</div>
            </div>
          </div>
          <p className="mt-3 text-sm text-text-dim">
            {team ? 'Hot-seat team: pass the console between roles on this device.' : 'Solo mode. Play as a team of 2-4 on one device.'}
          </p>
          <Button
            variant="secondary"
            size="sm"
            icon="users"
            className="mt-3"
            fullWidth
            onClick={() => {
              setOpen(false)
              setTeamSetup(true)
            }}
          >
            {team ? 'Manage team' : 'Set up team mode'}
          </Button>
          {saved && (
            <div className="mt-3 flex items-center gap-2 text-sm text-text-dim" role="status">
              <span className="h-2 w-2 rounded-full bg-green" aria-hidden="true" />
              Autosaved {saved}
            </div>
          )}
        </div>
      )}
      <TeamSetupModal open={teamSetup} onClose={() => setTeamSetup(false)} />
    </span>
  )
}

function RailSound() {
  const soundOn = useSettingsStore((s) => s.soundOn)
  const toggle = useSettingsStore((s) => s.toggleSound)
  return (
    <Tooltip content={soundOn ? 'Sound on' : 'Sound off'} placement="right">
      <button
        type="button"
        aria-pressed={soundOn}
        aria-label={soundOn ? 'Sound on - click to mute' : 'Sound off - click to unmute'}
        onClick={() => {
          toggle()
          if (!soundOn) audio.playSfx('ui_click')
        }}
        className={cx(
          'flex h-[52px] w-[62px] items-center justify-center rounded-[14px] transition-colors hover:bg-white/[0.07]',
          soundOn ? 'text-text' : 'text-text-dim',
        )}
      >
        <Icon name={soundOn ? 'soundOn' : 'soundOff'} size={24} />
      </button>
    </Tooltip>
  )
}

/* -------------------------------------------------------------- settings */

function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const soundOn = useSettingsStore((s) => s.soundOn)
  const setSoundOn = useSettingsStore((s) => s.setSoundOn)
  const hintsDismissed = useSettingsStore((s) => s.hintsDismissed)
  const setHintsDismissed = useSettingsStore((s) => s.setHintsDismissed)
  const goTo = useGameStore((s) => s.goTo)
  return (
    <Modal open={open} onClose={onClose} title="Settings" width={480}>
      <div className="flex flex-col divide-y divide-white/10">
        <div className="flex items-center justify-between py-3.5">
          <div>
            <div className="text-text">Sound</div>
            <div className="text-sm text-text-dim">Voice, effects and ambient music</div>
          </div>
          <Toggle checked={soundOn} onChange={setSoundOn} aria-label="Sound" />
        </div>
        <div className="flex items-center justify-between py-3.5">
          <div>
            <div className="text-text">Builder hints</div>
            <div className="text-sm text-text-dim">Short tips while you design</div>
          </div>
          <Toggle checked={!hintsDismissed} onChange={(on) => setHintsDismissed(!on)} aria-label="Builder hints" />
        </div>
        <div className="flex items-center justify-between py-3.5">
          <div>
            <div className="text-text">NASA data</div>
            <div className="text-sm text-text-dim">Every NASA source the game is built on</div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            iconRight="arrowRight"
            onClick={() => {
              onClose()
              goTo('nasa')
            }}
          >
            Open
          </Button>
        </div>
        <div className="flex items-center justify-between pt-3.5">
          <div>
            <div className="text-text">How to play</div>
            <div className="text-sm text-text-dim">Rules, resources and scoring</div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            iconRight="arrowRight"
            onClick={() => {
              onClose()
              goTo('howto')
            }}
          >
            Open
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/* ----------------------------------------------------------------- shell */

export interface AppShellProps {
  children: ReactNode
  className?: string
}

/**
 * App frame: 96px icon rail (left: logo mark, sections, then sound, profile avatar and settings at the bottom)
 * and a full-height content slot of 1576x941 design px (no top bar). Mount once inside `ScaledStage`.
 * Section reachability follows the game rules (see `useSections`).
 */
export function AppShell({ children, className }: AppShellProps) {
  const sections = useSections()
  const [settings, setSettings] = useState(false)
  return (
    <div className={cx('app-bg relative flex h-full w-full', className)}>
      <Rail sections={sections} onSettings={() => setSettings(true)} />
      <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
      <SettingsModal open={settings} onClose={() => setSettings(false)} />
    </div>
  )
}
