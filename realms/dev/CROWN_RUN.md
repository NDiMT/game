# Crown Run: design (v2.0, agent "crown")

The Crown Run is a roguelite built only from Heroes mechanics. You lead one hero across one full map, and if he dies the run is over.

- The map is split into **regions** sealed by **Border Guards**.
- Each region's **Legendary Hero** guards the **Keymaster's Tent** that holds the key to the next region.
- Every week an **invasion** marches on your capital.
- Your hero grows through **artifacts in equipment slots** (with **artifact sets**), skills, spells and troops. He finds them at map sites that offer a choice.
- What carries over between runs is Glory, unlocks and the Collection.

**Where the code lives:**

| File | What it holds |
|---|---|
| `realms/crown.js` | Rules and data, pure and node-testable. |
| `realms/crown_ui.js` | The screens, DOM only. |
| `realms/battle.js` | The battle-modifier hooks (`createBattle({ mods })`). |
| `realms/dev/crown_test.mjs` | The node tests. |
| `realms/dev/crown-ui.html` | Every screen against mock state. |
| `realms/models_objects.js` | The map-site models (in the "crown agent" block). |
| `realms/main.js` | The run loop (the "Crown Run (agent crown)" block plus small hooks marked `// crown:`). |

**The four pillars:**

| Pillar | How the run uses it |
|---|---|
| Exploration | Sites with choices, artifact merchants, the Grail and Seer's Huts. Each new region is opened with its key. |
| Tactical battles | Legendary Heroes with special rules, invasions, and artifacts that change the rules. |
| Town building | Your capital still builds and recruits every day. An invasion that reaches your walls is fought there, and Fortress gear rewards walls. |
| Hero and army | Equipment slots and sets, 3-choice level-ups, Witch Huts and Scholars. |

No card-game mechanics remain: no jokers, shop rerolls, interest, vouchers, packs, blinds or antes, and no second currency. The only currencies are gold and resources.

---

## 1. Run structure

**One hero, one map, permadeath.** A Crown Run is a full Medium map with one rival crown in the far corner.

**Regions.**
- The map is banded into regions by walking distance from your capital: 3 regions in the MVP, up to 6 in the full design.
- Each band is ringed by a wall of mountains. The wall has one or two gaps, and a **Border Guard** stands in each gap.
- The last band is the rival crown's homeland, and its heroes stay there.
- The region map is saved with the run, because walking distances change once the walls stand.
- After placement, any treasure or wandering monster that walls a corridor off from a Legendary Hero or a Border Guard is cleared away, so every region can be finished.

**Keys.**
- Deep in each region stands a **Keymaster's Tent** in the region's colour.
- That region's **Legendary Hero** camps beside it. In HoMM terms the hero is the tent's guard, so you must defeat him first.
- Visiting the tent gives you the key, the Border Guards of that colour stand aside, and the next region opens.
- **The last region's tent holds the Crown.** Taking it wins the run.

**Invasions.**
- **Day 4 of every week:** an invasion appears at the open frontier, the farthest open cell from your capital. You see a telegraph: "Invasion from the east, 3 days away", a pulsing HUD warning, and the camera flies to it.
- **Each dawn:** it marches toward your capital, paced to arrive at the end of day 7 (day 6 at Knight difficulty).
- **If it steps next to your hero**, it attacks him in the field.
- **If it reaches your capital:**
  - your hero fights it if he is inside or beside the town;
  - otherwise the garrison fights alone, with the Fort's walls. The creatures still waiting in your dwellings take up arms beside it, and the survivors go back to the dwellings.
  - If the garrison loses, the capital falls and the run is over.
- **Winning an invasion battle** earns the **spoils of war**: choose 1 of 3 artifacts from its baggage train.
- **Invasion strength:** `P(w) = 1500 · 1.9^(w−1) · 1.45 · difficulty factor`. The army comes from the rival crown's faction, and a Marshal hero leads it.

**Legendary Hero strength.** `P(r) = 1500 · 2.3^(r−1) · 2.2 · difficulty factor`. The army is built from the hero's faction line-up, and the hero adds stats and spells.

**Pacing.** No timer forces you onward, but invasions grow 1.9× a week. Lingering in a safe region loses to the invasion curve, and pushing too early loses to the Legendary Hero.

## 2. Legendary Heroes (9; MVP ★ 3)

Each Legendary Hero has a specialty rule that bends the battle. It is shown on the region pill and when you meet the hero. At King difficulty they follow a second rule as well.

| ★ | Hero | Title | Rule |
|---|---|---|---|
| ★ | Gorrak the Wall | Ogre Warlord | Shieldwall: your shooters cannot shoot. |
| ★ | Malphas the Plaguebringer | Pit Lord of Inferno | Plague: your first stack starts the battle with 30% fewer creatures. |
| ★ | Vesperine, the Lich Queen | Necromancer of the Last Crown | Lifedrinker: her stacks heal half the damage they deal and raise their dead. Defeating her unlocks Necropolis. |
| | Sorceress Ilvane | Warlock of Dungeon | Silence: your hero cannot cast spells. |
| | Krug the Endless | Troll Chieftain | Regeneration: his stacks heal fully every round. |
| | Windcaller Aelis | Druid of Sylvan | Gale: your fliers are grounded. |
| | Shadowmother Zyra | Dungeon Overlord | Eclipse: your hero's Attack and Defence count as 0. |
| | Khazrak Hellrider | Demon Knight | Stampede: his stacks +3 speed. |
| | Sir Brannoc Ironhide | Fallen Paladin | Ironhide: his stacks take −50% damage from your shots. |

The MVP line-up is Gorrak (region 1), Malphas (region 2) and Vesperine (region 3). In the full game the line-up is rolled, with Vesperine always last.

## 3. Artifacts and equipment (48 artifacts, 5 sets)

**The paper doll.** There are 11 slots: head, neck, torso, weapon, shield, feet, 2 rings and 3 misc.
- Artifacts beyond the slots go into the **backpack**.
- Tap an artifact to see its effect. You can equip it, unequip it, or swap it with the one in the slot.
- In a run, the Hero button opens the paper doll, and "Skills & army" opens the classic hero sheet.

**Rarity and gold value.**

| Rarity | Value | Frame |
|---|---|---|
| Treasure | 600 | steel |
| Minor | 1,800 | green |
| Major | 4,500 | purple |
| Relic | 9,000 | gold, with a sheen |

Merchants sell at full value; the Black Market charges ×1.5. They buy from your backpack at half value.

**Order of effects.** Artifacts apply in slot order (head → misc), so flat bonuses come before multipliers.

| Group | Artifacts and effects |
|---|---|
| **Plain stats** | Centaur Axe +2 Att, Lion Shield +2 Def, Staff of Embers +2 Pow, Helm of Command +1/+1/+1, Cloak of Shadows +3 Def, Sword of Judgement +4 Att, Orb of Tempest +3 Pow, Four-leaf Clover +1 Luck, Badge of Valor +1 Morale, Ring of Vitality (+1 HP per creature), Boots of Speed (+1 speed), Pikeman's Pauldron (tier 1–2 +4 Def). |
| **Warlord's Regalia** (set) | War Drum (+1 damage per creature in melee), Vanguard Standard (first army slot ×1.5), Executioner's Axe (×2 against stacks below half). **Set bonus:** Bloodlust, +2 Attack to your stacks for each enemy stack destroyed. |
| **Sentinel's Armour** (set, Haven) | Sentinel's Helm (+1 Def, Haven +1 Att), Sentinel's Breastplate (−15% damage taken), Sentinel's Tower Shield (first slot −35% damage taken). **Set bonus:** Haven stacks +2/+2 and retaliate twice; ×1.25 damage if every stack is Haven. |
| **Sharpshooter's Kit** (set) | Quiver of Plenty (+4 shots, +2 damage per creature on shots), Sharpshooter's Bow (shots ×1.5), Elven Bowstring (shots ×2 against fliers). **Set bonus:** shoot even with an enemy adjacent, and every shot ricochets onto a second stack for 50%. |
| **Wings of the Griffin** (set) | Griffin-feather Cape (fliers +3 speed), Feathered Boots (fliers ×1.4 in round 1), Talon Ring (fliers +2 Att). **Set bonus:** fliers attack without retaliation; tier 1–3 walkers take wing. |
| **Cloak of the Undead King** (set) | Bone Cloak (raise 10% of the slain), Skull Helm (undead +2/+2), Vampire's Ring (undead heal their top creature every round). **Set bonus:** raise 25% (+5% per Legendary Hero defeated) as Skeleton Warriors; undead ×1.25. |
| **Singles** | Heart of the Last Stand (last stack ×3), Berserker's Helm (×1.6 dealt, ×1.3 taken), Riposte Bracer (retaliation ×1.5), Ring of the Iron Oath (retaliate twice), Necklace of Trophies (+3% per stack slain while worn, grows), Veteran's Medal (+1/+1 per Legendary Hero slain while worn), Hourglass of the Long Battle (×(1 + 0.1·round)), Bracers of the Sky Lances (shoot point-blank), Miser's Ring (+1% per 1,000 gold, max +40%). |
| **Relics** | Crown of Command (×1.05 per artifact worn), Phylactery (no stack drops below 1 creature before round 3), Usurper's Crown (a Legendary Hero's rule binds his own army too). |
| **Economy and building** | Endless Purse of Gold (+500 gold a day), Endless Cart of Ore (+1 wood and +1 ore a day), Mason's Hammer (buildings −25% gold), Builder's Circlet (+2% damage per building in your capital), Shield of the Fortress (+3 Def if your capital has a Fort). |
| **Faction relics** | Offered only once the faction is unlocked: Leaf of the World Tree (Sylvan), Brand of the Pit (Inferno), Eye of the Deep (Dungeon). |

## 4. Map sites (choices where natural)

| Site | What it offers |
|---|---|
| **Treasure Chest** (existing object) | Choose gold, experience or a Treasure/Minor artifact. |
| **Pandora's Box** (2 per region, guarded) | Choose 1 of 3 from gold, experience, an artifact (rarer in deeper regions), a creature stack, or a spell. |
| **Witch Hut** (1 per region) | Learn or raise 1 of 3 skills. |
| **Scholar** (1 per region) | One lesson: +2 to a primary stat, a skill, or a spell. |
| **Shrine** (existing object) | Learn 1 of 3 spells you don't know. |
| **Seer's Hut** (regions 1–2) | A resource quest (wood, ore or gems, plus gold) for a Major artifact, shown up front. |
| **Artifact Merchant** (region 1) | 4 artifacts, restocked weekly. Buys from your backpack. |
| **Black Market** (region 2, guarded) | 2 Major or Relic artifacts at ×1.5 price. |
| **Trading Post** (region 1) | Buy and sell wood, ore and gems for gold at fixed rates. |
| **Artifacts on the road** (existing object) | A random artifact, rarer in deeper regions. |
| **The Grail** (one per run, region 2, heavily guarded) | Raises the **Crown Forge** in your capital: creature growth +50%, two buildings a day, +1,000 gold a day. |
| **Keymaster's Tent / Border Guard** | See §1. |

Every offer is seeded by the site and the run, so reloading never changes it. The town's own Marketplace and Tavern work as in Free Play.

## 5. Hero backgrounds, difficulty, level-ups

**Backgrounds:**

| Background | Effect | Unlock |
|---|---|---|
| Knight-Errant | No changes. | start |
| Merchant Prince | +5,000 gold at the start; +250 gold a day. | start |
| Warlord | Army ×1.5, one Misc slot fewer. | start |
| Exile | Half resources, army ×0.8, starts with a Major artifact. | start |
| Scholar | Mage Guild I, +2 spells, Wisdom; army ×0.8. | win a run |
| Gravecaller | Necropolis; wears the Bone Cloak. | unlock Necropolis |
| Siegelord | Capital starts with a Fort. | defeat Gorrak |

**Difficulty tiers.** Each tier adds to the ones before, and every tier also adds +8% to threat strength.

| # | Tier | Change |
|---|---|---|
| 1 | Squire | Base. |
| 2 | Knight | Invasions arrive a day sooner. |
| 3 | Baron | Invasions grow ×1.1 more per week. |
| 4 | Count | Merchants +25%. |
| 5 | Duke | Legendary armies +20%. |
| 6 | Prince | Growth −25%. |
| 7 | King | Legendary Heroes follow two rules. |
| 8 | Emperor | Starting army halved. |

Winning on a tier unlocks the next one for that faction.

**Level-ups** offer 3 skills instead of 2.

## 6. Meta progression

**The meta save.** It sits in its own key, `realms.crown.meta`, at version 2:

```
{ v: 2, glory, runs, wins, best: { score, region }, unlocks: { factions: ['haven'], backgrounds, diffs: { haven: 1 } }, collection: { artifacts: {id: timesFound}, seen: {id: 1}, guardians: {id: 1}, units: {id: 1} }, trophies: [], perks: {} }
```

**Faction unlocks:**

| Faction | How to unlock |
|---|---|
| Haven | Available from the start. |
| Necropolis | Defeat Vesperine. |
| Sylvan | Win a run. |
| Inferno | Defeat a Legendary Hero in 3 rounds or fewer. |
| Dungeon | Complete an artifact set. |

**Collection.**
- Tabs: Artifacts (with the times-found count), Legends, Creatures.
- Undiscovered entries are silhouettes.
- An entry counts as discovered once it has been seen at a site, sold by a merchant, or fought.

**Trophies:**
- First Blood: repel an invasion.
- Crowned: win a run.
- Hoarder: hold 50,000 gold.
- Set Collector: complete an artifact set.
- Bone Lord: raise 100 in one run.
- Untouchable: repel an invasion with no losses.
- Big Hit: one strike of 1,000+ damage.
- Collector: discover 30 entries.

**Glory perks:**

| Perk | Effect | Cost |
|---|---|---|
| Quartermaster | +1,500 starting gold | 30 Glory per level, 2 levels |
| Drillmaster | Starting army +10% | 40 per level, 2 levels |
| Haggler | Merchants −10% | 60 |
| Heirloom | Start with a Treasure artifact | 50 |

## 7. Score and the end of the run

```
score = Σ Legendary Heroes defeated (600 × their number) + Σ invasions repelled (200 × week)
      + 300 × sets completed + gold / 100 + army power / 50 + (Crown taken ? 1500 : 0), then × (1 + 0.25·(difficulty−1))
glory = floor(score / 100) + 5 × Legendary Heroes defeated + (won ? 20 : 0)
```

**The end screen.** It shows, in order:
1. The crest: "Crowned!", or how the run ended ("Sir Aldric fell in battle", "Highcastle fell to the invasion").
2. The run stats: best strike, stacks slain, invasions, legends.
3. The score rows, each ticking up.
4. The difficulty multiplier.
5. The total, with a "New best!" badge when it applies.
6. The Glory tick.
7. The unlock cards flipping in (factions, backgrounds, difficulty tiers, trophies).
8. The buttons: New run · Collection · Title.

## 8. Balance levers (`crown.js` → `TUNE`)

**Threat curves:**
- `guardian` {base 1500, growth 2.3, mult 2.2}
- `invasion` {base 1500, growth 1.9, mult 1.45, warnDay 4, arriveDay 7}
- `diffStep` 0.08

**Economy:**
- artifact values per rarity
- the merchant/Black Market markups and the half-value buy price
- `TRADE` rates
- chest and Pandora amounts
- `rarityW`, and the region-scaled rarity used for road artifacts, spoils and Pandora's Boxes

**Map:**
- the number of regions
- the band fractions (`crownNew`: 0.3 … 0.8 of the distance to the rival capital)
- the number of sites per region and their guard strengths (`crownPlace`)

**Artifacts:** every artifact's numbers are literals in its definition.

**Free Play:** the battle hooks cost nothing there. `createBattle` without `mods` keeps the classic code path, and seeded battles replay identically to v1.10.

## 9. Free Play

Free Play is unchanged.
- The artifact slots and sets exist **only in the Crown Run**. Free Play heroes keep the classic list of stat artifacts (`hr.arts`).
- Adding slots and sets to Free Play would change its balance (stacked multipliers on AI heroes too), so it is left for a separate, tuned change.
- The new map sites are only placed in a run.

## 10. Layout: landscape first (v2.0)

Landscape is the primary target: 844×390, 915×412 and 1280×720. Portrait (412×860) must still work.

**HUD** (under the resource bar, left), three buttons:
- **Equipment:** worn and packed counts, with a gold glow when a set is complete.
- **Region:** region n/3, keys held, and whose key comes next. Tap it for that Legendary Hero's card.
- **Invasion warning:** only while an invasion marches. It pulses when one day is left. Tap it for the card and a camera fly-to.

**Paper doll.** The slots surround the hero portrait, with the primary stats including artifact bonuses. The side panel has the artifact details, set progress and the backpack.

**Site choices.** 3 cards that flip over one after another. Major and Relic cards shine.

**Merchants.** Buy and Sell tabs, with a wide row of priced cards.

**Notices** (Legendary Hero, invasion, key, quest, Grail, end of run). A two-column card: the crest on the left, the details and buttons on the right.

**Portrait fallback:**
- The HUD drops under the minimap.
- Two-column cards stack.
- The paper doll's side panel moves under the doll.
- Card rows wrap.

## 11. Main.js integration (as built)

**The block:** "Crown Run (agent crown)", inserted after `window.__realms`. Its functions:

| Function | What it does |
|---|---|
| `crownShut` | Gates pathing in `findPath` and `dijkstra`. |
| `crownHud` | Draws the HUD. |
| `crownDoll` | Opens the paper doll. |
| `crownMods` | Builds the battle mods. |
| `crownAfter` | Runs after every battle. |
| `crownInteract` | Handles all run sites, Legendary Heroes and invasions. |
| `crownDescribe` | Names a tapped site. |
| `crownDawn` | Daily income; invasion spawn, march and strike. |
| `crownInvaded` | Resolves an invasion that strikes (field or siege). |
| `crownEnd` | Ends the run. |
| `crownStart` / `crownNew` | Hero pick, then the world, regions, walls and gates. |
| `crownPlace` | Places the sites. |
| `crownResume` | Resumes a saved run. |
| `window.CrownRun` | `{ start, resume }`, used by the title and by Continue. |

**Hooks marked `// crown:`:**
- imports
- `findPath` / `dijkstra`
- `interact` (first thing after the hero check)
- `describe`
- `splitMonster` (ready-made armies)
- `startBattle` `mods`
- `finishBattle` → `crownAfter`
- `newDay` → `crownDawn`, plus the build counter and growth multiplier
- `buildIn` (Crown Forge: 2 a day; Mason's Hammer)
- `levelUp` (3 choices)
- `openHero` (paper doll; artifacts listed in the sheet)
- save/load `run`; `newWorld` resets it
- `updateHud`, `showMenu`
- the `mod` battle event

**Models.** The new site models live in `models_objects.js` (the "crown agent" block):
- `border1–6` and `keymaster1–6`, in the key colours
- `pandora`, `witchhut`, `scholar`, `seer`, `merchant`, `blackmarket`, `tradingpost`, `grail`
