import { Modal } from '../../components'
import { AnalogShelf } from './AnalogShelf'
import { SavedDesigns } from './SavedDesigns'

/** "View all": real-mission analog collection plus saved designs. */
export function CollectionModal({ open, onClose, discovered }: { open: boolean; onClose: () => void; discovered: string[] }) {
  return (
    <Modal open={open} onClose={onClose} title="Collection" width={1240}>
      <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-8">
        <AnalogShelf discovered={discovered} />
        <div className="border-l border-hairline pl-8">
          <SavedDesigns onLoaded={onClose} />
        </div>
      </div>
    </Modal>
  )
}
