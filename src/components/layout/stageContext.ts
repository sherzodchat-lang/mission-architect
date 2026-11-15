import { createContext } from 'react'

/** The DOM node of the scaled canvas; Modal portals into it so dialogs scale with the game. */
export const StageRootContext = createContext<HTMLElement | null>(null)
