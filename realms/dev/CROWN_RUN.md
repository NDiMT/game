# Crown Run: design (v2.0, agent "crown"; v2.8 content and pacing, agent "crown2")

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
| `realms/dev/crown_sim.mjs` | The meta-progression simulation (§6). |
| `realms/dev/NEW_CROWN_IDS.json` | Every artifact, set and Legendary Hero id, with the art briefs (for the icons agent). |
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
- **Winning an invasion battle** earns the **spoils of war**: choose 1 of 2 artifacts from its baggage train, or its war chest (1,000 + 500 × week gold).
- **Invasion strength:** `P(w) = 1500 · 1.9^(w−1) · 1.45 · difficulty factor`. The army comes from the rival crown's faction, and a Marshal hero leads it.

**Legendary Hero strength.** `P(r) = 1500 · 2.3^(r−1) · 2.2 · difficulty factor`. The army is built from the hero's faction line-up, and the hero adds stats and spells.

**Pacing.** No timer forces you onward, but invasions grow 1.9× a week. Lingering in a safe region loses to the invasion curve, and pushing too early loses to the Legendary Hero.

## 2. Legendary Heroes (24, of which 4 Mythic)

Each Legendary Hero has a specialty rule that bends the battle and leads a **themed army** (his own unit list, any factions). The rule is shown on the region pill and when you meet him. At King difficulty they also follow a second rule (drawn from the tier 1–2 rules).

**Drawing them (v2.8).** Every run draws its own line-up, seeded by the run:
- region *r* of *n* draws from tier ⌈3r/n⌉ (3 regions: region 1 → tier 1, region 2 → tier 2, region 3 → tier 3);
- no hero twice in a run, and no two of the same faction while the tier offers another (neutrals may repeat);
- **Mythic** heroes only guard the **last region**, and only from Count difficulty (tier 4) up: 30% of runs, 60% from Prince (tier 6). On the full 6-region map they may also appear (20%) in the two deepest regions at any difficulty. A Mythic army is one tier window higher and ×1.15 stronger; beating one scores ×1.5.
- `powMul` scales each army so heroes of a tier play about evenly (rules that are big buffs get less: Skrag ×0.75, Ashka ×0.75, Gorrak ×0.7; mild rules get more: Krug and Brannoc ×1.25). Tuned with a node duel sweep (a fixed Haven army vs every hero, 16 seeds).
- Mythic heroes (and Grumm, with his Cyclops) bring a **signature stack** (`lead`: a Green Dragon, a Devil, a Bone Dragon, two Champions) on top of their themed army; their armies come out at about 1.3–1.6× a normal region-3 hero.
- In 60 Squire runs the test sees 7 different region-1 heroes and 53 distinct line-ups.

| Tier | Hero | Faction | Rule | Army |
|---|---|---|---|---|
| 1 | Gorrak the Wall, Ogre Warlord | Neutral | Shieldwall: your shooters cannot shoot. | Goblin, Orc, Ogre, Troll |
| 1 | Sorceress Ilvane, Warlock of Dungeon | Dungeon | Silence: your hero cannot cast spells. | Troglodyte, Harpy, Beholder, Medusa |
| 1 | Windcaller Aelis, Druid of Sylvan | Sylvan | Gale: your fliers are grounded. | Centaur, Wood Elf, Pegasus, Dendroid |
| 1 | Skrag the Goblin King, Lord of the Warrens | Neutral | Swarm: his tier 1–2 stacks are half again as large. | Goblin, Wolf, Orc |
| 1 | Fenra Wolfmother, Huntress of the Wilds | Neutral | Pack Hunt: her stacks deal ×1.3 to a stack already struck this round. | Goblin, Wolf, Centaur, Wood Elf |
| 1 | Captain Odric Vale, Pikemaster of Haven | Haven | Phalanx: his stacks +4 Defence, and his first-slot stack takes −50% damage. | Pikeman, Halberdier, Archer, Swordsman |
| 1 | Mordecai Bonetide, Gravelord of Necropolis | Necropolis | Grave Chill: your stacks −1 speed and −1 Attack. | Skeleton, Zombie, Wight, Skeleton Warrior |
| 2 | Malphas the Plaguebringer, Pit Lord of Inferno | Inferno | Plague: your first stack starts the battle with 30% fewer creatures. | Familiar, Demon, Horned Demon, Efreet |
| 2 | Krug the Endless, Troll Chieftain | Neutral | Regeneration: his stacks heal fully every round. | Wolf, Orc, Ogre, Troll |
| 2 | Khazrak Hellrider, Demon Knight | Inferno | Stampede: his stacks +3 speed. | Hell Hound, Cerberus, Nightmare, Hell Charger |
| 2 | Sir Brannoc Ironhide, Fallen Paladin | Haven | Ironhide: his stacks take −50% damage from your shots. | Swordsman, Crusader, Monk, Cavalier |
| 2 | Ashka the Emberwitch, Pyromancer of Inferno | Inferno | Firestorm: at the start of rounds 2, 4 and 6, fire burns each of your stacks for 6% of its hit points. | Imp, Familiar, Succubus, Efreet |
| 2 | Lysara Thornqueen, Warden of the Briars | Sylvan | Entangling Roots: your walkers have speed 1 in rounds 1 and 2. | Centaur Captain, Wood Elf, Dendroid, Dendroid Soldier |
| 2 | Xyloth the Many-Eyed, Beholder Overseer | Dungeon | Petrifying Gaze: at the start of every round one of your stacks turns to stone and loses its turn. | Troglodyte, Beholder, Evil Eye, Medusa |
| 2 | Grumm One-Eye, Cyclops Warlord | Neutral | Boulders: his shooters throw twice per turn. | **Cyclops** + Goblin, Orc, Ogre |
| 3 | Vesperine, the Lich Queen, Necromancer of the Last Crown | Necropolis | Lifedrinker: her stacks heal half the damage they deal and raise their dead. | Wight, Vampire, Lich, Power Lich, Black Knight |
| 3 | Shadowmother Zyra, Dungeon Overlord | Dungeon | Eclipse: your hero's Attack and Defence count as 0. | Harpy Hag, Medusa Queen, Minotaur, Manticore, Black Dragon |
| 3 | Asterion the Labyrinth King, Minotaur Warlord | Dungeon | Bloodrage: his stacks gain +1 Attack every time they are struck (up to +10). | Troglodyte, Harpy, Minotaur, Minotaur King, Manticore |
| 3 | Ssylith Hydra-Mother, Mistress of the Mire | Neutral | Many Heads: her stacks retaliate twice, at ×1.5 damage. | Ogre, Troll, Cyclops, Hydra |
| 3 | Elder Thalion Stormcaller, Archdruid of Sylvan | Sylvan | Chain Lightning: at the start of every round lightning strikes your two largest stacks for 8% of their hit points. | Wood Elf, Grand Elf, Silver Pegasus, Unicorn, Green Dragon |
| **Mythic** | Vyrmathra the Dragonmother, Queen of All Dragons | Neutral | Dragonmother: her stacks are immune to your spells, and her tier 7 creatures +50% hit points. | **Green Dragon** + Harpy, Troll, Manticore, Scorpicore |
| **Mythic** | Baal'zareth the Unbound, Archdevil of the Pit | Inferno | Hellgate: at the start of every round his weakest stack is restored to full strength. | **Pit Lord** + Horned Demon, Efreet Sultan, Nightmare, Hell Charger |
| **Mythic** | Seraphine the Fallen, Archangel Unbound | Haven | Divine Wrath: your hero cannot cast spells, and her stacks heal fully every round. | **Champion** + Crusader, Monk, Zealot, Angel |
| **Mythic** | Morvane the Dread King, Lord of the Endless Night | Necropolis | Dread: from round 2, your stacks lose 8% of their creatures at the start of every round. | **Bone Dragon** + Wraith, Vampire Lord, Power Lich, Dread Knight |

The portrait briefs (`look`) are in `crown.js` and `dev/NEW_CROWN_IDS.json`.

## 3. Artifacts and equipment (111 artifacts, 10 sets)

**The paper doll.** There are 11 slots: head, neck, torso, weapon, shield, feet, 2 rings and 3 misc.
- Artifacts beyond the slots go into the **backpack**.
- Tap an artifact to see its effect. You can equip it, unequip it, or swap it with the one in the slot.
- In a run, the Hero button opens the paper doll, and "Skills & army" opens the classic hero sheet.

**Rarity and gold value.**

| Rarity | Value | Frame |
|---|---|---|
| Treasure | 800 | steel |
| Minor | 2,400 | green |
| Major | 6,000 | purple |
| Relic | 12,000 | gold, with a sheen |

Merchants sell at full value; the Black Market charges ×1.6. They buy from your backpack at half value (75% with Merchant's Scales).

**Order of effects.** Artifacts apply in slot order (head → misc), so flat bonuses come before multipliers.

**Build archetypes.** The pool is built so a run commits to a plan: melee (War Drum, Twin Axes, Hellforged Arms), shooters (Sharpshooter's Kit, Eagle-eye Lens, Spyglass), fliers (Wings of the Griffin, Phoenix Feather, Angel Feather Wings), swarm (Militia Horn, Banner of the Horde, Leather Jerkin), big creatures (Titan's Panoply, Giant-slayer Blade), spells (Archmage's Regalia, Grimoire of Ruin, Staff of Storms), undead (Cloak of the Undead King, Soulbinder Amulet, Black Grimoire), defence and retaliation (Sentinel's Armour, Spiked Shield, Aegis of the Bastion), tempo (Nightstalker's Garb, Shadowstep Boots, Horn of the Second Wind), economy (Gilded Trappings, Cornucopia, Bandit's Mask), and growing pieces (Necklace of Trophies, Veteran's Medal, Ring of Bloodlust). Some are trade-offs: Crown of Thorns, Berserker's Helm, Boots of the Vanguard, Banner of the Horde, Orb of Inhibition (no spells for anyone).

**Artifacts outside sets:**

| Rarity | Count | Artifacts (slot) |
|---|---|---|
| Treasure | 19 | Centaur Axe (weapon), Lion Shield (shield), Four-leaf Clover (misc), Badge of Valor (misc), Ring of Vitality (ring), Pikeman's Pauldron (torso), Riposte Bracer (misc), Endless Cart of Ore (misc), Mason's Hammer (weapon), Iron Cap (head), Bronze Buckler (shield), Traveller's Boots (feet), Militia Horn (misc), Leather Jerkin (torso), Hunter's Knife (weapon), Ward Amulet (neck), Scout's Spyglass (misc), Woodcutter's Charm (misc), Copper Band (ring) |
| Minor | 27 | Staff of Embers (weapon), Helm of Command (head), Cloak of Shadows (neck), Orb of Tempest (misc), Boots of Speed (feet), Ring of the Iron Oath (ring), Necklace of Trophies (neck), Hourglass of the Long Battle (misc), Miser's Ring (ring), Endless Purse of Gold (misc), Builder's Circlet (head), Spiked Shield (shield), Circlet of the Adept (head), Ring of Swiftness (ring), Phoenix Feather (misc), Bandit's Mask (head), Tower Shield (shield), Horn of the Charge (misc), Chainmail of the Legion (torso), Ring of Blood (ring), Amulet of the Sun (neck), Trollskin Cloak (neck), Duellist's Bracer (misc), Eagle-eye Lens (misc), Battle Standard (misc), Merchant's Scales (misc), Prospector's Ring (ring) |
| Major | 25 | Sword of Judgement (weapon), Heart of the Last Stand (neck), Berserker's Helm (head), Veteran's Medal (misc), Bracers of the Sky Lances (misc), Shield of the Fortress (shield), Leaf of the World Tree (misc, Sylvan), Brand of the Pit (misc, Inferno), Eye of the Deep (misc, Dungeon), Seal of the Lightbringer (misc, Haven), Black Grimoire (misc, Necropolis), Dragonscale Armour (torso), Giant-slayer Blade (weapon), Banner of the Horde (misc), Crown of Thorns (head), Mirror Shield (shield), Horn of the Second Wind (misc), Boots of the Vanguard (feet), Grimoire of Ruin (misc), Staff of Storms (weapon), Soulbinder Amulet (neck), Ring of Conquest (ring), Twin Axes of Gorr (weapon), Aegis of the Bastion (shield), Ring of Bloodlust (ring) |
| Relic | 10 | Crown of Command (head), Phylactery (neck), Usurper's Crown (head), Sword of the Dawn (weapon), Armour of the Damned (torso), Angel Feather Wings (neck), Orb of Inhibition (misc), Ring of Life Eternal (ring), Cornucopia (misc), Helm of Heavenly Light (head) |

| Set | Pieces | Set bonus |
|---|---|---|
| Warlord's Regalia | War Drum (minor, misc: +1 damage per creature on your melee strikes.); Vanguard Standard (minor, misc: The stack in your first army slot deals ×1.5 damage.); Executioner's Axe (major, weapon: ×2 damage against stacks below half their starting size.) | Bloodlust: each enemy stack destroyed gives your stacks +2 Attack for the battle. |
| Sentinel's Armour | Sentinel's Helm (minor, head: +1 Defence. Haven stacks +1 Attack.); Sentinel's Breastplate (major, torso: Your stacks take −15% damage.); Sentinel's Tower Shield (minor, shield: Your first-slot stack takes −35% damage.) | Haven stacks +2 Attack and Defence and retaliate twice; ×1.25 damage if every stack is Haven. |
| Sharpshooter's Kit | Quiver of Plenty (minor, misc: Your shooters +4 shots and +2 damage per creature on shots.); Sharpshooter's Bow (major, weapon: Your shots deal ×1.5 damage.); Elven Bowstring (minor, misc: Your shots deal ×2 to fliers.) | Your shooters may shoot with an enemy next to them, and every shot also hits a second enemy stack for 50%. |
| Wings of the Griffin | Griffin-feather Cape (minor, neck: Your fliers +3 speed.); Feathered Boots (minor, feet: Your fliers deal ×1.4 damage in round 1.); Talon Ring (treasure, ring: Your fliers +2 Attack.) | Your fliers attack without retaliation, and your tier 1–3 walkers take wing. |
| Cloak of the Undead King | Bone Cloak (minor, neck: After each battle won, raise 10% of the slain living foes as skeletons.); Skull Helm (minor, head: Your undead +2 Attack and Defence.); Vampire's Ring (major, ring: Your undead heal their top creature every round.) | Raise 25% of the slain (+5% per Legendary Hero defeated) as Skeleton Warriors; your undead deal ×1.25. |
| Archmage's Regalia | Archmage's Hat (minor, head: +2 Power. Your spells deal ×1.1.); Robe of the Magi (major, torso: +1 Defence. Your spells deal ×1.3.); Wand of Storms (minor, weapon: +1 Power. Magic Arrow and Lightning Bolt deal ×1.5.) | Your spells deal ×1.5, and your hero starts every battle with +15 mana. |
| Hellforged Arms | Hellfire Blade (major, weapon: Your melee strikes deal ×1.2; ×1.5 against Haven and Sylvan stacks.); Brimstone Plate (minor, torso: Your stacks take −15% damage in melee.); Cinder Boots (minor, feet: Your stacks +1 speed; Inferno stacks +2 instead.) | Hellfire: at the start of every round, every enemy stack burns for 4% of its hit points. |
| Titan's Panoply | Titan's Helm (minor, head: Your tier 5–7 stacks +3 Defence.); Titan's Cuirass (major, torso: Your tier 5–7 creatures +20% hit points.); Titan's Gauntlet (major, misc: Your tier 6–7 stacks +4 Attack.) | Colossus: your tier 5–7 stacks deal ×1.3 and retaliate twice. |
| Gilded Trappings | Ring of the Golden Coin (treasure, ring: +150 gold every day.); Golden Goose (minor, misc: +350 gold every day.); Gilded Ledger (minor, misc: Merchants charge 15% less.) | Midas: +1,000 gold every day, and your stacks deal +1% per 2,000 gold in your treasury (max +30%). |
| Nightstalker's Garb | Shadow Hood (minor, head: Your stacks +1 speed.); Venom Dagger (minor, weapon: Your melee strikes deal ×1.25 against stacks that have not acted yet this round.); Shadowstep Boots (major, feet: In round 1 your stacks deal ×1.3.) | Ambush: in round 1 your stacks +2 speed and their strikes cannot be retaliated. |

By slot: weapon 14, shield 8, head 15, neck 11, misc 35, ring 13, feet 6, torso 9. By rarity: treasure 21, minor 46, major 34, relic 10.

**Faction relics** are offered only once their faction is unlocked (or when you play it).

## 4. Map sites (choices where natural)

| Site | What it offers |
|---|---|
| **Treasure Chest** (existing object) | Choose gold or experience; a third card is a Treasure/Minor artifact only 35% of the time (else a bigger purse or lesson). |
| **Pandora's Box** (2 per region, guarded) | Choose 1 of 3, weighted gold 3 · experience 3 · creatures 2 · spell 2 · artifact 1 (an artifact shows in about a third of boxes, at the region's rarity). |
| **Witch Hut** (1 per region) | Learn or raise 1 of 3 skills. |
| **Scholar** (1 per region) | One lesson: +2 to a primary stat, a skill, or a spell. |
| **Shrine** (existing object) | Learn 1 of 3 spells you don't know. |
| **Seer's Hut** (regions 1–2) | A resource quest for an artifact shown up front: a Minor one in region 1 (10 wood/ore or 6 gems + 1,500 gold), a Major one deeper in (18 / 10 + 3,000 gold). |
| **Artifact Merchant** (region 1) | 3 artifacts (Treasure 50 · Minor 42 · Major 8), restocked weekly. Buys from your backpack. |
| **Black Market** (region 2, guarded) | 2 Major (75%) or Relic (25%) artifacts at ×1.6 price. |
| **Trading Post** (region 1) | Buy and sell wood, ore and gems for gold at fixed rates. |
| **Artifacts on the road** (existing object) | Fewer in a run: 65% of region 1's (45% elsewhere) become chests or gold piles; every one left is guarded. Rarity by region (`rarityFor`): region 1 is 62/30/6/1 (Treasure/Minor/Major/Relic), region 3 26/38/20/3. |
| **The Grail** (one per run, region 2, heavily guarded) | Raises the **Crown Forge** in your capital: creature growth +50%, two buildings a day, +1,000 gold a day. |
| **Keymaster's Tent / Border Guard** | See §1. |

Every offer is seeded by the site and the run, so reloading never changes it. The town's own Marketplace and Tavern work as in Free Play.

## 5. Hero backgrounds, difficulty, level-ups

**Backgrounds:**

| Background | Effect | Unlock (goal + Renown, see §6) |
|---|---|---|
| Knight-Errant | No changes. | start |
| Merchant Prince | +5,000 gold at the start; +250 gold a day. | end a run holding 8,000 gold · 40 |
| Warlord | Army ×1.5, one Misc slot fewer. | defeat 2 Legendary Heroes in one run · 210 |
| Gravecaller | Necropolis; wears the Bone Cloak. | play 3 runs as Necropolis · 440 |
| Siegelord | Capital starts with a Fort. | your walls hold an invasion without your hero · 600 |
| Exile | Half resources, army ×0.8, starts with a Major artifact. | complete an artifact set · 900 |
| Scholar | Mage Guild I, +2 spells, Wisdom; army ×0.8. | win a run · 1,000 |

**Difficulty tiers.** Each tier adds to the ones before, and every tier also adds +8% to threat strength.

| # | Tier | Change |
|---|---|---|
| 1 | Squire | Base. |
| 2 | Knight | Invasions arrive a day sooner. |
| 3 | Baron | Invasions grow ×1.1 more per week. |
| 4 | Count | Merchants +25%. Mythic Legendary Heroes may guard the last region. |
| 5 | Duke | Legendary armies +20%. |
| 6 | Prince | Growth −25%. |
| 7 | King | Legendary Heroes follow two rules. |
| 8 | Emperor | Starting army halved. |

A win on a tier opens the next one for that faction once your Renown is high enough (Knight 300, Baron 500, Count 750, Duke 1,000, Prince 1,300, King 1,650, Emperor 2,000). The tier comes on top of the run's one unlock (§6).

**Level-ups** offer 3 skills instead of 2.

## 6. Meta progression (v2.8: paced)

**The problem it fixes.** Up to v2.7 one won run unlocked nearly everything (Sylvan, Necropolis, Dungeon, Scholar, Gravecaller, the next tier) and its Glory bought every perk. Now unlocks take many runs.

**The rules:**
- **Renown** = all the Glory ever earned. Spending Glory on perks never lowers it. Every unlock needs a **goal** and enough **Renown**.
- **At most one new unlock per run.** After a win, the next difficulty tier of the faction you won with comes on top (so at most two). Everything else that is ready waits for the next run, lowest Renown first.
- Goals use lifetime counters (`meta.life`), so progress from lost runs counts.
- The hero picker shows Glory and Renown; the end screen shows the next two unlocks with their goal and Renown; the Collection's Glory tab lists everything still locked.

**The meta save** (`realms.crown.meta`, version 3):

```
{ v: 3, glory, runs, wins, best: { score, region },
  unlocks: { factions: ['haven'], backgrounds: ['knight'], diffs: { haven: 1 }, perks: ['quartermaster'] },
  life: { glory /* Renown */, guardians, invasions, sets, wallsHeld, bestRegion, bestGuardians, maxGold, wins, bestWinDiff, mythics, facRuns: {fac: n}, wonAt: {fac: tier} },
  collection: { artifacts, seen, guardians, units }, trophies: [], perks: {} }
```

**Unlocks, in Renown order** (`UNLOCKS` in crown.js):

| Renown | Unlock | Goal |
|---|---|---|
| 40 | Merchant Prince | End a run holding 8,000 gold. |
| 80 | Drillmaster perk | Repel 3 invasions (all runs). |
| 140 | **Necropolis** | Defeat 3 Legendary Heroes (all runs). |
| 210 | Warlord | Defeat 2 Legendary Heroes in one run. |
| 280 | Heirloom perk | Discover 40 artifacts. |
| 360 | **Sylvan** | Reach region 3. |
| 440 | Gravecaller | Play 3 runs as Necropolis. |
| 520 | Haggler perk | End a run holding 15,000 gold. |
| 600 | Siegelord | Your walls hold an invasion while your hero is away. |
| 700 | **Inferno** | Repel 15 invasions (all runs). |
| 800 | Tactician perk | Defeat 12 Legendary Heroes (all runs). |
| 900 | Exile | Complete an artifact set. |
| 1,000 | Scholar | Win a run. |
| 1,150 | **Dungeon** | Win 2 runs. |
| 1,300 | Lucky Star perk | Complete 3 artifact sets (all runs). |
| 1,450 | Architect perk | Win at Knight or higher. |
| 1,600 | Treasure Sense perk | Defeat a Mythic Legendary Hero. |
| 300 … 2,000 | Difficulty tiers 2–8, per faction | Win at the tier below with that faction. |

**Glory perks** (each level costs `cost × level`): Quartermaster (+1,000 starting gold, 40, 3 levels, from the start), Drillmaster (army +10%, 70, 2), Heirloom (a Treasure artifact, 120), Haggler (merchants −10%, 150), Tactician (hero +1 Att/Def, 180, 2), Lucky Star (+1 Luck, 220), Architect (buildings −10% gold, 250), Treasure Sense (Major/Relic ×1.3 likelier, 300).

**Glory per run** is unchanged: `floor(score / 100) + 5 × Legendary Heroes + (won ? 20 : 0)`. Typical: 1–8 for a region-1 loss, 15–40 for region 2, 45–90 for region 3, 110–160 for a win.

**Expected pacing** (`node realms/dev/crown_sim.mjs 400 30`). The model player beats region 1's hero about half the time at first, improving ~1.5% a run plus a little per perk; difficulty costs 6% a tier; each region brings 1–2 invasions. Over 400 players × 30 runs: 6.8 wins by run 30, mean Renown 1,429, 47% of runs unlock nothing, 18% unlock two (always a win's difficulty tier plus one).

Cumulative unlocks (mean): run 5 → 1.1, run 10 → 3.3, run 15 → 6.5, run 20 → 11.4, run 25 → 16.7, run 30 → 21.2. Factions land around runs 9 (Necropolis), 16 (Sylvan), 22 (Inferno) and 27 (Dungeon).

Typical player (median unlocks by run 30): 21 unlocks

| Run | Faction | Tier | Reached | Glory | Renown | Unlocked this run |
|---|---|---|---|---|---|---|
| 1 | haven | 1 | region 1 | 3 | 3 | – |
| 2 | haven | 1 | region 2 | 15 | 18 | – |
| 3 | haven | 1 | region 2 | 19 | 37 | – |
| 4 | haven | 1 | region 1 | 6 | 43 | Merchant Prince |
| 5 | haven | 1 | region 2 | 15 | 58 | – |
| 6 | haven | 1 | region 1 | 1 | 59 | – |
| 7 | haven | 1 | region 1 | 3 | 62 | – |
| 8 | haven | 1 | won | 124 | 186 | Drillmaster (Glory perk) |
| 9 | haven | 1 | region 3 | 52 | 238 | Necropolis |
| 10 | necro | 1 | won | 136 | 374 | Knight difficulty (Necropolis), Warlord |
| 11 | necro | 2 | region 1 | 4 | 378 | Heirloom (Glory perk) |
| 12 | haven | 1 | region 3 | 52 | 430 | Knight difficulty (Haven) |
| 13 | necro | 2 | region 2 | 23 | 453 | Sylvan |
| 14 | sylvan | 1 | won | 109 | 562 | Knight difficulty (Sylvan), Gravecaller |
| 15 | necro | 2 | region 1 | 4 | 566 | Haggler (Glory perk) |
| 16 | sylvan | 2 | won | 130 | 696 | Baron difficulty (Sylvan), Siegelord |
| 17 | sylvan | 3 | region 3 | 72 | 768 | Inferno |
| 18 | sylvan | 3 | won | 149 | 917 | Count difficulty (Sylvan), Tactician (Glory perk) |
| 19 | inferno | 1 | region 1 | 7 | 924 | Exile |
| 20 | inferno | 1 | region 1 | 3 | 927 | – |
| 21 | sylvan | 4 | region 3 | 86 | 1013 | Scholar |
| 22 | inferno | 1 | region 2 | 19 | 1032 | – |
| 23 | inferno | 1 | region 1 | 6 | 1038 | – |
| 24 | sylvan | 4 | region 2 | 40 | 1078 | – |
| 25 | inferno | 1 | won | 114 | 1192 | Knight difficulty (Inferno), Dungeon |
| 26 | dungeon | 1 | region 2 | 33 | 1225 | – |
| 27 | inferno | 2 | region 1 | 3 | 1228 | – |
| 28 | dungeon | 1 | region 2 | 25 | 1253 | – |
| 29 | dungeon | 1 | region 3 | 62 | 1315 | Lucky Star (Glory perk) |
| 30 | inferno | 2 | region 3 | 89 | 1404 | – |

When each unlock lands, over 400 players:

| Unlocked this run |
|---|---|---|---|---|---|---|
| 1 | haven | 1 | region 1 | 3 | 3 | – |
| 2 | haven | 1 | region 2 | 15 | 18 | – |
| 3 | haven | 1 | region 2 | 19 | 37 | – |
| 4 | haven | 1 | region 1 | 6 | 43 | Merchant Prince |
| 5 | haven | 1 | region 2 | 15 | 58 | – |
| 6 | haven | 1 | region 1 | 1 | 59 | – |
| 7 | haven | 1 | region 1 | 3 | 62 | – |
| 8 | haven | 1 | won | 124 | 186 | Drillmaster (Glory perk) |
| 9 | haven | 1 | region 3 | 52 | 238 | Necropolis |
| 10 | necro | 1 | won | 136 | 374 | Knight difficulty (Necropolis), Warlord |
| 11 | necro | 2 | region 1 | 4 | 378 | Heirloom (Glory perk) |
| 12 | haven | 1 | region 3 | 52 | 430 | Knight difficulty (Haven) |
| 13 | necro | 2 | region 2 | 23 | 453 | Sylvan |
| 14 | sylvan | 1 | won | 109 | 562 | Knight difficulty (Sylvan), Gravecaller |
| 15 | necro | 2 | region 1 | 4 | 566 | Haggler (Glory perk) |
| 16 | sylvan | 2 | won | 130 | 696 | Baron difficulty (Sylvan), Siegelord |
| 17 | sylvan | 3 | region 3 | 72 | 768 | Inferno |
| 18 | sylvan | 3 | won | 149 | 917 | Count difficulty (Sylvan), Tactician (Glory perk) |
| 19 | inferno | 1 | region 1 | 7 | 924 | Exile |
| 20 | inferno | 1 | region 1 | 3 | 927 | – |
| 21 | sylvan | 4 | region 3 | 86 | 1013 | Scholar |
| 22 | inferno | 1 | region 2 | 19 | 1032 | – |
| 23 | inferno | 1 | region 1 | 6 | 1038 | – |
| 24 | sylvan | 4 | region 2 | 40 | 1078 | – |
| 25 | inferno | 1 | won | 114 | 1192 | Knight difficulty (Inferno), Dungeon |
| 26 | dungeon | 1 | region 2 | 33 | 1225 | – |
| 27 | inferno | 2 | region 1 | 3 | 1228 | – |
| 28 | dungeon | 1 | region 2 | 25 | 1253 | – |
| 29 | dungeon | 1 | region 3 | 62 | 1315 | Lucky Star (Glory perk) |
| 30 | inferno | 2 | region 3 | 89 | 1404 | – |

Over 400 players × 30 runs: the run on which each unlock lands (median, 10th–90th percentile, share of players who got it)

| Unlock | Median run | 10–90% | Got it by run 30 |
|---|---|---|---|
| Merchant Prince | 4 | 2–7 | 100% |
| Drillmaster (Glory perk) | 7 | 4–10 | 100% |
| Necropolis | 9 | 6–13 | 100% |
| Warlord | 11 | 8–15 | 100% |
| Heirloom (Glory perk) | 14 | 10–17 | 100% |
| Knight difficulty (Haven) | 14 | 11–18 | 62% |
| Sylvan | 16 | 12–19 | 100% |
| Knight difficulty (Necropolis) | 16 | 11–21 | 88% |
| Gravecaller | 17 | 14–20 | 100% |
| Baron difficulty (Haven) | 17 | 12–22 | 2% |
| Haggler (Glory perk) | 19 | 15–22 | 100% |
| Knight difficulty (Sylvan) | 19 | 16–24 | 97% |
| Siegelord | 20 | 17–23 | 100% |
| Baron difficulty (Necropolis) | 20 | 16–24 | 35% |
| Inferno | 22 | 18–25 | 100% |
| Baron difficulty (Sylvan) | 23 | 19–27 | 75% |
| Tactician (Glory perk) | 23 | 20–26 | 99% |
| Exile | 24 | 21–28 | 91% |
| Count difficulty (Necropolis) | 24 | 18–24 | 3% |
| Count difficulty (Sylvan) | 24 | 21–30 | 26% |
| Duke difficulty (Sylvan) | 24 | 24–27 | 3% |
| Scholar | 25 | 22–28 | 96% |
| Knight difficulty (Inferno) | 25 | 20–28 | 95% |
| Baron difficulty (Inferno) | 26 | 23–30 | 69% |
| Dungeon | 27 | 24–29 | 88% |
| Count difficulty (Inferno) | 28 | 25–30 | 29% |
| Knight difficulty (Dungeon) | 28 | 25–29 | 51% |
| Lucky Star (Glory perk) | 28 | 25–30 | 32% |
| Baron difficulty (Dungeon) | 29 | 26–29 | 19% |
| Architect (Glory perk) | 29 | 26–30 | 44% |
| Count difficulty (Dungeon) | 29 | 28–29 | 5% |
| Treasure Sense (Glory perk) | 29 | 27–30 | 8% |
| Duke difficulty (Inferno) | 30 | 27–30 | 6% |
| Prince difficulty (Inferno) | 30 | 30–30 | 0% |

**Migrating v2 saves.** Nothing is re-locked: factions, backgrounds, difficulty tiers, perk levels and Glory are kept, and all four v2 perks stay on sale. The lifetime counters are rebuilt from what the v2 save holds (Renown = Glory + Glory spent on perks; Legendary Heroes from the Collection; wins; best region; sets, invasions and gold from trophies; `wonAt` from the tiers). New perks and anything still locked follow the new pacing.

**Collection.**
- Tabs: Artifacts (with the times-found count), Legends (tier or Mythic), Creatures, Glory (perks, trophies, and what is still locked).
- Undiscovered entries are silhouettes.
- An artifact counts as discovered once seen at a site, sold by a merchant, or worn; a Legendary Hero once defeated.

**Trophies:** First Blood (repel an invasion), Crowned (win), Hoarder (hold 50,000 gold), Set Collector (complete a set), Bone Lord (raise 100 in one run), Untouchable (an invasion with no losses), Big Hit (one strike of 1,000+), Collector (discover 30 entries), Mythslayer (defeat a Mythic hero), Legend Hunter (defeat 15 different Legendary Heroes). Trophies are not capped.

## 7. Score and the end of the run

```
score = Σ Legendary Heroes defeated (600 × their number, ×1.5 if Mythic) + Σ invasions repelled (200 × week)
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
7. The unlock cards flipping in (factions, backgrounds, perks, difficulty tiers, trophies), then the next two unlocks to chase.
8. The buttons: New run · Collection · Title.

## 8. Balance levers (`crown.js` → `TUNE`)

**Threat curves:**
- `guardian` {base 1500, growth 2.3, mult 2.2}
- `invasion` {base 1500, growth 1.9, mult 1.45, warnDay 4, arriveDay 7}
- `diffStep` 0.08

**Economy:**
- artifact values per rarity (`value`), `blackMul` and the half-value buy price
- `chest.artChance`, the Pandora weights (`pandora.w`), `rarityW`, `rarityFor` (region rarity), merchant stock size and weights
- `mythic` (min difficulty, chances, power)
- `unlocksPerRun`, the Renown of each `UNLOCKS` entry and `DIFF_RENOWN`
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
- the `mod` battle event (v2.8: no "-0" floater for damage-free effects such as Petrified or Hellgate)
- v2.8 (crown2) in the crown block: road artifacts use `CR.roadRarity`; `crownPlace` turns most wild artifacts into chests or gold and guards the rest; `crownAfter` pays `res.gold` (Bandit's Mask); a siege held without the hero counts `R.stats.wallsHeld`; merchants buy back via `CR.sellPrice(id, R)`

**Models.** The new site models live in `models_objects.js` (the "crown agent" block):
- `border1–6` and `keymaster1–6`, in the key colours
- `pandora`, `witchhut`, `scholar`, `seer`, `merchant`, `blackmarket`, `tradingpost`, `grail`
