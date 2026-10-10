# Crown Run: design (v2.0, agent "crown")

A roguelite run in the spirit of Balatro and Slay the Spire, played on a full HoMM map. Each run is one map and one hero. Every week ends in a Trial battle, banners break the rules, and a shop runs between fights. Losing a Trial ends the run. What you earn (Glory, unlocks, the Collection) carries over to the next run.

The code lives in `realms/crown.js`, which holds the data and rules and is pure enough to test in node. The battle hooks are in `realms/battle.js` (the `mods` option of `createBattle`). The tests are in `realms/dev/crown_test.mjs`.

**The four pillars stay intact:**

| Pillar | How the run uses it |
|---|---|
| Exploration | Map chests become packs. Mines pay the gold that buys your army. Each Age opens a new region. |
| Tactical battles | Trials are normal hex battles. Banners and boss rules only change the numbers and rules inside them. |
| Town building | Your capital still builds one thing a day and recruits weekly growth. Some banners and vouchers feed on buildings. |
| Hero and army | Levels (pick 1 of 3 skills), army slot order (Vanguard, Shield Bearer), Seals on stacks. |

---

## 1. Run structure

**Ages and weeks.** A run is 8 Ages; the MVP plays 3. Each Age is one in-game week (days 1–7) on the same map.

**Region gates.** Age *k* opens region *k*: ring *k* around your capital, given by `regionOf(cell)` from the flat map. Until that exists, the fallback is grid distance from the capital, in bands 0–9, 10–17, 18–25 and so on.
- Cells beyond the current Age's region cannot be entered. Their border shows as a Crown Gate.
- Deeper regions hold more and richer objects (gems, artifacts, more chests) and stronger guards. The flat map's guard strength already scales with distance.

**Trials each week.** All three are mandatory. Each one fires at dusk, when the day ends, before the night.

| Day | Trial | Threat ×P | Crowns paid | Hero |
|---|---|---|---|---|
| End of day 3 | **Raid** | ×1.0 | 3 | none |
| End of day 5 | **Warlord** | ×1.5 | 4 | a Warlord hero (att/def = Age) |
| End of day 7 | **Crown Boss** | ×2.2 | 5 | Boss hero (att/def/pow = Age+1), plus the boss rule |

- **Who fights.** The Trial army attacks your run hero (hero #0) wherever he stands.
  - Win: casualties stick, XP is paid as usual, the payout screen shows, then the shop opens.
  - Lose, or the hero dies: the run is over.
- **The boss is shown ahead.** The Crown Boss of each Age is rolled at the start of that Age and shown from day 1 in the Trial warning: the HUD pill, plus a preview card with the rule.
- **Skipping (full game only).** A Raid or a Warlord can be skipped for a Tag, such as a free War Chest or −50% on the next voucher. A skipped Trial gives no shop.

**Threat power.** The target is `armyPower(army, hero)` from battle.js:

```
P(ante, blind, stake) = 1500 · 2.3^(ante−1) · BLIND[blind] · (1 + 0.08·(stake−1)) · (stake ≥ 3 ? 1.1^(ante−1) : 1)
BLIND = { raid: 1.0, warlord: 1.5, boss: 2.2 }
```

**Threat army generator.** `threatArmy(run, ante, blind)`, seeded from the run's seed:
- **Faction.** The Age's theme. MVP: Age 1 is neutral, Age 2 is the boss's faction, Age 3 is Necropolis.
- **Size and tiers.**
  - Stacks: raid 3, warlord 4, boss 5, then +1 for every 2 Ages after the first, up to 7.
  - Tier window: `maxTier = min(7, 2 + ante + (boss ? 1 : 0))`, `minTier = max(1, ante − 1)`.
- **Upgrades.** From Age 3 on, units are upgraded with a 25% chance per Age (100% at Age 6 and later).
- **Filling to P.** Each stack's share of P is weighted toward the higher tiers. Its count is `round(share · P / armyPower([[id,1]]) / heroMult)`, with a minimum of 1.

---

## 2. Bosses (12; MVP uses ★ 3)

The boss rule is a battle modifier that applies only to the Boss Trial. Rules hit **you** (side 0) unless they say otherwise.

| Boss | Faction | Rule |
|---|---|---|
| ★ **The Wall** | neutral (ogres, orcs) | Your ranged stacks cannot shoot (they walk and melee at half damage). |
| ★ **The Plague** | Inferno | Your first army stack starts the battle with 30% fewer creatures (lost for good). |
| ★ **The Lich Queen** | Necropolis | Enemy stacks drain life (heal 50% of the damage they deal and raise their dead). Beating her unlocks Necropolis. |
| The Silence | Dungeon | Your hero cannot cast spells. |
| The Chain | any | Your leftmost banner is disabled for this battle. |
| The Hunger | neutral (trolls) | Enemy stacks regenerate fully at the start of every round. |
| The Gale | Sylvan | Your fliers are grounded (walk instead of fly). |
| The Eclipse | Dungeon | Your hero's Attack and Defence count as 0. |
| The Stampede | Inferno | Enemy stacks +3 speed (they always act first). |
| The Iron Hide | Haven | Enemy stacks take −50% damage from your shots. |
| The Duel | any | You may only bring your 3 largest stacks (the rest sit out, unharmed). |
| **The Usurper** (Age 8) | the rival crown | Two random rules from the list above, both shown. |

---

## 3. Banners (40; MVP ★ 16)

**Slots.** The hero has **5 slots** for banners, Balatro-joker style.

**Order matters.**
- When one of your stacks strikes, the HoMM damage roll is the base.
- Banners then apply **left → right**:
  - `[+]` banners add flat damage per creature.
  - `[×]` banners multiply the running total.
  - `[rule]` banners change rules.
- So `[+]` banners belong to the left of `[×]` banners.
- Copy banners copy whatever sits at their position, so moving them changes what they copy.

**Rarity and price.**

| Rarity | Price | Frame | In shop / War Chest |
|---|---|---|---|
| Common | 4₵ | steel | 70% |
| Uncommon | 6₵ | green | 25% |
| Rare | 8–9₵ | purple | 5% |
| Legendary | 12₵ | gold | packs only, at 2% |

- **Selling** pays `floor(price/2)`.
- **Gilded edition** (1 in 15, +3₵): the banner's numbers ×1.5. A multiplier `×m` becomes `×(1 + (m−1)·1.5)`.

**Damage and armies**

| ★ | Banner | Rarity ₵ | Effect | Combo intent |
|---|---|---|---|---|
| ★ | War Drum | C 4 | `[+]` Your melee strikes +1 damage per creature. | Big tier-1 stacks; place left of × banners. |
| ★ | Pike Wall | C 4 | Your tier 1–2 stacks +4 Defence. | Haven pikemen tank; with Haven Oath. |
| ★ | Vanguard | C 5 | `[×]` The stack in army slot 1 deals ×1.5. | Army order: put your best stack first. |
| ★ | Executioner's Flag | R 8 | `[×]` ×2 damage against stacks below half their starting count. | Finish what ranged softened. |
| | Last Stand | U 6 | `[×]` While you have one stack left, it deals ×3. | Comeback; with Shield Bearer. |
| | Bloodlust | U 6 | Each enemy stack destroyed: your stacks +2 Attack (this battle). | Snowball; with Executioner. |
| | Iron Oath | U 6 | `[rule]` Your stacks retaliate twice per round. | Griffins retaliate 3×. |
| | Shield Bearer | C 4 | Your slot-1 stack takes −35% damage. | Order: tank first. |
| | Berserker Standard | R 9 | `[×]` Your stacks deal ×1.6 but take ×1.3. | Glass cannon. |
| | Riposte Pennant | C 5 | `[×]` Retaliation strikes ×1.5. | Iron Oath, Pike Wall. |

**Ranged**

| ★ | Banner | Rarity ₵ | Effect | Combo intent |
|---|---|---|---|---|
| ★ | Fletcher's Banner | C 5 | Ranged stacks +4 shots; `[+]` +2 damage per creature on shots. | Archers/marksmen. |
| ★ | Heavy Volley | U 7 | `[×]` Your shots ×1.5. | Right of Fletcher. |
| ★ | Sky Lances | R 8 | `[rule]` Your ranged stacks may shoot while enemies are adjacent. | Counters melee rush; anti-Wall partner. |
| | Echoing Volley | R 9 | Every shot also hits a second random enemy stack for 50%. | Heavy Volley stacks on both. |
| | Falconer | U 6 | `[×]` Shots ×2 against fliers. | Anti-dragon. |

**Fliers**

| ★ | Banner | Rarity ₵ | Effect | Combo intent |
|---|---|---|---|---|
| ★ | Gryphon Standard | U 6 | `[rule]` Your fliers attack without retaliation. | Griffins, angels, wights. |
| | Sky Lord | R 8 | Fliers +3 speed; `[×]` ×1.4 in round 1. | Alpha strike. |
| | Updraft | C 4 | `[rule]` Your tier 1–3 walkers fly. | Gryphon Standard on pikemen. |

**Necromancy**

| ★ | Banner | Rarity ₵ | Effect | Combo intent |
|---|---|---|---|---|
| ★ | Bone Tally | R 8 | After each won battle, raise skeletons equal to (10% + 5% per Trial won this run, max 40%) of the slain living enemies. Works for any faction. | Scaling army; War Drum on skeleton hordes. |
| | Lich Lantern | R 9 | Raised skeletons arrive as Skeleton Warriors; your undead heal their top creature each round. | Bone Tally. |
| | Grave Robber | U 6 | `[×]` Undead stacks ×(1 + 0.25 × enemy stacks destroyed this battle). | Necro snowball. |
| | Phylactery | L 12 | Your stacks cannot drop below 1 creature before round 3. | Last Stand insurance. |

**Economy**

| ★ | Banner | Rarity ₵ | Effect | Combo intent |
|---|---|---|---|---|
| ★ | Golden Purse | C 4 | +2₵ after each Trial won. | Interest engine. |
| ★ | Royal Treasury | U 6 | Interest cap +5₵. | Golden Purse; Merchant origin. |
| | Miser's Banner | U 6 | `[×]` ×(1 + 0.03 × Crowns held), max ×1.6. | Hoard instead of rerolling. |
| | Mine Charter | C 4 | Your mines produce +50%. | Exploration → gold → army. |
| | Bounty Board | C 5 | Each map monster beaten pays 1₵ (max 3 a day). | Clear the region. |

**Building**

| ★ | Banner | Rarity ₵ | Effect | Combo intent |
|---|---|---|---|---|
| ★ | Mason's Mark | U 6 | Buildings cost −25% gold. | Masonry Guild voucher. |
| | Foundry | U 6 | `[×]` +2% damage per building in your capital. | Town pillar → battle. |
| | Garrison Flag | C 4 | Recruiting costs −15%. | Overflowing Pens. |
| | Fortress Banner | R 8 | If your capital has a Fort: your stacks +3 Defence. | Pike Wall. |

**Scaling**

| ★ | Banner | Rarity ₵ | Effect | Combo intent |
|---|---|---|---|---|
| ★ | Trophy Pike | U 6 | `[×]` +3% damage per enemy stack destroyed since you bought it (counter on the card). | Buy early, keep. |
| | Veteran's Colours | R 8 | +1 Attack and +1 Defence to your stacks per Boss beaten while held. | Long runs. |
| | Rising Tide | U 6 | `[×]` ×(1 + 0.1 × round). | Defensive armies. |

**Copy and order**

| ★ | Banner | Rarity ₵ | Effect | Combo intent |
|---|---|---|---|---|
| ★ | Mirror Banner | R 9 | Copies the banner to its **right** (Blueprint). | Mirror + Heavy Volley = ×2.25. |
| ★ | Crown Herald | R 8 | `[×]` ×1.2 for each banner to its **left**. | Put it last. |
| | Echo Standard | R 9 | Copies your **leftmost** banner (Brainstorm). | Mirror chains. |

**Faction synergy** (the shop offers only unlocked factions)

| ★ | Banner | Rarity ₵ | Effect | Combo intent |
|---|---|---|---|---|
| ★ | Haven Oath | U 6 | Haven stacks +2 Att / +2 Def; `[×]` ×1.25 if every stack is Haven. | Pure Haven. |
| | Oath of Dust | U 6 | Undead stacks +2 Att / +2 Def; ×1.25 if all undead. | Necro. |
| | Oath of Leaves | U 6 | Sylvan stacks +2 Att; ranged Sylvan +2 shots. | Sylvan archers. |
| | Oath of Embers | U 6 | Inferno stacks +2 speed and +2 Attack. | Inferno rush. |
| | Oath of the Deep | U 6 | Dungeon stacks +2 Def; the first strike each round ×1.25. | Dungeon. |

**Legendary**

| ★ | Banner | Rarity ₵ | Effect | Combo intent |
|---|---|---|---|---|
| | Usurper's Crown | L 12 | `[rule]` The boss rule also applies to the enemy. | Wall vs. Wall. |

---

## 4. Vouchers (MVP ★ 6)

- **One per Age.** One voucher is offered in every shop of the Age until you buy it. It costs **10₵** and lasts for the rest of the run.
- **Tier II versions** (full game) unlock when you buy the first.

| ★ | Voucher | Effect |
|---|---|---|
| ★ | Masonry Guild | Your towns may build twice per day. |
| ★ | Standard Bearer | +1 banner slot. |
| ★ | Overflowing Pens | Weekly dwelling growth +50%. |
| ★ | Clearance | Shop prices −25% (rounded down, minimum 1₵). |
| ★ | Surplus | Rerolls cost 2₵ less. |
| ★ | Seed Money | Interest cap +5₵. |
| | War College | Level-ups offer 4 skills. |
| | Cartographer | +2 vision; gates of the next region are shown. |
| | Blacksmith | Unit upgrades in the shop −50%. |
| | Tithe | +1₵ per town you own at each Trial payout. |
| | Crystal Ball | Packs offer 4 choices. |
| | Recruiter | Map dwellings restock +50%. |

## 5. Packs

| Pack | Shop price | Offers (pick 1 of 3; skip = +1₵) |
|---|---|---|
| **War Chest** | 4₵ | 3 banners (rarity table above, Legendary 2%). |
| **Tome** | 3₵ | 3 spells. Pick = your hero learns it for good, ignoring the Mage Guild level. If he already knows it: +5 mana. |
| **Muster** | 4₵ | 3 creature stacks of the Age's tier window. A stack is worth ~12% of the next Trial's P. One in four comes with a Seal. |

- **On the map**, every Treasure Chest becomes a pack chest. The type comes from the object id: 35% War Chest, 25% Tome, 40% Muster.
- Deeper regions carry more chests.
- A chest's mesh is the same; the pick dialog shows the pack art with a card flip.

## 6. Seals (on a unit stack; one per stack, kept through merges)

| Seal | Effect |
|---|---|
| Gold Seal | +1₵ each time this stack destroys an enemy stack in a Trial. |
| Iron Seal | This stack takes −20% damage. |
| Swift Seal | +2 speed. |
| Red Seal | This stack retaliates twice. |
| Ward Seal | The boss rule ignores this stack. |

Seals come from Muster packs, and full-game shops also sell them as 3₵ "Rites". In the save, the stack carries its seal as the 3rd element of the army entry: `[id, n, seal]`.

## 7. Shop (after every Trial won)

**The payout comes first:**
- the Trial's base pay (Raid 3, Warlord 4, Boss 5)
- +1₵ per stack of yours that lost nothing, max 3 ("Unbroken")
- banner pay (such as Golden Purse)
- **interest: +1₵ per 5₵ held, cap 5₵** (Royal Treasury and Seed Money each add +5 to the cap)

**Stock:**
- **3 cards.** Each one is a banner (70%), a spell scroll (15%, 3₵) or a unit upgrade (15%, 5₵, which upgrades one of your stacks to its upgraded creature).
- **1 pack**, rotating War Chest, Tome and Muster.
- **The Age's voucher.**

**Rerolls** cost 5₵, +1₵ for every reroll in the same shop, and reset each shop. The stock is seeded from `(run seed, ante, blind, reroll#)`, so a saved and reloaded shop is identical.

**Banner bar.**
- Drag or tap to reorder.
- Tap a banner to select it, then tap a gap to move it there.
- The Sell button pays half the price.
- When all slots are full, buying asks you to sell first.

## 8. Origins (Balatro decks)

| Origin | Effect | Unlock |
|---|---|---|
| ★ Banneret | No changes. | start |
| ★ Merchant | Start with 8₵; interest cap +5. | start |
| ★ Warband | Starting army ×1.5; 4 banner slots. | start |
| ★ Pauper | Start with 0₵ and half the resources; 6 banner slots. | start |
| Scholar | Mage Guild I built, +2 spells, Wisdom I; army ×0.8. | win a run |
| Gravecaller | Necropolis only; starts with Bone Tally. | unlock Necropolis |
| Siegelord | Capital starts with a Fort; the first Raid is weaker (×0.8). | beat The Wall |

## 9. Stakes (each includes the ones before)

| # | Stake | Change |
|---|---|---|
| 1 | White | Base. |
| 2 | Red | The Raid pays no base Crowns. |
| 3 | Green | Threat grows ×1.1 more per Age. |
| 4 | Black | 30% of shop banners are *Tattered* (cannot be sold). |
| 5 | Blue | The Crown Boss arrives at the end of day 6. |
| 6 | Purple | Shop prices +1₵. |
| 7 | Orange | Interest cap −2₵. |
| 8 | Gold | Bosses have two rules. |

Winning on a stake unlocks the next stake for that faction. Every stake also raises P by 8%.

## 10. Meta progression

**The meta save.** It sits in its own store key, `realms.crown.meta`:

```
{ v, glory, runs, wins, best: { score, ante }, unlocks: { factions: ['haven'], origins: [...], stakes: { haven: 1 } }, collection: { banners: {id: timesBought}, seen: {id: 1}, bosses: {id: 1}, units: {id: 1} }, trophies: [], perks: { id: level } }
```

**Faction unlocks.** Every run starts as Haven until another faction is unlocked.

| Faction | How to unlock |
|---|---|
| Necropolis | Beat **The Lich Queen** (Age 3 boss). |
| Sylvan | Win a run (clear Age 3 in the MVP, Age 8 in the full game). |
| Inferno | Beat a Crown Boss in 3 rounds or fewer. |
| Dungeon | Hold 5 banners at once. |

**Collection.**
- An album of every banner, boss and unit.
- Undiscovered entries are dark silhouettes.
- An entry is discovered when it shows up in a shop or pack, or when you fight it.
- Owned banners show their times-bought count.

**Trophies:**
- First Blood: win a Trial.
- Crowned: win a run.
- Hoarder: hold 25₵.
- Full Banner: 5 banners at once.
- Bone Lord: raise 100 skeletons in one run.
- Untouchable: win a Trial with no losses.
- Big Hit: one strike of 1000+ damage.
- Collector: discover 30 entries.

**Permanent upgrades.** These are small and bought with Glory on the Collection screen:

| Upgrade | Effect | Cost |
|---|---|---|
| Quartermaster | +2₵ at run start | 30 Glory per level, 2 levels |
| Drillmaster | Starting army +10% | 40 per level, 2 levels |
| Haggler | First reroll of each shop free | 60 |
| Scout | +1 hero vision | 25 |

## 11. Scoring

```
score = Σ blinds won (Raid 100, Warlord 200, Boss 400) × ante
      + 5 × Crowns held + floor(final armyPower / 50)
      + (won ? 1000 : 0)
      then × (1 + 0.25·(stake−1))
glory = floor(score / 100) + 5 × bosses beaten + (won ? 20 : 0)
```

The run also tracks "best strike" (largest single hit, like Balatro's best hand), stacks destroyed, skeletons raised and rerolls. All of these show on the end screen.

## 12. End-of-run rewards screen

1. **Banner.** "Crowned!" or "The run ends at Age N · Boss".
2. **Score rows, one at a time.** Each row ticks up from 0, with a sound tick on each step:
   - Trials
   - Crowns
   - Army
   - Victory
   - Stake ×
3. **Totals.** The total, then a **Glory +N** tick into the meta total, with a "New best!" badge when it applies.
4. **New unlocks** as cards that flip over with a rarity glow, for example: Necropolis unlocked, new origin, new trophy.
5. **Stats strip:** best strike, stacks destroyed, skeletons raised, banners held. The final banner bar sits beneath it.
6. **Buttons:** New run · Collection · Title.

## 13. Balance levers (all live in `crown.js` → `TUNE`)

- **Threat curve** (tuned with `autoResolve` on both sides against a Haven army recruiting every week: then checked with the soak bot (Quick combat on every fight, so no tactics). The bot's armies bleed between Trials. At growth 2.5 it reached Age 3 three times out of four but fell to the Warlord or the Lich Queen. At growth 2.3 it cleared all 3 Ages. Hand-played battles lose far fewer troops): `TUNE.base` (1500), `TUNE.growth` (2.3/Age), the `BLIND` multipliers, and the stake steps.
- **Economy:**
  - the per-Trial pay
  - the Unbroken bonus cap
  - interest (1 per 5, cap 5)
  - reroll base and step (5 / +1)
  - prices per rarity
  - the Gilded chance
- **Pack odds** (rarity weights), the Muster stack value (12% of the next P), and the chest type split.
- **Region size** (distance bands) and when the gates open.
- **Banner numbers:** each banner's numbers are named constants in its definition, so a pass of tuning means editing just those.
- **Battle hooks.** These cost nothing in Free Play: `createBattle` without `mods` keeps the old code path.

## 14. MVP integration (as built)

**Files.**
- `crown.js`: the rules and data.
- `crown_ui.js`: the screens (DOM only; main.js passes in `icon`, `unitIcon` and `sfx`).
- `dev/crown-ui.html`: every screen against mock state, for quick UI work (`?s=shop|pack|muster|boss|intro|end|coll|origin|hud`).
- `dev/crown_test.mjs`: the node tests.

**main.js.** One block, "Crown Run (agent crown)", plus small marked hooks (`// crown:`):

| Hook | What it does |
|---|---|
| imports | `crown.js` and `crown_ui.js`. |
| `findPath` / `dijkstra` | `crownShut(v, hr)`. Your heroes stay in regions `< ante`; the rival crown stays in its homeland (the last band). |
| `splitMonster` | A Trial's ready-made threat army (`obj.army`). |
| `startBattle` | `mods: crownMods(...)`: banners, seals, the boss rule and the Warlord/Boss hero, for any battle of the run hero. |
| `finishBattle` | `crownAfter(B, ctx)`: run counters, Bone Tally, then for a Trial the payout, `advanceBlind` and the shop. A loss is the end screen. |
| `interact` (chest) | Opens a pack (type from `chestPack`). |
| `endTurn` | `crownDusk()`: a Trial due tonight shows its intro, is fought, and the shop's Next resumes `endTurn`. |
| `newDay` | Resets the per-day build counter (Masonry Guild). Weekly growth × Overflowing Pens. A new week calls `crownWeek()` (toast + boss preview). |
| `buildIn` | Masonry Guild (2 builds a day) and Mason's Mark (refunds the discount). |
| `levelUp` | 3 skill choices in a run. |
| `save` / `load` | `run` in the save (`G.run`). `newWorld` resets `G.run`. Resume re-marks `regionOf` (the gate walls are already in `ter`). |
| `updateHud` | `crownHud()` (banner bar + Trial pill). |
| `showMenu` | Closes any run screen. |
| `playEvent` | The `mod` event (Plague, Echoing Volley floaters). |

**Regions.**
- `markRegions({ from: capital, bands, wall: true, per: 2 })` from the flat agent.
- `bands = D × (0.3 … 0.8) × 0.95`, where D is the hex distance to the rival capital.
- There is one band per Age, and the last band is the rival's homeland.
- Gates are the gaps the wall leaves. MVP: there is no 3D gate model; the gate simply cannot be pathed through until its Age.

**Entry.** `window.CrownRun = { start, resume }`, which the freeplay agent's title button and Continue call. `window.__realms.crown` holds the test hooks.

## 15. Layout: landscape first (owner direction for v2.0)

Landscape is the primary target: 844×390, 915×412 and 1280×720. Portrait (412×860) must still work.

**Landscape layout:**
- **Banner bar.** A row of 5 slots plus the Crowns wallet, directly under the resource bar on the left. In landscape the minimap and the hero column take the right edge, so the bar stays clear of them.
- **Trial pill.** Next to the bar: the days left to the next Trial, plus a boss sigil. It pulses the day before a Trial and on the day itself. Tap it for the boss preview card.
- **Shop.** A full-screen overlay:
  - the payout tally as a strip on the left
  - a wide row of cards in the middle: 3 cards + pack + voucher
  - the banner bar along the bottom, with reorder and sell
  - Reroll and Continue on the right
- **Pack opening.** 3 cards side by side, centred. Each one flips face up in turn.
- **Boss preview and end-of-run.** A two-column card:
  - left: the crest and the score tally
  - right: the rule text or the unlock cards
- **Collection.** A tabbed grid (Banners / Bosses / Units) that fills the width, with 6–8 columns.

**Portrait fallback** (`@media (orientation: portrait)`):
- The banner bar drops under the resource bar.
- Shop cards wrap 3 + 2, the banner bar stays at the bottom, and the buttons stack.
- Pack cards stay 3 across at a smaller size.
- Two-column cards become a single column.
- The Collection uses 4 columns.
