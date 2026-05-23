# Suburban JRPG - Foundation Document

## Core Concept

A retro-inspired, 16-bit style JRPG where ordinary suburban homeowner problems are treated with mythic seriousness.

The game follows a Gen X suburban homeowner trying to restore order to his collapsing household before the in-laws arrive. Every domestic inconvenience becomes an epic-scale RPG crisis.

## Tone

- Dry humor
- Sincere absurdity
- Suburban mythmaking
- Relatable homeowner stress
- Cozy catastrophe

Primary tonal inspirations:

- EarthBound
- Dragon Quest
- Sitcom pacing
- Midwest homeowner exhaustion

This is not a parody game. It is a sincere RPG world built around absurdly relatable suburban problems.

## Core Design Philosophy

### Guiding Rule

Build vertically, not horizontally.

Do not endlessly expand systems. Expand content.

The game should focus on:

- Memorable quests
- Funny but emotionally grounded dialogue
- Distinct bosses
- Relatable suburban suffering
- Compact, dense areas

Avoid:

- Massive open world
- Multiplayer
- Procedural systems
- Overly complex RPG mechanics
- Infinite feature creep

The goal is a fun, stand-alone, single-player suburban JRPG with expandable quests and storylines.

## Technology Stack

### Frontend

- Phaser 3
- TypeScript
- Vite

### Mapping

- Tiled

### Art

- SNES-inspired 16-bit style
- Low resolution pixel art
- Slightly exaggerated proportions
- Intentionally imperfect visuals embraced as charm
- Kenney assets initially, gradually replaced with custom art

### Audio

- BeepBox
- Bosca Ceoil
- Retro SNES-style soundtrack

### Hosting

- GitHub repository
- Cloudflare Pages

### Backend

- Cloudflare Workers
- Cloudflare D1 database

### Data

- JSON-driven systems
- Content stored in data files, not hardcoded

### Save System

- Server-backed saves through D1
- Minimal local browser storage

## Visual Direction

Late SNES / EarthBound-inspired presentation.

The goal is expressive charm, not realism.

Internal rendering target: `320x180`.

### Art Philosophy

Bad high-detail art looks amateur. Bad low-resolution art can become stylistic charm.

Lean into:

- Exaggerated expressions
- Awkward animations
- Weird suburban enemy designs
- Cozy retro UI

## Core Gameplay Loop

The player receives a suburban crisis.

Loop:

1. Receive quest
2. Explore neighborhood or dungeon
3. Battle enemies
4. Acquire supplies or tools
5. Solve household disaster
6. Restore temporary suburban order
7. Countdown advances toward in-law arrival

## Main Story Premise

The protagonist's in-laws are coming to stay.

The house is falling apart. Everything is breaking. The protagonist must prepare the house before their arrival.

The mother-in-law functions as a looming source of judgment and tension.

The story should not portray the wife as a stereotypical nagging sitcom spouse. Instead, she is:

- Competent
- Practical
- Slightly exhausted
- Trying to hold everything together

Humor should come from circumstance, escalation, and emotional overreaction to relatable situations, not from cruelty.

## Narrative Structure

The game should use:

- Sitcom pacing
- Episodic crises
- Recurring characters
- Escalating household disasters
- JRPG progression structure

A countdown/day system is recommended.

Example: `12 DAYS UNTIL ARRIVAL`

Potential structure:

- Day 14: Dryer broken
- Day 12: Lawn destroyed by moles or voles
- Day 10: Gutter catastrophe
- Day 8: Water heater issues
- Day 6: Teen attitude rebellion arc
- Day 4: Garage disaster
- Day 2: HOA violation event
- Day 1: Final cleanup crisis

## MVP Scope

The MVP should remain intentionally tiny.

### Areas

- Neighborhood/subdivision
- Basement dungeon
- Backyard

### Systems

- Movement
- Dialogue
- Turn-based combat
- Inventory
- Shop system
- Save/load
- One complete questline

### Enemies

- Dust Bunny
- Slime
- Hair Drain Horror
- Spider of Mild Concern
- Leaky Pipe

### Boss

- Evil Heating Coil

### Goal

Fix the dryer before the situation spirals further.

### Deliverable

A complete playable 10-15 minute experience.

## Quest Philosophy

Every quest should answer:

> What everyday suburban situation feels absurdly catastrophic?

Examples:

- Cleaning gutters
- Clogged drains
- Broken dryer
- Hardware store trips
- Lawn destruction
- Teen mood swings
- WiFi outages
- HOA complaints
- Water heater failures
- Garage clutter
- Missing extension cords

The game should treat these situations with complete JRPG seriousness.

Example tone:

```text
WIFE: The towels are still damp.
HERO: ...Dear God.
```

## Enemy Philosophy

Enemies represent emotional suburban frustration, not random monsters.

| Enemy | Emotional Meaning |
| --- | --- |
| Plugged Toilet | Dread |
| Hair Drain Beast | Disgust |
| Gutter Slime | Procrastination |
| Mole King | Violated suburban pride |
| HOA Wraith | Passive aggression |
| WiFi Phantom | Helpless rage |
| Endless Storage Box | Confusion |

Bosses should escalate emotional suburban suffering.

## Combat Philosophy

Combat should remain simple and classic.

Recommended battle structure:

- Fight
- Dad Skills
- Items
- Run

Avoid action combat, tactical grids, and overcomplicated systems.

Focus on:

- Funny enemy attacks
- Status effects
- Boss gimmicks
- Battle pacing
- Humor through framing

## Dad Skills

Magic is replaced with suburban life skills.

Examples:

- Percussive Maintenance
- Google It
- Temporary Fix
- Call Dave
- Duct Tape Solution
- Deep Sigh
- Grill Master Focus

## Equipment Examples

### Weapons

- Adjustable Wrench
- Leaf Blower
- Grill Spatula
- Shop Vac
- Extension Cord Whip

### Armor

- Cargo Shorts
- Grass-Stained Sneakers
- Good Hoodie
- Reading Glasses of Precision

### Consumables

- Cold Beer
- Leftover Pizza
- Ibuprofen
- Energy Drink
- Gas Station Hot Dog

## Data-Driven Design Rules

Do not hardcode quests, enemies, or items.

Use JSON-driven systems.

Good:

- `enemies.json`
- `quests.json`
- `items.json`
- `dialogue.json`

Bad:

- Hardcoded quest logic directly inside TypeScript files

The game should be expandable primarily through content additions.

## Scope Control Rules

The greatest danger to the project is feature creep.

The first milestone is not:

- Building an engine
- Designing infinite systems
- Architecting multiplayer

The first milestone is:

> Create one complete, playable suburban RPG adventure.

Specifically:

> Walk around -> Talk to NPCs -> Enter basement -> Fight enemies -> Defeat Evil Heating Coil -> Save game -> Credits

Only after this exists should expansion happen.

## Immediate Next Steps

1. Create GitHub repository
2. Create Phaser + TypeScript project
3. Define basic movement
4. Create one neighborhood map in Tiled
5. Create placeholder player sprite
6. Implement dialogue box system
7. Implement basic battle system
8. Implement Evil Heating Coil boss fight
9. Create first complete playable vertical slice

## Final Guiding Principle

This game succeeds through:

- Charm
- Relatability
- Personality
- Consistency
- Memorable suburban absurdity

Not through:

- Technical complexity
- Photorealism
- Massive scale
- Endless mechanics

The goal is a memorable, funny, emotionally recognizable suburban JRPG adventure.

Build quests, enemies, skills, weapons, armor, and health restore items further when we get there.

