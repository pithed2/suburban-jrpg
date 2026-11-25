# Quest outline: quests 3 to 10

Status: draft for review. This is a plan. No code or data changes yet.

## 1. Rules for every quest

1. Each quest is one house or yard crisis, one dungeon, one boss.
2. The boss has a gate item. A side quest gives the item. Without the item, the boss win rate is under 10% at the top of the quest level band. With the item, the boss follows the curve in rule 3.
3. Boss win curve, same as quests 1 and 2: about 30% at the band level, about 75% at band + 1, about 95% at band + 2 (simulated with the item and the quest gear).
4. The grind gets longer each quest. Target: 25 to 40 random fights per quest. Fights per level go up from about 12 in quest 3 to about 40 in quest 10, because the late levels need more XP and the bosses are 1 level apart.
5. Each dungeon has a deep zone (`regions`) with harder enemies and better chests. Each dungeon has one rare high-XP enemy, like the Golden Roll.
6. Original art only. New enemies can reuse old art with `tint` for a first pass.
7. Tone: from `docs/foundation.md`. Dad treats small problems as epic. The wife is competent and tired, not a nag. No cruelty.

## 2. Level plan

Quest 2 ends at about LV 8 (580 XP). The level table stops at LV 20.

| Quest | Countdown | Level band | Boss 75% level | XP to grind (from last boss level) | Avg XP per normal fight | Est. fights |
| --- | --- | --- | --- | --- | --- | --- |
| 3 Lawn | 10 days | 8 to 11 | 10 | 870 | 30 to 40 | 25 to 30 |
| 4 Gutters | 9 days | 10 to 13 | 12 | 1,500 | 45 to 55 | 30 |
| 5 Water heater | 8 days | 12 to 15 | 14 | 2,350 | 60 to 70 | 35 to 40 |
| 6 WiFi | 7 days | 14 to 16 | 15 | 1,600 | 55 to 65 | 25 to 30 |
| 7 Garage | 6 days | 15 to 17 | 16 | 1,900 | 60 to 70 | 30 |
| 8 HOA | 5 days | 16 to 18 | 17 | 2,200 | 60 to 70 | 30 to 35 |
| 9 Disposal | 3 days | 17 to 19 | 18 | 2,600 | 65 to 75 | 35 to 40 |
| 10 Arrival | 1 day | 18 to 20 | 19 | 3,000 | 70 to 80 | 40 |

Boss XP is not counted in the grind column. It is a bonus of about 15% to 20% of the next level.

Total estimate: about 250 to 300 random fights from quest 3 to the end. Classic NES pace, if each fight takes about 30 seconds, is 2 to 3 hours of grinding. Confidence: 0.6. The real number depends on run rate, heal costs and how often the player goes home to rest.

## 3. Quest 3: Reclaim the Lawn (detailed)

**Countdown:** 10 DAYS UNTIL ARRIVAL. **Band:** LV 8 to 11. **Boss:** Mole King.

### Premise and hook

The mother-in-law calls. She says she will "do the walk around the property, like always." Dad looks out the back window. The lawn looks like a minefield. Something is under it. Something with a crown.

Comedy hook: Dad takes lawn pride personally. Every hole is an insult to him. The Brain narrates the lawn like a war documentary.

### Areas

1. **Backyard (overworld, new).** First outdoor map. Uses `suburb_exterior_16x16`. Has mole hills (hotspots), the garden shed, the fence gate to the neighbor, and 4 tunnel entrances.
2. **Garden Shed (small, safe).** Shop room: the shed has a "seasonal aisle" of things Dad bought and forgot. Rest point.
3. **Mole Tunnels (dungeon, 3 depths).** Depth 1: roots and grubs. Depth 2: flooded sprinkler line. Depth 3 (deep zone): the Mole King's throne room, made of lost lawn ornaments.

### Monster roster (first-pass numbers, tune with `npm run balance`)

| Enemy | Role | HP | Listed dmg | Agility | XP | Note |
| --- | --- | --- | --- | --- | --- | --- |
| Crabgrass Creeper | basic | 55 | 9 to 11 | 12 | 28 | "It was here before the house." |
| Dandelion Puff | evasive | 35 | 8 to 10 | 30 | 30 | High dodge. Annoying on purpose. |
| Lawn Grub | tank | 80 | 10 to 12 | 8 | 34 | Drops Leftover Pizza. |
| Fire Ant Mound | hitter | 60 | 12 to 15 | 18 | 38 | Depth 2+. |
| Rogue Sprinkler Head | hitter | 70 | 13 to 15 | 16 | 40 | Depth 2+. "Waters you at 5 AM." |
| Vole Lieutenant | deep zone | 110 | 14 to 17 | 22 | 55 | Depth 3 only. |
| Lucky Clover | rare | 12 | 3 | 45 | 150 | Golden Roll role. Runs. |

### Boss: the Mole King

- Stats guess: HP 220, listed dmg 16 to 21, agility 26, XP 300, cash 150.
- **Gimmick: he burrows.** In the boss text he "sinks into the soil". Data version: high agility (strong defense) and a high dodge chance.
- **Main path hard gate:** Dad must plug the 4 tunnel exits on the surface (like the breaker in quest 1). If an exit is open, the boss event says he escapes and the fight does not start.
- **Soft gate (side quest item): Castor Oil Pellets.** Real mole repellent. Modifier: `defenseScale 0.6`, `attackScale 0.8`, dodge down. Text: "The Mole King smells the castor oil. His whiskers droop."

### Side quest: Mrs. Okafor's cat

The neighbor across the fence, Mrs. Okafor, lost her cat Biscuit in the tunnels. Biscuit is at depth 2, behind a flooded pipe. Dad brings the cat back. Mrs. Okafor gives the Castor Oil Pellets. "My late husband swore by these. He also swore at the moles."

### New gear and items

- Weapon: **Flat-Edge Spade** (power 16, price 200, shed or Dome Hepot garden aisle).
- Armor: **Grass-Stained Sneakers** (defense 7, price 160). See caveat C1 about armor.
- Consumable: **Bug Spray** (repel: no random fights for N steps). Classic NES repel item. Needs code.
- Dad Skill: **Google It** at LV 9. Shows the enemy weakness line. Needs code (new skill kind) or make it a damage skill for now.

### Grind expectation

Arrive at LV 8. Grind depth 1 to LV 9 (about 12 fights). Depth 2 to LV 10 (about 15 fights). Boss is fair at LV 10 with the pellets and spade. Confidence: 0.6.

## 4. Quest 4: Clean the Gutters (detailed)

**Countdown:** 9 DAYS UNTIL ARRIVAL. **Band:** LV 10 to 13. **Boss:** The Downspout Hydra.

### Premise and hook

It rains. Water pours over the gutters onto the front step. The wife says, "Your mom is not walking through a waterfall to get in the house." Dad must go up on the roof. Dad does not like the roof. The Brain reminds him of every ladder video he ever watched.

Comedy hook: vertical fear. Each roof level has a "DAD'S BRAIN" line about his will. The ladder is the dungeon.

### Areas

1. **Front yard (overworld, small).** The ladder spot, the downspout, the mailbox.
2. **Dave's Garage (short dungeon, main path).** Dave next door borrowed Dad's extension ladder in 2019. Dad must get it back. Dave's garage is full of other things Dave borrowed. Easy enemies, story beat, introduces Dave.
3. **The Roof (tower dungeon, 3 levels).** First floor eaves, second floor gutters, the chimney peak (deep zone). Narrow paths, NES tower feel.
4. **The Downspout (boss room).** At the bottom corner of the roof.

### Monster roster (first-pass ranges)

| Enemy | Role | XP | Note |
| --- | --- | --- | --- |
| Gutter Slime | basic | 42 | Emotional meaning: procrastination. From the foundation doc. |
| Maple Helicopter Swarm | evasive | 45 | Spins. High agility. |
| Soggy Tennis Ball | tank | 48 | "It has been up here since the kid was 6." |
| Paper Wasp | hitter | 55 | Eaves only. |
| Pigeon of Judgment | hitter | 55 | Looks at Dad. Says nothing. |
| Shingle Golem | deep zone | 80 | Chimney peak only. |
| Lost Frisbee | rare | 220 | Golden Roll role. |

Stats band: HP 70 to 140, listed dmg 13 to 20, agility 14 to 30.

### Boss: The Downspout Hydra

- A mass of wet leaves with three heads. HP guess 330, listed dmg 20 to 26.
- **Gimmick: three heads, three attack types.** Data version: an `attackPattern` with three named heads ("The Left Head sloshes", "The Middle Head clogs", "The Right Head drips menacingly").
- **Soft gate: the Gutter Scoop.** Already used as the example in `docs/engine.md`. Modifier: `defenseScale 0.5`, `heroDamageScale 1.5`, `attackScale 0.8`.
- Code wish (optional): a 2-phase fight. When HP is under 50%, a head grows back and the pattern changes. Needs code.

### Side quest: Dave's drone

Dave's teenage son flew a drone onto the roof. It is on the chimney peak (deep zone). Dad brings it down. Dave gives the Gutter Scoop. "Keep it. And the ladder. I think the ladder was yours anyway." It was.

### New gear and items

- Weapon: **Leaf Blower** (power 21, price 340). From the foundation doc list.
- Armor: **Good Hoodie** (defense 9, price 280).
- Key item: **Extension Ladder** (main path gate to the roof).
- Dad Skill: **Duct Tape Solution** at LV 11. Big heal that scales with max HP. Needed, because Walk It Off (10 to 16 HP) is too weak at LV 10+ (94+ max HP).

### Grind expectation

Arrive at LV 10. The eaves get Dad to LV 11. The gutters get Dad to LV 12. The chimney peak is for the side quest and for players who want to over-level. Boss is fair at LV 12 with the scoop. Confidence: 0.55.

## 5. Quest 5: Bring Back Hot Water (detailed)

**Countdown:** 8 DAYS UNTIL ARRIVAL. **Band:** LV 12 to 15. **Boss:** The Tank.

### Premise and hook

The wife gets a cold shower. She does not scream. She comes downstairs with wet hair and says only, "The water heater." That is worse than a scream. A plumber can come in 3 weeks for $1,400. Dad says the five words: "I can do it myself."

Comedy hook: Dad must read the manual. Dad has never read a manual. The side quest is the manual. The Brain treats the manual like an ancient text.

### Areas

1. **Basement (revisit).** The old basement, but now its enemies are weak at this level. NES-style backtrack. A locked door opens to a new section.
2. **The Mechanical Room (dungeon, dark).** Pipes, ducts, the furnace and the water heater. **Dark maze.** Without the Headlamp, Dad sees only 1 tile around him. Needs code (vision radius). This is the NES torch feel.
3. **The Crawlspace Archive (side quest area).** Boxes of the last owner's stuff. Every manual for every appliance the house ever had.

### Monster roster (first-pass ranges)

| Enemy | Role | XP | Note |
| --- | --- | --- | --- |
| Rust Flake | basic | 55 | Many of them. |
| Sediment Golem | tank | 65 | "Made of 11 years of minerals." |
| Pilot Light Imp | evasive | 62 | Flickers. High agility. |
| Cold Shower Specter | hitter | 70 | "It feels like an unpaid bill." |
| Pressure Valve Wraith | hitter | 75 | Hisses. |
| Anode Rod Wyrm | deep zone | 105 | Mechanical room deep zone. |
| Warm Spot | rare | 300 | Golden Roll role. Every Midwestern basement has one. |

Stats band: HP 100 to 190, listed dmg 18 to 26, agility 18 to 34.

### Boss: The Tank

- The 40-gallon water heater. HP guess 450, listed dmg 24 to 30.
- **Gimmick: pressure builds.** Most turns are mid damage. Some turns it does a big "Relief Valve Blast" (40+). Data version: put 1 big attack in a pattern of 4 (random pick, so about 25% of turns). Code wish: a real counter where pressure goes up each turn and the blast hits on turn 5.
- **Hard gate: the Headlamp.** Without it Dad cannot find the tank in the dark. Sold at Dome Hepot or found in the basement.
- **Soft gate: the Owner's Manual.** Modifier: no Relief Valve Blast, `defenseScale 0.6`. Text: "Dad reads page 14. He turns the T&P valve. The Tank sighs like an old man sitting down."

### Side quest: the Owner's Manual

The manual is in the Crawlspace Archive, in a box marked "IMPORTANT DO NOT THROW OUT" in handwriting from 1994. The box room has an optional mini-boss: **The Box of Cords.** Dad finds the manual. The Brain says, "We have never done this before. We are doing it now."

### New gear and items

- Weapon: **Pipe Wrench** (power 27, price 560). Big brother of the Adjustable Wrench.
- Armor: **Reading Glasses of Precision** (defense 11, price 480). From the foundation doc list. Funny that glasses are armor.
- Key items: **Headlamp**, **Owner's Manual**.
- Dad Skill: **Call Dave** at LV 13. Strong damage skill. Dave shows up, says one sentence, and hits the enemy with something he borrowed.

### Grind expectation

Arrive at LV 12. Revisit basement as a fast walk. Mechanical room to LV 13 and 14 (about 35 to 40 fights). Boss is fair at LV 14 with the manual. This is the first quest where the grind should feel long. Confidence: 0.55.

## 6. Quests 6 to 10 (sketches)

### Quest 6: Restore the WiFi (7 days, band 14 to 16)

- Premise: the WiFi goes down. The teen has not left their room. The in-laws want to video call the cousins.
- Dungeon: the teen's room. Laundry hills, a desk of cables, a closet that is a portal.
- Enemies: Tangled Cable, Dirty Sock Pile, Energy Drink Can Stack, Buffering Wheel, Notification Swarm.
- Boss: **WiFi Phantom** (from the foundation doc). Gimmick: it "lags". Data version: very high dodge. Code wish: it skips turns, then hits twice.
- Side quest: earn the teen's trust. Bring them food from the kitchen and do not ask questions. The teen gives the **Admin Password** (a sticky note). Hard gate: Dad cannot reboot the router without it. Soft gate: **Ethernet Cable** (lowers dodge).
- Key beat: the teen helps for one moment and then goes back to being a teen. Keep this kind.

### Quest 7: Clear the Garage (6 days, band 15 to 17)

- Premise: the in-laws need a parking spot. The garage has not held a car since 2017.
- Dungeon: the garage again, now bigger and full of boxes. A maze that changes when Dad moves boxes (3 or 4 box-push puzzles, like the breaker).
- Enemies: Endless Storage Box (foundation doc), Paint Can Hoarde, Broken Exercise Bike, Holiday Decoration Bin, Rogue Shop Vac.
- Boss: **The Pile.** Everything Dad said "we might need someday" about.
- Side quest: hold a yard sale. Sell 3 items to neighbors. The kid gets the **Label Maker**. Soft gate: The Pile loses defense because "everything has a place now".
- Revisit beat: the Heating Coil's dryer is in the corner. It hums at Dad. Dad hums back.

### Quest 8: Answer the HOA (5 days, band 16 to 18)

- Premise: a violation letter. The mole holes (quest 3), the gutters (quest 4), the boxes on the driveway (quest 7). The HOA president has photos.
- Dungeon: the Community Clubhouse. Halls of bylaws, a pool with no swimmers, a meeting room that never ends.
- Enemies: Bylaw Clause, Sub-Committee, Passive-Aggressive Note, Lawn Gnome Enforcer, Reply-All Chain.
- Boss: **HOA Wraith** (foundation doc). Gimmick: it cites rules. Each rule is an attack name.
- Side quest: get signatures from every neighbor met so far (Mrs. Okafor, Dave, the Dome Hepot clerk, the teen). The **Petition** is the soft gate. This pays off the recurring cast.
- Caveat: the HOA president is a person. Keep the person human and the Wraith a monster made of rules, so the joke is the system, not the neighbor.

### Quest 9: Fix the Garbage Disposal (3 days, band 17 to 19)

- Premise: Thanksgiving prep. Dad puts potato peels down the disposal. It stops. It hums. The wife looks at Dad. Dad looks at the peels.
- Dungeon: the kitchen. Under the sink, the back of the fridge (expired condiments), the pantry.
- Enemies: Expired Mustard, Mystery Tupperware, Potato Peel Golem, Fruit Fly Cloud, Grease Trap Ooze.
- Boss: **The Grinder.** HP and damage are the highest so far.
- Side quest: find the tiny hex key that came with the disposal. It is in the junk drawer, which is its own small dungeon. Soft gate: the hex key frees the jam. In real life, this is how you fix a jammed disposal. The joke is that the final weapon against the strongest normal boss is a 1/4-inch Allen wrench.

### Quest 10: The Arrival (1 day, band 18 to 20)

- Premise: the in-laws' car is on the street. Dad has one hour. Everything he fixed tries to break again at the same time.
- Dungeon: the whole house as one big final dungeon. Each wing is a past area at high level, with remixed enemies. NES final castle feel.
- Mini-bosses: "relapse" versions of past bosses (Heating Coil, Toilet, Mole King and the others). Each is optional if the matching side quest was done.
- Final boss: **The White Glove.** Not the mother-in-law herself. It is her judgment, which Dad has carried for 20 years. It inspects each room.
- Gimmick: one modifier per earlier side quest item. Each item Dad kept lowers the boss's power. All items: fair fight at LV 19. Few items: very hard.
- Ending: the doorbell. The mother-in-law steps in, looks around and says one small kind thing. Credits.

## 7. Engine work this plan needs

I read the code to check what the data can do now. Items marked "needs code" are small, but they are code.

| Need | Quests | Data only? | Confidence |
| --- | --- | --- | --- |
| New field scene per area (map + exits). Each area has a scene `.ts` file now. | All | No, one scene file per area | 0.9 |
| First outdoor map (backyard, front yard) | 3, 4 | No, new scene, tileset exists | 0.8 |
| Hard gates and soft gates (modifiers) | All | Yes | 0.9 |
| New Dad Skill kinds (reveal weakness, scaled heal) | 3, 4 | No, `dadSkills.ts` knows only damage and heal | 0.9 |
| Heal skill that scales with max HP | 4 | No | 0.85 |
| Repel item (Bug Spray) | 3 | No | 0.85 |
| Dark map with vision radius (Headlamp) | 5 | No | 0.8 |
| Boss phases or turn counters (Hydra, Tank, Phantom) | 4, 5, 6 | No, attack pick is random | 0.9 |
| Status effects (sleep, stun) | Optional | No, there are none now | 0.9 |
| Level table past LV 20 | Only if we extend | Yes, `balance.json` | 0.9 |
| Box-push puzzle | 7 | No | 0.7 |
| Headless walkthrough tests for each new quest | All | No, `scripts/check-quests.ts` covers quests 1 and 2 | 0.85 |

Recommendation: build quest 3 with data-only gates first. Add phases and status effects only when a boss needs them.

## 8. Caveats

- **C1. Armor almost does nothing now.** In `rollEnemyDamage`, damage is the larger of the listed damage (plus or minus 1) and the stat formula. Armor only changes the stat formula. The listed damage is almost always larger, so armor rarely matters. I checked this in `src/game/dragonWarriorMath.ts`. Confidence: 0.9. Options: (a) let armor subtract from listed damage, or (b) do not use armor as a gate item. I recommend (a). It changes quest 1 and 2 balance, so we must run the sim again.
- **C2. Stat numbers are guesses.** Only the quest 3 table has per-enemy numbers. All of them need `npm run balance` before they are real. Confidence: 0.5.
- **C3. The level table ends at LV 20.** The final boss at LV 19 leaves 1 level of room. If you want a longer final grind, extend the table to LV 25.
- **C4. Grind time is a guess.** I did not time real fights. Fights per level are from the sim; the minutes per fight are an estimate.
- **C5. Art cost.** About 6 new enemies and 1 boss per quest. That is about 55 new battle images for quests 3 to 10. Tint reuse can cover the first pass, but bosses need real art.
- **C6. Item feeds which boss.** This plan has each side quest feed the boss of the same quest. A different reading of your goal is that a side quest feeds the next quest's boss. That makes more backtracking. Tell me which one you want.
