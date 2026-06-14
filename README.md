# The In-Laws Are Coming — A Suburban RPG

A retro NES-style JRPG where ordinary homeowner problems are treated with mythic seriousness.
Dragon Warrior bones. Modern Family comedy. One Dad. Fourteen days. One impossible standard of cleanliness set by someone who does not live here.

---

## What's in the game right now

**Story**
- Opening cutscene — Dad gets woken from his "not-nap," learns the dryer is broken, and discovers the in-laws arrive in two weeks
- Custom name entry for The Dad
- Post-victory wife dialogue teasing the next quest (the toilet)

**World**
- House hub (neighborhood scene) with living room, kitchen, hallway, and mudroom
- Garage dungeon — winding corridors, storage junk, a toolbox chest with the wrench
- Basement dungeon — branching maze, circuit breaker puzzle, dryer boss room

**Combat**
- Turn-based battle system (Fight / Dad Skills / Item / Run)
- Three enemies: Dust Bunny, Angry Dust Bunny (tougher basement variant), Freaky Icky Spider
- Evil Heating Coil boss fight with dedicated boss music
- Dad trash-talk, movie quotes, and dryer boss banter during battle
- Post-boss: the angry dryer swaps to a happy fixed dryer in the world

**Mechanics**
- Circuit breaker puzzle — turn off power before fighting the coil for better odds
- Wrench weapon required for the boss
- XP / leveling / Dad Points / inventory system
- Quest log and character sheet (press **M**)
- Random encounter toggle dev shortcut (Shift+E)

**Audio**
- Opening story: gentle home theme
- House / tile room: cozy 8-bit comfort music
- Garage / basement exploration: dramatic dungeon track
- Dryer boss fight: dedicated mini-boss track that kicks in when the coil appears

**Controls**

| Key | Action |
|---|---|
| Arrow keys | Move |
| Space | Interact / Advance dialogue |
| M | Open menu (quests, items, character, save) |
| Q (hold) | Show active quest |
| Shift+D | Dev: reset to first quest |
| Shift+C | Dev: clear save, restart from name entry |
| Shift+E | Dev: toggle random encounters |

---

## Development

```powershell
npm install
npm run dev        # dev server at http://127.0.0.1:5174
npm run build      # production build → dist/
npm run preview    # preview production build
```

After editing a Tiled map:

```powershell
node scripts/process-maps.mjs   # inline tilesets into processed map
```

---

## Save data

Progress is saved to browser `localStorage`. To reset:

```js
localStorage.removeItem("the-in-laws-are-coming-save");
localStorage.removeItem("suburban-jrpg-save");
location.reload();
```

Or press **Shift+C** in-game.

---

## Deployment

Vercel is connected to `pithed2/suburban-jrpg` watching the `main` branch. Every push to `main` triggers a new deployment.

Vercel settings:
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Production Branch: `main`

See [vercel.json](vercel.json) for build/output config and the single-page app rewrite rule.
