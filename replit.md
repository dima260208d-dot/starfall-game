# Clash Arena

A browser-based anime-style battle arena game inspired by Brawl Stars, built with React + Vite + Canvas 2D.

## Architecture

- **Frontend**: React + Vite (TypeScript), at `artifacts/clash-arena/`
- **Backend**: Express API server at `artifacts/api-server/` (not actively used by the game — all state is in localStorage)
- **No Database**: All game progress saved to browser localStorage

## Key Files

### Entry Points
- `artifacts/clash-arena/src/main.tsx` — React mount
- `artifacts/clash-arena/src/App.tsx` — Screen state machine (auth → menu → modes → game)

### Pages
- `src/pages/AuthPage.tsx` — Register / Sign In / Guest play
- `src/pages/MainMenu.tsx` — Hub with play, collection, shop, settings
- `src/pages/ModeSelect.tsx` — 5 modes (2 playable, 3 coming soon)
- `src/pages/CharacterSelect.tsx` — 10-character picker with sprite animation
- `src/pages/GameScreen.tsx` — Canvas game wrapper with game-over overlay
- `src/pages/CollectionPage.tsx` — Brawler stats, upgrade, and level display
- `src/pages/ShopPage.tsx` — Mystery boxes, daily bonus, gem purchases
- `src/pages/SettingsPage.tsx` — Controls reference, profile info, switch account

### Game Engine
- `src/game/sprites.ts` — Sprite sheet loader and frame-draw utility
- `src/game/Camera.ts` — World-to-screen transform
- `src/game/InputHandler.ts` — WASD + mouse input, LMB attack, RMB/E super
- `src/game/MapRenderer.ts` — Tile map generation + rendering for both modes
- `src/entities/BrawlerData.ts` — 10 brawler stats + `getScaledStats()`
- `src/entities/Brawler.ts` — Player/ally brawler class with HP bar, regen, attacks
- `src/entities/Bot.ts` — AI bot with seek/chase/attack/flee state machine
- `src/entities/Projectile.ts` — Projectile physics, collision, rendering
- `src/modes/ClashShowdown.ts` — 8-player battle royale with shrinking gas zone
- `src/modes/ClashCrystals.ts` — 3v3 crystal collect-to-10 team mode

### Utilities
- `src/utils/localStorageAPI.ts` — Profile CRUD, login, upgrades, box opening, daily bonus
- `src/utils/damageNumbers.ts` — Floating damage number system
- `src/utils/helpers.ts` — Math utilities (angle, distance, clamp, etc.)

## Game Modes

| Mode | Status | Description |
|------|--------|-------------|
| Clash Showdown | ✅ Playable | 8-player battle royale, last one standing wins, gas zone shrinks |
| Clash Crystals | ✅ Playable | 3v3, collect 10 crystals to win, drop on death |
| Crystal Siege | 🔒 Coming Soon | — |
| Neon Rush | 🔒 Coming Soon | — |
| Team Clash | 🔒 Coming Soon | — |

## Characters (10 Brawlers)

Sprite sheet at `public/characters.webp` (5 cols × 2 rows):
- Row 0: Miya (assassin), Kibo (sniper), Ronin (tank), Yuki (support), Kenji (controller)
- Row 1: Hana (healer), Goro (berserker), Sora (mage), Rin (poisoner), Taro (engineer)

## Controls

| Action | Key |
|--------|-----|
| Move | WASD / Arrow Keys |
| Aim | Mouse |
| Attack | LMB / Space |
| Super | RMB / E |
| Exit | ESC or EXIT button |

## Progression System

- **Coins**: Earned from games (100 win / 40 loss), mystery boxes, daily bonus
- **Gems**: Premium currency, earnable from mystery boxes
- **Power Points**: Used with coins to level up brawlers (1–10)
- **Level scaling**: HP +5%/level, ATK DMG +3%/level

## Workflows

- `artifacts/clash-arena: web` — Vite dev server on port 19121
- `artifacts/api-server: API Server` — Express on port 8080 (not needed for game)
