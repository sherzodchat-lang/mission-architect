import type { AnyComponent, CatalogCategory, CategoryId, Design, Mission, SlotKey } from '../../data'
import type { Issue } from '../../engine'

/** Ids currently selected in a slot group. */
export function selectedIds(design: Design, key: SlotKey): string[] {
  if (key === 'instruments') return design.instruments
  const v = design[key]
  return v ? [v] : []
}

export function componentsOf(mission: Mission, key: SlotKey): AnyComponent[] {
  return mission.catalog[key] as AnyComponent[]
}

export function findComponent(mission: Mission, key: SlotKey, id: string): AnyComponent | undefined {
  return componentsOf(mission, key).find((c) => c.id === id)
}

export type FillState = 'full' | 'partial' | 'empty'

/** full = every group meets its minimum; partial = something installed but not all groups. */
export function categoryFill(cat: CatalogCategory, design: Design): FillState {
  const counts = cat.groups.map((g) => selectedIds(design, g.key).length)
  if (cat.groups.every((g, i) => counts[i] >= Math.max(1, g.min))) return 'full'
  return counts.some((c) => c > 0) ? 'partial' : 'empty'
}

export function categoryOfSlot(mission: Mission, key: SlotKey): CatalogCategory | undefined {
  return mission.categories.find((c) => c.groups.some((g) => g.key === key))
}

/** Which catalog tab helps to fix an issue. */
export function issueTab(issue: Issue, mission: Mission, design: Design): CategoryId | null {
  const has = (id: CategoryId) => mission.categories.some((c) => c.id === id)
  if (issue.slot) return categoryOfSlot(mission, issue.slot)?.id ?? null
  switch (issue.code) {
    case 'power_bus':
    case 'power_instruments':
    case 'battery_small':
      return 'power'
    case 'comms_bottleneck':
    case 'pointing_radio':
      return 'comms'
    case 'storage_buffer':
      return 'computer'
    case 'pointing_instrument':
      return 'attitude'
    case 'fuel':
      return has('propulsion') ? 'propulsion' : null
    case 'mass_limit':
      return heaviest(mission, design, (c) => c.kg)
    case 'budget':
      return heaviest(mission, design, (c) => c.costM)
    case 'schedule_over':
    case 'schedule_window':
      return heaviest(mission, design, (c) => c.months)
    default:
      return null
  }
}

/** Category whose installed parts contribute most of a resource. */
function heaviest(mission: Mission, design: Design, val: (c: AnyComponent) => number): CategoryId | null {
  let best: CategoryId | null = null
  let bestV = -1
  for (const cat of mission.categories) {
    let v = 0
    for (const g of cat.groups) {
      for (const id of selectedIds(design, g.key)) {
        const c = findComponent(mission, g.key, id)
        if (c) v += val(c)
      }
    }
    if (v > bestV) {
      bestV = v
      best = cat.id
    }
  }
  return bestV > 0 ? best : null
}
