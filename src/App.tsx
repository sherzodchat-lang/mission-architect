import { AppShell, ScaledStage, Subtitles } from './components'
import { useGameStore } from './store/gameStore'
import MainMenu from './screens/MainMenu'
import MissionSelect from './screens/MissionSelect'
import Builder from './screens/Builder'
import OrbitLaunch from './screens/OrbitLaunch'
import Simulation from './screens/Simulation'
import Report from './screens/Report'
import HowToPlay from './screens/HowToPlay'
import NasaData from './screens/NasaData'

const SCREENS = {
  menu: MainMenu,
  missions: MissionSelect,
  builder: Builder,
  orbit: OrbitLaunch,
  sim: Simulation,
  report: Report,
  howto: HowToPlay,
  nasa: NasaData,
} as const

export default function App() {
  const screen = useGameStore((s) => s.screen)
  const Screen = SCREENS[screen] ?? MainMenu
  return (
    <ScaledStage>
      <AppShell>
        <Screen key={screen} />
      </AppShell>
      <Subtitles />
    </ScaledStage>
  )
}
