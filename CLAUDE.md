# Mission Architect

Browser game for NASA Space Apps Challenge 2026 ("Space Mission Design Game").

- **Read `GAME_DESIGN.md` first.** It is the single source of truth: rules, formulas, data, screens, audio, priorities, work order.
- **Design sources (current):** `Mission_Architect_Glassmorphism_6_Screens/01…06_*.png` (1672×941) — dark teal glassmorphism, mint accent, thin modern sans, left icon rail + top section tabs. These REPLACE the old `Mission_Architect/*.png` mockups and the colour/font tokens of GAME_DESIGN 10.1. Numbers and logic still come from `GAME_DESIGN.md`, not from the mockups. Never use a photo of a person (e.g. the avatar in the mockups) — use initials or an icon.
- **Spacecraft are 3D (three.js / react-three-fiber)**, highly detailed and procedural (no downloaded models/textures), built from the player's selected components. This overrides GAME_DESIGN 1.1 item 3 / 10.4 (flat SVG schematic) and the "no Three.js in P0" rule. 3D code lives in `src/spacecraft3d/` and `src/scene/`.
- **Card images:** mission-select covers, the menu collection and the report analog use the Codex-generated set in `assets_src/cards_v2/*.png` (generated on the user's request; brief in `assets_src/cards_v2/PROMPT.md`), built into `public/images/cards/*.webp` by `tools/build_cards.sh` (`mission_<id>[_locked]`, `collection_<id>[_locked]`; locked = desaturated/darkened copy). The previous set is backed up in `assets_src/cards_v1_backup/`. Component thumbnails are live renders of the 3D models; rocket slots stay empty. Generate new pictures only when the user asks.
- **Overview background:** user-provided photo `public/images/bg/overview.webp` (source `assets_src/overview_bg.png`).
- **Planet textures:** real public-domain NASA imagery (Blue Marble / Black Marble / clouds / topography for Earth, LRO for the Moon, Viking/MGS for Mars) is allowed for the 3D planets — the user approved downloading them. Store compressed copies in `public/textures/planets/`, credit sources in README. This is the only exception to "do not download pictures".
- **No NASA logo** anywhere.
- **Audio** is generated with the `elevenlabs` MCP server following section 14 (credit cap, estimate first, never retry a generation call).
- **Balance reference:** `python3 tools/balance_check.py [earth|lunar|mars]` — all three missions share one engine.
- Stack: Vite + React + TypeScript + Tailwind, Zustand, Howler.js, Vitest. No backend.
