# UI components - glass design system

Source of truth for the look: `Mission_Architect_Glassmorphism_6_Screens/01…06_*.png` (1672x941). Import everything
from `src/components` (barrel `index.ts`). Styling = Tailwind v4 classes on the tokens in `src/index.css`.
All sizes are **design px on the 1672x941 canvas** (`ScaledStage` scales it; at a 1280px window 16 design px ≈ 12 real px,
so body text is `text-sm` (16) or larger, never below `text-xs` (14)).

## Tokens (`@theme` in `src/index.css`)

| Group | Token -> utility | Value / use |
|---|---|---|
| Surface | `bg` / `bg-2` | `#0a1a21` page, `#0f2530` mid tone |
| | `panel` / `panel-2` | solid fallbacks `#12272f` / `#173039` (only where blur is impossible) |
| | `glass` (colour) | `rgb(190 225 235 / .06)` translucent fill |
| | `hairline` | `rgb(255 255 255 / .12)` - every 1px border/divider: `border-hairline`, `bg-hairline` |
| Accent | `mint` / `mint-hi` / `mint-lo` | `#a3f0d4` / `#b6f5de` / `#8fe8c7` - primary button, active pill, progress |
| | `on-mint` | `#0b2a22` text on mint |
| Text | `text` / `text-dim` / `text-faint` | `#eef3f0` warm white / `#a2b2bb` secondary (≥4.5:1) / `#7e909a` captions + disabled only |
| Status | `green` / `amber` / `red` | `#8fe6b8` ok / `#f5c06a` warning / `#f4917d` critical (coral) |
| Data | `blue` / `purple` / `star` | `#9fd8f6` / `#bdb7f7` / `#f3d07c` (report bars 06, stars) |
| Radius | `rounded-panel` / `rounded-card` / `rounded-control` | 20 / 14 / 12 |
| Shadow | `shadow-glass` / `shadow-float` / `shadow-mint` | panel / floating layer / mint button |
| Motion | `animate-fade-in`, `animate-rise-in`, `animate-pulse-soft`, `ease-out-expo` | `prefers-reduced-motion` kills all animation |

**Fonts** (Google Fonts in `index.html`): `font-sans` = **DM Sans** (variable 300-700, optical size) for everything;
`font-mono` / `num` = **JetBrains Mono** for measured values ("4.1 / 5 kg", "600 km", "10:24", "$1.2 M").
Weights: `font-light` 300 display numbers, `font-normal` 400 page titles + body, `font-medium` 500 panel titles, buttons,
active tabs; `font-semibold` 600 rare. Mono only for numbers/data, never for prose.

**Type scale:** `text-xs` 14 · `sm` 16 · `base` 18 · `lg` 20 · `xl` 22 (panel title) · `2xl` 28 · `3xl` 36 ·
`text-title` 44 (page title) · `4xl` 48 · `text-stat` 44 (StatTile hero) · `5xl` 64 · `text-display` 72 (01 hero).

### Surface utilities
- `app-bg` - teal-navy page with blurred nebula radial glows (no images). Already applied by `AppShell`.
- `glass` - main panel: translucent fill + top sheen, `backdrop-filter: blur(22px) saturate(140%)`, 1px hairline,
  radius 20, `shadow-glass` (inner top highlight + deep soft shadow).
- `glass-inset` - nested surface inside a panel (list rows, inner cards, inputs): white 3.5%, hairline 9%, radius 14, **no blur**.
- `glass-strong` - floating layer (modal, tooltip, toast): 92% opaque, stronger shadow. Nested `backdrop-filter`
  inside another blurred element does nothing, so floating layers must be near-opaque on their own.
- `mint-fill` - mint gradient + `on-mint` text + `shadow-mint` (use for any "active/primary" chip).
- `num` - mono + tabular numerals.
- `bg-grid` - faint 24px blueprint grid (3D viewport, ImageSlot).
- Fallback: without `backdrop-filter` support `.glass`/`.glass-strong` switch to ~95% opaque fills automatically.

### Deprecated (still work so un-restyled screens render; do not use in new code)
| Old | Now maps to | Use instead |
|---|---|---|
| `cyan` colour, Tone `'cyan'` | mint `#a3f0d4` | `mint` |
| `line` colour (`border-line/40`) | `rgb(214 236 240 / .32)` so `/40` ≈ 13% white | `border-hairline` |
| `font-heading` | DM Sans | `font-sans` (default, omit) |
| `font-bold` / `font-extrabold` / `font-black` | all render **600** | `font-medium` / `font-semibold` |
| `panel-fill` | glass fill + blur (no border) | `glass` |
| `panel-fill-flat` | 82% solid panel | `glass-inset` / `glass-strong` |
| `starfield` | `app-bg` without stars | nothing (shell paints the background) |
| `text-glow` | no-op | - |
| `shadow-glow-cyan(-sm)`, `shadow-glow-green/amber/red` | calm 1px rings | `shadow-glass`, `shadow-mint` |
| `shadow-panel` | `shadow-glass` | `glass` |
| `GameHeader`, `BottomBar` | slim wrappers (see Layout) | `PageHeader`, `ActionBar` |

## Primitives
- `cx(...parts)`, `fmtNum(n)`, types `Status` (green|amber|red), `Tone` (+cyan|blue|purple|neutral), maps `TONE_TEXT`, `TONE_BG`, `TONE_HEX` (hex values match the tokens).
- `Icon` `{ name: IconName; size=20; filled?; strokeWidth=1.5 }` - thin line icons on a 24 grid. Names (`ICON_NAMES`): warning, shield, check, cross, lock, star, plus, minus, soundOn, soundOff, undo, redo, reset, rocket, satellite, antenna, info, help, bolt, mass, database, coins, calendar, arrowLeft, arrowRight, arrowUpRight, chevronDown/Up/Left/Right, play, pause, search, heart, flask, user, users, book, home, download, save, external, thermometer, link, sun, pulse, flag, camera, orbit, cube, target, document, settings, layers, globe, copy, zoomIn, zoomOut, rotate, expand, menu, clock, radiation. Add more in `Icon.tsx` (1.5px stroke, round caps, 24 grid).
- `Panel` `{ title?, subtitle?, right?, tone?: default|mint|cyan|green|amber|red, flush?, divided?, bodyClassName? }` + section props. Glass panel; title 22px medium at 22px padding; `divided` adds the hairline under the title (06); `right` holds a segmented toggle, "⚠ 2 issues", "Configure →".
- `Button` `{ variant: primary|secondary|ghost|danger|link; size: sm(36)|md(44)|lg(52); icon?, iconRight?; fullWidth?; silent? }` - plays `ui_click` unless `silent`. primary = mint; secondary = glass outline (Undo, Save draft, Back); ghost = frameless dim; danger = coral outline; link = underlined text ("How it works", "View brief ↗").
- `Tabs<T>` `{ tabs: {id,label,badge?,disabled?,disabledReason?}[]; value; onChange(id); variant: pill|segmented|underline; size: sm|md; fill?; aria-label? }` - `pill`/`segmented` = glass track with mint active segment (Payload | Power | Comms, Globe | Ground track, 1× | 4×); `underline` = light chip row (log filters).
- `Toggle` `{ checked, onChange, label?, options?: [off, on], size?, disabled?, aria-label? }` - with `options` it is the segmented two-state control ("Exploded | Assembled": `checked` = second option); without, a mint switch.
- `Checkbox` `{ checked, onChange(bool), label?, disabled?, shape: box|radio }` - `radio` = ring + mint dot (02 "Selected mission", 04 orbit options).
- `StatTile` `{ label, value, icon?, tone?, hint?, variant: hero|compact|tile, bare? }` - `hero` = big light number over dim label in a glass tile (01 "03 missions unlocked", 06 "76 GB"); `compact` = dim label over mono value (04 "Altitude 600 km"); `tile` = legacy. `bare` drops the frame when already inside a panel (avoid card-in-card).
- `Sparkline` `{ values; color?: hex|Tone ='green'; min?; max?; width=240; height=64; area=true; dot=true; grid=true }` - 1.75px line, faint grid.
- `StarRating` `{ value, max=3, size=24 }`.
- `Stepper` `{ current (0..5, fractional = active+done); steps?; hideNumbers? }`, `STEP_NAMES` - "● 01 Mission —— ○ 02 Design" line (02 bottom).

## Game widgets
- `Gauge` `{ label, unit, used, available, status, breakdown?, tooltipTitle?, orientation: horizontal|vertical, stacked?, icon?, format?, valueText?, barHeight=150 }`.
  **horizontal** (new default for screens): label left, mono `used / available unit` right, 6px bar below (03 "System constraints"); value text is neutral when ok, amber/coral otherwise; over-limit shows an end tick. `stacked` puts label and value above the bar (04 bottom strip). `valueText` replaces the value (e.g. "10 Mbps"). **vertical** = legacy thin column. Tooltip lists `breakdown`. Caller decides `status` from the engine.
- `ResourceStrip` `{ items: Omit<GaugeProps,'orientation'>[]; stacked=true }` - glass strip of gauges split by hairlines (04 bottom).
- `WarningCard` `{ severity: amber|red; what; value?; why?; detail?; fix?; actionLabel?; onAction?; action? }` - 03 style: glass-inset card, 3px coloured rail, "Power deficit · 5 W", explanation, mono `detail` ("Demand 14 W / Available 9 W"), link "Review power options →". Only `what` = one-line notice ("Schedule exceeds target by 2 months.").
- `CheckRow` `{ ok=true; children }` - mint check + text ("Payload (3)", "Mass within limit").
- `SelectCard` `{ selected?, disabled?, disabledReason?, locked?, onSelect? }` + div props - glass card (role=button, may contain buttons); selected = mint hairline + faint mint tint + corner check (02 Lunar Orbiter); locked = desaturated + lock badge.
- `ImageSlot` `{ aspect?: ratio | number | key of IMAGE_ASPECT; id? }` - glass-framed picture slot, shows `public/images/cards/<id>.webp` if listed in the index; empty grid otherwise.
- `Tooltip` `{ content, placement: top|bottom|left|right, disabled?, bubbleClassName? }` - glass-strong bubble, no portal (keep ancestors free of `overflow-hidden`).
- `Term` `{ term, definition?, children?, placement? }` - dotted underline + small `?`, definition in a tooltip.
- `Modal` `{ open, onClose?, title?, footer?, width=640, dismissible=true, showClose?, tone?: default|mint|amber|red }` - glass-strong dialog portalled into the stage; `tone` draws a 3px accent along the top edge (05 decision card = amber).

## Layout (`components/layout`)
- `ScaledStage` - wraps the app once; canvas 1672x941 (`STAGE_W/STAGE_H`), scaled to fit; < 1024px shows a notice.
- **`AppShell`** `{ children }` - mounted once in `App.tsx` around the current screen. Renders the 96px icon rail and a full-height `<main>` content slot of **1576 x 941** (`SHELL` const; there is NO top bar), `overflow-hidden`, `relative`. Screens render `h-full` inside it and must NOT draw their own logo / top bar / sound button.
  - Rail: logo mark, Overview · Mission · Design · Orbit · Simulation · Report, settings at the bottom (Sound, Builder hints, How to play). Active = mint tile.
  - Rail bottom group (top-down): separator, round sound toggle, profile avatar, settings. Profile = round icon avatar (never a photo) with a small green autosave dot (from `lastAutosaveAt`, hidden on menu/howto); tooltip "Profile · Solo workspace" + "Autosaved just now"; click opens a popover (Solo mode, Team mode coming soon).
  - Navigation rules (`useSections()` in `layout/nav.ts`): Overview=`menu` (How to Play counts as Overview) and Mission=`missions` always; Design=`builder` when a design exists (in memory, as a usable draft, or from the mission screen -> `startDesign()`); Orbit & launch=`orbit` only when the design exists and engine `designReady`; Simulation=`sim` only while `sim` exists; Report only when `report` exists (`showReport()`). Disabled items are muted with a tooltip saying why. `useSections()` / `SCREEN_SECTION` are exported if a screen needs the same logic.
- **`PageHeader`** `{ breadcrumb?: ReactNode[]; title; subtitle?; step?: [n, total]; actions?; actionsNote?; size: page|hero }` - breadcrumb (last crumb bright), 44px light title (`hero` = 72px for 01), dim 18px subtitle; right side "02 / 05" counter, hairline, actions, optional note ("Saved just now"). Padding 10/16/16/40.
- **`ActionBar`** `{ left? | onBack + backLabel; status?; statusTone?; center?; action? }` - 68px glass bar: Back left, status (dot + text) centred between hairlines, primary right (03/04). `center` takes custom content (05 "Science collected 58 GB | …").
- `GameHeader` *(deprecated)* - inside the shell renders only a 52px context row (mission name, `Stepper` if `step`, `rightSlot`); `mode` / `autosaved` ignored. `SoundButton` `{ compact? }` still exported (pill, or 40px round icon).
- `BottomBar` *(deprecated)* - `ActionBar` wrapped with shell gutters (`px-4 pt-2 pb-3.5`), same props as before.
- `Logo` `{ variant: mark|wordmark|full; size? }`, `LogoMark` - original planet-and-ring mark (no NASA logo).
- `Subtitles` - rendered once in `App.tsx`. Subtitles never cover content: while an `ActionBar` is mounted the line "● Mission control …" replaces the bar's centre slot (status fades out for those seconds, max 2 lines); the Overview (no action bar) gets a compact glass toast in the open sky above the hero spacecraft. `useSubtitleHost()` / `ActionBarSubtitle` are the hooks behind it.

## How to restyle a screen to the glass system

Measured on the mockups (design px, content area starts at x=96; the mockups' 64px top bar was removed, so shift the y values below up by 64):

```
| rail 96 | (former top bar 64: removed) ---------------------------------------------|
|         | PageHeader: crumbs y≈84, title 44px y≈124, subtitle 18px, right: 02 / 05 | actions
|         | content row: x 113…1657 (16px gutters), panels top ≈ y184, 13px gaps     |
|         |   3 columns (03): 410 | 698 | 408   ·  04: 726 | 806  ·  06: 3 x ≈ 460   |
|         | ActionBar: 68px high, 16px sides, 14px bottom margin (y 859…927)         |
```

1. Root: `<div className="flex h-full flex-col">` - no own header, no background (the shell paints `app-bg`).
2. `<PageHeader breadcrumb={[mission.name, 'Spacecraft builder']} title="Spacecraft design" subtitle="…" step={[2, 5]} actions={…} />` (01 Overview: `size="hero"`, no step).
3. Content: `<div className="grid min-h-0 flex-1 gap-[13px] px-4" style={{ gridTemplateColumns: '410px minmax(0,1fr) 408px' }}>` with `Panel`s (`h-full min-h-0`, scroll inside the body with `overflow-auto`). Use `minmax(0,1fr)` so wide children cannot push the grid out.
4. Bottom: `<div className="shrink-0 px-4 pt-3 pb-3.5"><ActionBar onBack={…} backLabel="Mission brief" status="Resolve critical constraints" statusTone="red" action={<Button iconRight="arrowRight">Continue to orbit</Button>} /></div>`.
5. Inside panels use `glass-inset` rows (radius 14), never a `glass` panel inside a `glass` panel. Lists: hairline dividers (`divide-y divide-white/10`).
6. Numbers/measurements in `num` (mono), labels in sans. Titles `font-normal`/`font-medium`, never bold/black, no uppercase-tracked eyebrows.
7. Colour: mint only for the primary action, the active selection and "ok" progress; amber/coral only for real warnings. Text secondary = `text-text-dim`.
8. Replace legacy tokens as you touch code (`border-line/40` -> `border-hairline`, `text-cyan` -> `text-mint`, `font-extrabold` -> `font-medium`, `panel-fill` + border -> `glass`, `shadow-glow-*` -> remove).
9. Verify at 1672x941: no overflow of the 1576x877 slot, nothing under 14px, focus rings visible.

## Stores / audio
- `store/settingsStore.ts`: `useSettingsStore` -> `soundOn, tutorialDone, hintsDismissed, setSoundOn, toggleSound, setTutorialDone, setHintsDismissed` (localStorage `ma_settings`).
- `audio/audioManager.ts`: `audio.playSfx(id)`, `audio.say(voiceId, subtitleText?)`, `audio.startAmbient()/stopAmbient()`, `audio.stopVoice()`, `audio.setEnabled(bool)`. Ids in `audio/audioManifest.ts`. `audio/subtitleStore.ts`: `useSubtitleStore` (`current`, `log`, `push`).
- Missing audio/image files: `tools/public_index.mjs` (runs on `npm run dev`/`build`) writes `public/audio/index.json` and `public/images/cards/index.json`; only listed files are requested. After adding files manually rerun `node tools/public_index.mjs`.
