import { useState } from 'react'
import { Button, Modal } from '../../components'
import { MAX_SAVES } from '../../store/persistence'
import { useGameStore } from '../../store/gameStore'

export interface SaveDesignModalProps {
  open: boolean
  onClose: () => void
  defaultName: string
}

/** Name prompt for "Save design". Keeps at most five designs (the oldest is replaced when full). */
export function SaveDesignModal({ open, onClose, defaultName }: SaveDesignModalProps) {
  const savedCount = useGameStore((s) => s.saves.length)
  const save = useGameStore((s) => s.saveCurrentDesign)
  const [name, setName] = useState(defaultName)
  const [done, setDone] = useState(false)
  const full = savedCount >= MAX_SAVES

  const close = () => {
    setDone(false)
    onClose()
  }
  const submit = () => {
    save(name)
    setDone(true)
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={done ? 'Design saved' : 'Save design'}
      width={560}
      footer={
        done ? (
          <Button onClick={close}>Close</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button icon="save" onClick={submit}>
              Save
            </Button>
          </>
        )
      }
    >
      {done ? (
        <p className="text-lg text-text">
          “{name.trim() || 'Your design'}” is saved. Find it on the main menu under Saved designs.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <label htmlFor="design-name" className="text-base font-medium text-text">
            Name your design
          </label>
          <input
            id="design-name"
            autoFocus
            value={name}
            maxLength={32}
            onChange={(e) => setName(e.target.value)}
            className="glass-inset mt-2 h-12 w-full px-4 text-lg text-text outline-none transition-colors placeholder:text-text-faint focus:!border-mint/60 focus-visible:ring-2 focus-visible:ring-mint/40"
          />
          <p className="mt-3 text-sm text-text-dim">
            {full
              ? `You already have ${MAX_SAVES} saved designs. Saving replaces the oldest one.`
              : `${savedCount} of ${MAX_SAVES} slots used.`}
          </p>
        </form>
      )}
    </Modal>
  )
}
