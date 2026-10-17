# Crownforge: icon inventory (icons2, the epic set)

442 painted icons, made with PixelLab `generate-image-pixflux` (192×192, transparent). 565 generations in all for this set (samples and redos included).

## Art direction (locked)

- **Engine settings, every icon:** outline `selective outline`, shading `highly detailed shading`, detail `highly detailed`, text guidance 8 (10 for a few hard creatures), seed md5("e2:id:n").
- **Light:** dramatic cinematic lighting, a strong bright rim light, deep shadows, rich saturated jewel tones (in every prompt).
- **Camera per category:** units / heroes / Legendary Heroes = 3/4 heroic bust; items = 3/4 object view, floating; buildings, map objects and sites = isometric 3/4 diorama on a small patch of ground; skills = gold-rimmed medallions; crests and sets = heraldic shields, front view; spells = an energy burst.
- **Shared finish (post2.py, applied to every raw):** trim, square with a 7.5 % margin (portraits sit on the bottom edge), a unified 2 px ink outline (#100a08), a warm rim highlight on the upper-right edges, +12 % saturation and +8 % contrast, then a soft outer glow in the category colour.
- **Colour language (glow):** factions: Haven gold, Necropolis green, Sylvan leaf green, Inferno orange, Dungeon violet, neutral amber. Artifact rarity: Treasure silver, Minor green, Major violet, Relic gold. Spell schools: per spell (arrow and bolt blue, fireball orange, cure green, slow violet, bless gold…). Upgraded dwellings get a stronger gold glow. Mythic Legendary Heroes glow gold.
- **Units keep their identity:** the 3D model rendered raw (portraits.js `raw` shape), cropped to a bust, is both the forced palette (`color_image`) and the init image (strength 35). Upgrades add "grander, gilded armour, gold trim, glowing aura". Where pixflux lost the creature (centaur, cyclops, cerberus, hydra…) the init was dropped or the old art was used as init; see the table.
- **Upgraded dwellings:** init = the new base dwelling at strength 60, prompt "much taller, golden spires, gilded roofs…".

**Shipping:** `dev/icon_masters/<id>.png` (192 px master) and `art/icons/<id>.webp` (144 px, q68, alpha q60). `icons.js` holds the single `ART` table (kind → game id → file). Coverage: `node realms/dev/icon_coverage.mjs` (also reads `dev/NEW_CROWN_IDS.json`).

**Pipeline (scratchpad `icons2/`):** `inv3.py` builds the inventory (reads crown.js for every artifact / Legendary Hero / set / background; `overrides.json` holds tuned prompts) → `gen_all.py` / `pl2.py` generate into `raw/<id>_v<n>.png` (ledger.jsonl) → `finalize2.py` (+ `post2.py`) → `table2.py --apply` rewrites the ART block. `picks.json` pins a version.

**Not replaced (by design):** the SVG glyphs `close`, `check`, `more`, `info`, `menu`; the `logo` emblem.

## Units (all factions, upgrades, neutrals) (77)

| id | serves | prompt (subject; the category suffix is added) | gens | pick | init |
|---|---|---|---|---|---|
| `unit_pikeman` | `pikeman` | a battle-hardened young pikeman with a brown moustache, steel kettle helmet, blue tabard with a red sash, gripping a long steel-tipped pike, facing the viewer | 8 | v6 | pikeman.png @35 |
| `unit_archer` | `archer` | a keen-eyed young archer in a green hood and leather jerkin, drawing a longbow with an arrow nocked, facing the viewer | 1 | v0 | archer.png @35 |
| `unit_griffin` | `griffin` | a proud griffin with a fierce golden eagle head, white feathered neck, tawny lion body and great brown wings spread | 1 | v0 | griffin.png @35 |
| `unit_swordsman` | `swordsman` | a stern knight swordsman in polished silver plate armour, a blue heater shield with a golden cross, raising a broadsword, facing the viewer | 1 | v0 | swordsman.png @35 |
| `unit_monk` | `monk` | a serene battle monk with a shaved head, brown and orange robes, holding a staff crowned with radiant holy light, facing the viewer | 1 | v0 | monk.png @35 |
| `unit_cavalier` | `cavalier` | a mounted cavalier knight in silver plate on a white barded warhorse with a blue caparison, lance raised | 1 | v0 | cavalier.png @35 |
| `unit_angel` | `angel` | a radiant angel warrior with great white feathered wings, golden armour and a flaming sword, halo of light, facing the viewer | 1 | v0 | angel.png @35 |
| `unit_halberdier` | `halberdier` | an elite halberdier guard captain, young and fierce, in gilded white steel plate with a sun emblem, blue tabard, plumed great helm, gripping a gleaming halberd, facing the viewer | 8 | v6 | halberdier.png @35 |
| `unit_marksman` | `marksman` | an elite marksman in a red feathered cap and green hood, aiming a heavy steel crossbow, gold trimmed tunic, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | marksman.png @35 |
| `unit_royalgriffin` | `royalgriffin` | a royal griffin with a golden eagle head, flowing white mane, shining golden wings and a gold crest, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | royalgriffin.png @35 |
| `unit_crusader` | `crusader` | a crusader knight in white and gold plate armour with a red cross tabard, wielding two swords, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | crusader.png @35 |
| `unit_zealot` | `zealot` | a zealot high priest in white and gold vestments with a mitre, holding a blazing holy sceptre, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | zealot.png @35 |
| `unit_champion` | `champion` | a champion knight in golden plate on an armoured white warhorse with blue and gold caparison, long lance, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | champion.png @35 |
| `unit_archangel` | `archangel` | an archangel with vast white wings, shining golden armour, a holy greatsword and a blazing halo, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | archangel.png @35 |
| `unit_skeleton` | `skeleton` | a grinning skeleton warrior with glowing eye sockets, rusty sword and a cracked round shield | 1 | v0 | skeleton.png @35 |
| `unit_zombie` | `zombie` | a shambling rotting zombie with sickly green skin in torn rags, reaching forward | 1 | v0 | zombie.png @35 |
| `unit_wight` | `wight` | a floating hooded wight spectre with glowing eyes, pale blue mist trailing, clawed hands | 1 | v0 | wight.png @35 |
| `unit_vampire` | `vampire` | a pale aristocratic vampire with fangs in a black and crimson high-collared cloak, red eyes | 1 | v0 | vampire.png @35 |
| `unit_lich` | `lich` | a terrifying lich king with a crowned skull face and burning green eyes, tattered purple robes, raising a staff topped with a glowing green soul orb, green necrotic fire | 8 | v6 | lich.png @35 |
| `unit_blackknight` | `blackknight` | a menacing black knight in pitch-black spiked plate armour with a horned helm and glowing red visor, riding a skeletal undead horse, wielding a jagged black sword | 2 | v1 |  |
| `unit_bonedragon` | `bonedragon` | a colossal bone dragon skeleton with bony wings and green fire burning in its eye sockets, jaws open | 1 | v0 | bonedragon.png @35 |
| `unit_skelwarrior` | `skelwarrior` | a skeleton warrior in a horned iron helmet with a heavy round shield and a broad sword, green eye fire, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | skelwarrior.png @35 |
| `unit_plaguezombie` | `plaguezombie` | a bloated plague zombie with sickly green skin, pustules and a toxic green cloud, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | plaguezombie.png @35 |
| `unit_wraith` | `wraith` | a wraith, a dark hooded spectre with a great scythe and cold blue ghost flames, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | wraith.png @35 |
| `unit_vampirelord` | `vampirelord` | a vampire lord with a black iron crown, red glowing eyes and a black and crimson cape, bats around, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | vampirelord.png @35 |
| `unit_powerlich` | `powerlich` | a power lich with a skull face, golden crown, and a staff with a blazing green orb, necrotic lightning, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | powerlich.png @35 |
| `unit_dreadknight` | `dreadknight` | a dread knight in black spiked armour with burning red eyes on a nightmare horse wreathed in dark fire, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | dreadknight.png @35 |
| `unit_ghostdragon` | `ghostdragon` | a ghost dragon, a translucent pale blue spectral dragon skeleton glowing with ghostly light, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | ghostdragon.png @35 |
| `unit_centaur` | `centaur` | a fierce centaur warrior, half man half brown horse, holding a long spear, leaf-green sash, heroic | 7 | v6 | unit_centaur.png @300 |
| `unit_dwarf` | `dwarf` | a stout bearded dwarf warrior in a horned helmet with a heavy axe and round shield, facing the viewer | 1 | v0 | dwarf.png @35 |
| `unit_woodelf` | `woodelf` | a graceful wood elf archer with long hair, green cloak and a longbow, arrow nocked, facing the viewer | 1 | v0 | woodelf.png @35 |
| `unit_pegasus` | `pegasus` | a noble white pegasus with great feathered wings spread, flowing mane | 1 | v0 | pegasus.png @35 |
| `unit_dendroid` | `dendroid` | a dendroid, a towering ancient walking tree giant with a stern bark face, glowing green eyes, branch arms and a crown of leaves | 2 | v1 |  |
| `unit_unicorn` | `unicorn` | a majestic white unicorn with a shining spiral horn and flowing silver mane | 1 | v0 | unicorn.png @35 |
| `unit_greendragon` | `greendragon` | a mighty green dragon with emerald scales, wings spread and jaws open | 1 | v0 | greendragon.png @35 |
| `unit_centaurcpt` | `centaurcpt` | a centaur captain in leaf-green armour with a long glaive and a war helm, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 2 | v0 | centaurcpt.png @35 |
| `unit_battledwarf` | `battledwarf` | a battle dwarf with a braided red beard, steel war helmet and a huge double axe, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | battledwarf.png @35 |
| `unit_grandelf` | `grandelf` | a grand elf archer in elegant silver and green armour drawing a glowing longbow, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | grandelf.png @35 |
| `unit_silverpegasus` | `silverpegasus` | a silver pegasus with shining silver wings, armoured barding and a silver mane, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | silverpegasus.png @35 |
| `unit_dendroidsoldier` | `dendroidsoldier` | a dendroid soldier, a mighty walking oak with bark armour and a thick branch club, green eyes, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | dendroidsoldier.png @35 |
| `unit_warunicorn` | `warunicorn` | a war unicorn with silver barding and a golden spiral horn crackling with light, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | warunicorn.png @35 |
| `unit_golddragon` | `golddragon` | a gold dragon with shining golden scales, majestic wings and glowing eyes, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | golddragon.png @35 |
| `unit_imp` | `imp` | a small wicked red imp with bat wings, horns and a mischievous grin, a fire spark in its claw | 1 | v0 | imp.png @35 |
| `unit_hellhound` | `hellhound` | a black and red hell hound with glowing eyes and fiery breath, snarling | 1 | v0 | hellhound.png @35 |
| `unit_demon` | `demon` | a muscular red demon with curved horns and clawed fists, burning eyes | 1 | v0 | demon.png @35 |
| `unit_succubus` | `succubus` | a succubus with red skin, horns and dark bat wings holding a blazing fire orb | 1 | v0 | succubus.png @35 |
| `unit_efreet` | `efreet` | an efreet, a fiery genie with a body of living orange flame, glowing eyes, muscular arms of fire, a smoky flame tail instead of legs | 2 | v1 |  |
| `unit_nightmare` | `nightmare` | a nightmare, a black horse with a burning flaming mane and fiery hooves, red eyes | 1 | v0 | nightmare.png @35 |
| `unit_devil` | `devil` | a pit lord, a huge red demon with great horns and a flaming whip, hellfire around | 1 | v0 | devil.png @35 |
| `unit_familiar` | `familiar` | a familiar, a small sly orange-red imp demon with tiny bat wings, little horns and a pointed tail, juggling a crackling fire spark, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 2 | v1 |  |
| `unit_cerberus` | `cerberus` | cerberus, a giant three-headed hound beast on four legs, three black dog heads with fangs and glowing red eyes, fire around, full body, animal not humanoid, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 3 | v2 |  |
| `unit_horneddemon` | `horneddemon` | a horned demon with huge ram horns, dark red skin and spiked armour, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | horneddemon.png @35 |
| `unit_succubusmistress` | `succubusmistress` | a succubus mistress with a crown, horns, dark wings and a whip of fire, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | succubusmistress.png @35 |
| `unit_efreetsultan` | `efreetsultan` | an efreet sultan made of white-hot flames with a jewelled turban and a scimitar, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | efreetsultan.png @35 |
| `unit_hellcharger` | `hellcharger` | a hell charger, a black armoured warhorse with a blazing mane and burning hooves, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | hellcharger.png @35 |
| `unit_archdevil` | `archdevil` | an arch devil with dark crimson skin, great horns, vast wings and a trident, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | archdevil.png @35 |
| `unit_troglodyte` | `troglodyte` | a troglodyte, a grey blind lizard man with a crude spear, hunched and snarling | 1 | v0 | troglodyte.png @35 |
| `unit_harpy` | `harpy` | a harpy, a savage bird-woman with large green feathered wings instead of arms, wild hair and taloned bird legs, screeching | 2 | v1 |  |
| `unit_beholder` | `beholder` | a beholder, a floating purple eyeball monster with a great central eye and eye stalks | 1 | v0 | beholder.png @35 |
| `unit_medusa` | `medusa` | a medusa, a snake-haired gorgon woman with writhing green snakes for hair, scaly green skin, glowing yellow eyes and a serpent tail, holding a bow | 2 | v1 |  |
| `unit_minotaur` | `minotaur` | a brown minotaur with great bull horns and a big axe, snorting | 1 | v0 | minotaur.png @35 |
| `unit_manticore` | `manticore` | a manticore, a red-maned lion beast with large leathery bat wings and a raised scorpion stinger tail, roaring | 2 | v1 |  |
| `unit_blackdragon` | `blackdragon` | a fearsome black dragon, dark violet scales, horned head roaring with glowing violet eyes, wings raised | 8 | v6 | blackdragon.png @35 |
| `unit_infernaltrog` | `infernaltrog` | an infernal troglodyte, a reddish lizard man with a barbed spear and spiked armour, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | infernaltrog.png @35 |
| `unit_harpyhag` | `harpyhag` | a harpy hag, a fierce winged bird-woman with huge dark purple feathered wings instead of arms, wild white hair and sharp talons, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 2 | v1 |  |
| `unit_evileye` | `evileye` | an evil eye, a floating round purple eyeball monster with one giant central eye and many writhing eye stalks, no body, no arms, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 2 | v1 |  |
| `unit_medusaqueen` | `medusaqueen` | a medusa queen with snake hair, a golden crown and a bow, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | medusaqueen.png @35 |
| `unit_minotaurking` | `minotaurking` | a minotaur king with golden horns, golden armour and a great axe, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | minotaurking.png @35 |
| `unit_scorpicore` | `scorpicore` | a scorpicore, a red lion beast with large bat wings and a huge segmented scorpion tail with a stinger, on four legs, roaring, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 2 | v1 |  |
| `unit_reddragon` | `reddragon` | a red dragon with crimson scales and fiery eyes, breathing fire, the elite upgraded form: grander and more imposing, ornate gilded armour with gold trim, a glowing aura of power | 1 | v0 | reddragon.png @35 |
| `unit_goblin` | `goblin` | a sneaky green goblin with big ears and a jagged dagger, sly grin | 1 | v0 | goblin.png @35 |
| `unit_wolf` | `wolf` | a snarling grey wolf with bared fangs and glowing yellow eyes | 1 | v0 | wolf.png @35 |
| `unit_orc` | `orc` | a green orc warrior with tusks, crude iron armour and a war axe | 1 | v0 | orc.png @35 |
| `unit_ogre` | `ogre` | a hulking ogre brute with a huge belly, small tusks, warty tan skin, tiny eyes, a giant spiked wooden club, monster not human | 2 | v1 |  |
| `unit_troll` | `troll` | a grey-green troll with a long nose, tusks and a stone club | 1 | v0 | troll.png @35 |
| `unit_cyclops` | `cyclops` | a cyclops giant, his face has only ONE enormous eye in the middle of the forehead and no other eyes, grey skin, bald, holding a boulder | 6 | v3 |  |
| `unit_hydra` | `hydra` | a hydra, a monstrous green serpent with FIVE long necks and five hissing snake heads rising from one scaly body | 2 | v1 |  |

## Faction heroes (5)

| id | serves | prompt (subject; the category suffix is added) | gens | pick | init |
|---|---|---|---|---|---|
| `hero_haven` | `haven` | a noble young paladin lord hero with short brown hair, ornate silver and royal blue plate armour with gold trim, a flowing blue cape, holding a longsword, facing the viewer | 8 | v6 | hero_haven.png @35 |
| `hero_necro` | `necro` | a sinister necromancer lord with pale skin and a dark hood, holding a bone staff with eerie green soul fire, facing the viewer | 1 | v0 | hero_necro.png @35 |
| `hero_sylvan` | `sylvan` | a fierce elven ranger lord with long hair, a green cloak and an elegant longbow, facing the viewer | 1 | v0 | hero_sylvan.png @35 |
| `hero_inferno` | `inferno` | a demonic warlord hero with curved horns, black and red spiked armour and a flaming sword, facing the viewer | 1 | v0 | hero_inferno.png @35 |
| `hero_dungeon` | `dungeon` | a dark elf warlock hero with long white hair, purple robes and a crystal staff glowing violet, facing the viewer | 1 | v0 | hero_dungeon.png @35 |

## Legendary Heroes (24)

| id | serves | prompt (subject; the category suffix is added) | gens | pick | init |
|---|---|---|---|---|---|
| `guard_wall` | `wall` | a hulking grey-skinned ogre in riveted iron plate behind a tower shield as tall as a door | 1 | v0 |  |
| `guard_plague` | `plague` | a horned pit lord wreathed in sickly green smoke, a rusted scythe, flies around him | 1 | v0 |  |
| `guard_lich_queen` | `lich_queen` | a skeletal queen in a tall black-iron crown and violet gown, glowing eye-sockets, a staff topped with a soul gem | 1 | v0 |  |
| `guard_silence` | `silence` | a pale dark-elf sorceress with a finger to her lips, violet runes sealing a floating spellbook | 1 | v0 |  |
| `guard_hunger` | `hunger` | a towering green troll chieftain with a tree-trunk club, wounds visibly closing, tusks and war paint | 1 | v0 |  |
| `guard_gale` | `gale` | a young elven druid in green robes, hair whipped by a gale, staff wrapped in swirling leaves | 1 | v0 |  |
| `guard_eclipse` | `eclipse` | a dark-elf matriarch in obsidian armour before a black sun, shadow tendrils spreading behind her | 1 | v0 |  |
| `guard_stampede` | `stampede` | a demon knight in black spiked armour astride a flaming nightmare steed, mid-charge | 1 | v0 |  |
| `guard_iron_hide` | `iron_hide` | a fallen paladin in scarred plate, cracked holy symbol on his breastplate, arrows broken against it | 1 | v0 |  |
| `guard_goblin_king` | `goblin_king` | a scrawny grinning goblin on a throne of junk, oversized dented crown, a crowd of goblins behind | 1 | v0 |  |
| `guard_wolf_mother` | `wolf_mother` | a wild-haired huntress in a wolf-pelt hood, bone spear, a great grey wolf at her side | 1 | v0 |  |
| `guard_pikemaster` | `pikemaster` | a grizzled human captain in blue-and-silver plate, a long pike planted, a wall of shields behind | 1 | v0 |  |
| `guard_bone_tide` | `bone_tide` | a gaunt necromancer in tattered black robes, lantern of green soul-fire, skeleton hands rising from the ground | 1 | v0 |  |
| `guard_ember_witch` | `ember_witch` | a red-skinned witch with smouldering hair and ember eyes, a ring of fire in her raised palms | 1 | v0 |  |
| `guard_thornqueen` | `thornqueen` | a regal dryad crowned with thorned roses, bark-skinned arms, vines coiling from the ground | 1 | v0 |  |
| `guard_beholder_lord` | `beholder_lord` | a huge floating beholder with one great central eye and a crown of eyestalks, stony light from its gaze | 1 | v0 |  |
| `guard_cyclops_lord` | `cyclops_lord` | a one-eyed cyclops warlord hefting a boulder overhead, rope belt of skulls, crude iron crown | 1 | v0 |  |
| `guard_minotaur_king` | `minotaur_king` | a massive minotaur king with a gold-ringed horn, double-headed labrys, a stone labyrinth behind | 1 | v0 |  |
| `guard_hydra_mother` | `hydra_mother` | a serpent-bodied naga queen coiled in a swamp, three hydra heads rising behind her | 1 | v0 |  |
| `guard_stormcaller` | `stormcaller` | an ancient elf archdruid with a white beard braided with leaves, lightning arcing from an oak staff, storm clouds | 1 | v0 |  |
| `guard_dragon_mother` | `dragon_mother` | a colossal ancient dragon with scales shifting through green, gold, red and black, wings spread over a hoard, mythic legendary boss, overwhelming power | 1 | v0 |  |
| `guard_archdevil` | `archdevil` | a towering archdevil with curling ram horns and burning wings, a gate of hellfire opening behind him, mythic legendary boss, overwhelming power | 1 | v0 |  |
| `guard_seraphine` | `seraphine` | a fallen archangel with tarnished gold armour and wings half white, half ash-grey, a flaming sword lowered, mythic legendary boss, overwhelming power | 1 | v0 |  |
| `guard_dread_king` | `dread_king` | a spectral king in rusted black plate on a ghostly throne, a crown of cold blue fire, mist pouring from his cloak, mythic legendary boss, overwhelming power | 1 | v0 |  |

## Hero backgrounds (7)

| id | serves | prompt (subject; the category suffix is added) | gens | pick | init |
|---|---|---|---|---|---|
| `bg_knight` | `knight` | a young knight-errant with a blue tabard and a sword over the shoulder | 1 | v0 |  |
| `bg_merchant` | `merchant` | a rich merchant prince with a feathered hat and gold coins | 1 | v0 |  |
| `bg_warlord` | `warlord` | a scarred warlord with a fur mantle and a horned helmet | 1 | v0 |  |
| `bg_exile` | `exile` | a hooded exile wanderer in a ragged grey cloak | 1 | v0 |  |
| `bg_scholar` | `scholar` | an old bearded scholar mage with spectacles and a book | 1 | v0 |  |
| `bg_gravecaller` | `gravecaller` | a pale necromancer with a bone staff and green ghostly glow | 1 | v0 |  |
| `bg_siegelord` | `siegelord` | a siege engineer lord in heavy armour with a castle tower behind | 1 | v0 |  |

## Faction crests (5)

| id | serves | prompt (subject; the category suffix is added) | gens | pick | init |
|---|---|---|---|---|---|
| `crest_haven` | `haven` | royal blue heraldic shield crest with a golden griffin and gold trim | 1 | v0 |  |
| `crest_necro` | `necro` | a black and crimson heraldic shield crest with a bone-white crowned skull, glowing green eyes | 2 | v1 |  |
| `crest_sylvan` | `sylvan` | emerald green heraldic shield crest with a golden great oak tree and gold trim | 1 | v0 |  |
| `crest_inferno` | `inferno` | fiery orange heraldic shield crest with a horned demon skull in flames and gold trim | 1 | v0 |  |
| `crest_dungeon` | `dungeon` | deep purple heraldic shield crest with a black dragon and gold trim | 1 | v0 |  |

## Artifacts (113)

| id | serves | prompt (subject; the category suffix is added) | gens | pick | init |
|---|---|---|---|---|---|
| `art_centaur_axe` | `centaur_axe` `fp:sword` | a heavy double-headed bronze battle axe with two huge curved blades and a short carved wooden handle, upright, blades filling the frame | 1 | v0 |  |
| `art_lion_shield` | `lion_shield` `fp:shield` | a round golden shield with a roaring lion head emblem | 1 | v0 |  |
| `art_staff_embers` | `staff_embers` `fp:staff` | a short thick gnarled wooden staff held diagonally, its top a burning ember crown with bright orange flames, bold chunky silhouette | 1 | v0 |  |
| `art_helm_command` | `helm_command` `fp:helm` | a golden knight helmet with a red plume and a small crown circlet | 1 | v0 |  |
| `art_shadow_cloak` | `shadow_cloak` `fp:cloak` | a dark purple hooded cloak with wisps of shadow and a silver clasp | 1 | v0 |  |
| `art_judgement` | `judgement` `fp:blade` | a broad holy greatsword held diagonally with a wide glowing white blade and a golden winged crossguard, bold chunky silhouette | 1 | v0 |  |
| `art_tempest_orb` | `tempest_orb` `fp:orb` | a glass orb containing a swirling blue storm with tiny lightning, on a silver stand | 1 | v0 |  |
| `art_clover` | `clover` `fp:clover` | a lucky four-leaf clover pendant set in gold | 1 | v0 |  |
| `art_valor_badge` | `valor_badge` | a golden medal badge with a red ribbon and a lion on it | 1 | v0 |  |
| `art_vitality_ring` | `vitality_ring` `fp:ring` | a gold ring set with a large glowing heart-shaped ruby, crimson light | 3 | v2 |  |
| `art_speed_boots` | `speed_boots` `fp:boots` | a pair of green leather boots with golden wings at the ankles | 1 | v0 |  |
| `art_pike_pauldron` | `pike_pauldron` | a single steel shoulder pauldron, layered curved armour plates with blue trim and brass rivets, side view | 1 | v0 |  |
| `art_tome` | `fp:tome` | a thick closed leather tome with brass corners and a glowing blue rune on the cover | 1 | v0 |  |
| `art_banner_valor` | `fp:banner` | a red and gold war banner on a wooden pole with a golden lion embroidered | 1 | v0 |  |
| `art_war_drum` | `war_drum` | a war drum with drumsticks, crimson red cloth and blackened iron with a gold wolf-head emblem | 1 | v0 |  |
| `art_vanguard_standard` | `vanguard_standard` | a large square crimson battle flag with a gold wolf head, on a short blackened iron pole, bold | 1 | v0 |  |
| `art_executioner_axe` | `executioner_axe` | a huge double-bladed executioner axe, crimson red cloth and blackened iron with a gold wolf-head emblem | 1 | v0 |  |
| `art_sentinel_helm` | `sentinel_helm` | a closed knight great helm with a cross eye slit, polished silver with royal blue enamel and a golden sunburst on the brow | 1 | v0 |  |
| `art_sentinel_plate` | `sentinel_plate` | a knight breastplate cuirass, polished silver plate with royal blue enamel and a golden sunburst emblem | 1 | v0 |  |
| `art_sentinel_shield` | `sentinel_shield` | a tall tower shield, polished silver plate with royal blue enamel and a golden sunburst emblem | 1 | v0 |  |
| `art_plenty_quiver` | `plenty_quiver` | a quiver overflowing with many arrows, dark green elven leather with silver leaf filigree | 1 | v0 |  |
| `art_sharpshooter_bow` | `sharpshooter_bow` | a thick heavy elven recurve longbow of dark green wood with silver leaf ornaments and a nocked glowing arrow, held diagonally, bold chunky silhouette filling the frame | 2 | v1 |  |
| `art_elven_bowstring` | `elven_bowstring` | a coiled glowing silver bowstring looped around a large green elven leaf, tied with dark green leather, magical shimmer | 2 | v1 |  |
| `art_griffin_cape` | `griffin_cape` | a hooded cloak cape made of tawny golden-brown griffin feathers with a burnished bronze clasp | 1 | v0 |  |
| `art_feathered_boots` | `feathered_boots` | a pair of boots with feathered wings, tawny griffin feathers and burnished bronze | 1 | v0 |  |
| `art_talon_ring` | `talon_ring` | a ring shaped like a griffin talon clutching an amber gem, tawny griffin feathers and burnished bronze | 1 | v0 |  |
| `art_bone_cloak` | `bone_cloak` | a tattered black cloak laid out flat with a shoulder mantle of ribs and small skulls, glowing green runes, no person inside | 2 | v1 |  |
| `art_skull_helm` | `skull_helm` | a horned helmet made from a giant skull, bone white with glowing green necrotic runes | 1 | v0 |  |
| `art_vampire_ring` | `vampire_ring` | a ring with a blood red gem held by two fangs, bone white with glowing green necrotic runes | 1 | v0 |  |
| `art_last_stand` | `last_stand` | a crystal heart amulet glowing red-gold, cracked but shining, on a chain | 1 | v0 |  |
| `art_berserker_helm` | `berserker_helm` | a horned iron viking helmet with red war paint and blood-red glow | 1 | v0 |  |
| `art_riposte_bracer` | `riposte_bracer` | a cylindrical forearm vambrace arm guard of steel plates and brown leather straps with one small curved blade spike, armour piece, no sword | 1 | v0 |  |
| `art_iron_oath` | `iron_oath` | a heavy dark iron ring engraved with glowing orange runes | 1 | v0 |  |
| `art_trophy_necklace` | `trophy_necklace` | a barbarian trophy necklace of large curved beast fangs and claws strung on a thick leather cord with bone beads, shown as a U shape | 2 | v1 |  |
| `art_veteran_medal` | `veteran_medal` | a silver star medal with a blue and gold ribbon | 1 | v0 |  |
| `art_hourglass` | `hourglass` | an ornate golden hourglass with glowing sand | 1 | v0 |  |
| `art_sky_lances` | `sky_lances` | a pair of sky blue vambraces with small silver lance points and white feathers | 1 | v0 |  |
| `art_crown_command` | `crown_command` | a magnificent jewelled golden king crown with rubies and sapphires, radiant golden aura, legendary relic | 2 | v1 |  |
| `art_phylactery` | `phylactery` | a small ornate glass phylactery vial with a glowing soul inside, silver filigree, legendary relic radiating golden light | 1 | v0 |  |
| `art_usurper_crown` | `usurper_crown` | a jagged black iron crown with red gems and dark flames, legendary relic radiating golden light | 1 | v0 |  |
| `art_miser_ring` | `miser_ring` | a fat gold signet ring engraved with a coin symbol | 1 | v0 |  |
| `art_endless_purse` | `endless_purse` | a red velvet coin purse spilling endless gold coins | 1 | v0 |  |
| `art_endless_sack` | `endless_sack` | a small wooden mine cart loaded with ore rocks and logs | 1 | v0 |  |
| `art_mason_hammer` | `mason_hammer` | a chunky stone mason hammer with a big square steel head and a short wooden handle, crossed with an iron chisel | 1 | v0 |  |
| `art_builders_crown` | `builders_crown` | a bronze circlet crown shaped like a ring of tiny castle towers with battlements and small golden gems, front view | 1 | v0 |  |
| `art_fortress_shield` | `fortress_shield` | a grey stone shield with a castle tower emblem and iron rim | 1 | v0 |  |
| `art_sylvan_leaf` | `sylvan_leaf` | a glowing golden-green leaf of the world tree with veins of light | 1 | v0 |  |
| `art_inferno_brand` | `inferno_brand` | a thick red-hot iron branding rod held diagonally, glowing horned demon sigil at its end, flames and sparks, bold chunky silhouette | 1 | v0 |  |
| `art_dungeon_eye` | `dungeon_eye` | a purple crystal amulet on a silver chain with a single glowing reptilian eye staring from inside the gem | 2 | v1 |  |
| `art_haven_seal` | `haven_seal` | a large golden holy seal medallion with a radiant sun and angel wings, white wax and blue ribbons | 1 | v0 |  |
| `art_black_grimoire` | `black_grimoire` | a black leather grimoire bound in bone and iron chains, a skull on the cover, green necrotic glow | 1 | v0 |  |
| `art_iron_cap` | `iron_cap` | a simple sturdy iron skullcap helmet with rivets and a nose guard | 1 | v0 |  |
| `art_bronze_buckler` | `bronze_buckler` | a small round bronze buckler shield with a raised boss, polished | 1 | v0 |  |
| `art_traveler_boots` | `traveler_boots` | a pair of worn brown leather traveller's boots with buckles and a rolled cuff | 1 | v0 |  |
| `art_militia_horn` | `militia_horn` | a curved ox horn bugle with a brass mouthpiece and brass rim, a leather carrying strap, curved crescent shape | 2 | v1 |  |
| `art_leather_jerkin` | `leather_jerkin` | a brown studded leather jerkin vest with laces | 1 | v0 |  |
| `art_hunting_knife` | `hunting_knife` | a hunter's knife with a curved steel blade and an antler handle | 1 | v0 |  |
| `art_ward_amulet` | `ward_amulet` | a silver amulet with a blue warding rune stone glowing softly | 1 | v0 |  |
| `art_spyglass` | `spyglass` | a brass scout's spyglass telescope with leather grip, extended diagonally | 1 | v0 |  |
| `art_woodcutter_charm` | `woodcutter_charm` | a wooden charm amulet carved like a small axe crossed with an oak leaf, on a leather cord, filling the frame | 2 | v1 |  |
| `art_copper_band` | `copper_band` | a plain copper ring with a small engraved coin | 1 | v0 |  |
| `art_spiked_shield` | `spiked_shield` | a round iron shield studded with sharp steel spikes | 1 | v0 |  |
| `art_adept_circlet` | `adept_circlet` | a silver circlet tiara crown seen from the front at an angle, a round ring band with a large glowing blue sapphire at the brow, filling the frame | 2 | v1 |  |
| `art_swift_ring` | `swift_ring` | a silver ring shaped like a feathered wing wrapping the finger, pale blue gem | 1 | v0 |  |
| `art_phoenix_feather` | `phoenix_feather` | a single blazing phoenix feather of red, orange and gold flame | 1 | v0 |  |
| `art_bandit_mask` | `bandit_mask` | a black cloth bandit's mask with eye holes and a gold coin | 1 | v0 |  |
| `art_tower_shield` | `tower_shield` | a tall rectangular steel tower shield with blue enamel and a castle emblem | 1 | v0 |  |
| `art_charge_horn` | `charge_horn` | a great curved war horn of ivory and gold, a red banner tassel | 1 | v0 |  |
| `art_legion_mail` | `legion_mail` | a chainmail hauberk shirt with a red legion tabard and bronze trim | 1 | v0 |  |
| `art_blood_ring` | `blood_ring` | a dark iron ring set with a dripping blood red gem, crimson glow | 1 | v0 |  |
| `art_sun_amulet` | `sun_amulet` | a golden sun amulet with radiant rays and a glowing amber centre | 1 | v0 |  |
| `art_trollskin` | `trollskin` | a mossy green troll hide cloak with a bone clasp | 1 | v0 |  |
| `art_parry_bracer` | `parry_bracer` | a duellist's steel bracer with a parrying hook and red leather straps | 1 | v0 |  |
| `art_eagle_lens` | `eagle_lens` | a golden monocle lens framed like an eagle's head, glinting | 1 | v0 |  |
| `art_battle_standard` | `battle_standard` | a tall crimson battle standard flag with crossed swords on a gilded pole | 1 | v0 |  |
| `art_merchant_scales` | `merchant_scales` | a pair of golden merchant's scales with coins on the pans | 1 | v0 |  |
| `art_prospector_ring` | `prospector_ring` | a ring set with a rough nugget of ore and a small purple gem | 1 | v0 |  |
| `art_dragonscale` | `dragonscale` | a breastplate armour vest made of overlapping crimson and gold dragon scales, on display, no dragon, no person | 2 | v1 |  |
| `art_giant_slayer` | `giant_slayer` | a huge giant-slayer greatsword with a jagged notched blade and a skull pommel | 1 | v0 |  |
| `art_horde_banner` | `horde_banner` | a ragged horde war banner of hides and bones on a spear, red war paint | 1 | v0 |  |
| `art_thorn_crown` | `thorn_crown` | a dark crown of twisted black thorns dripping with red light | 1 | v0 |  |
| `art_mirror_shield` | `mirror_shield` | a gleaming polished silver mirror shield reflecting bright light | 1 | v0 |  |
| `art_second_wind` | `second_wind` | a silver horn wreathed in a swirling wind gust and white feathers | 1 | v0 |  |
| `art_vanguard_boots` | `vanguard_boots` | a pair of armoured steel sabatons with blue enamel and golden spurs | 1 | v0 |  |
| `art_ruin_grimoire` | `ruin_grimoire` | a cracked grimoire of ruin, red runes and violet fire bursting from its pages | 1 | v0 |  |
| `art_storm_staff` | `storm_staff` | a thick gnarled dark wooden staff held diagonally, its top a large glowing storm orb with a tiny thundercloud and crackling blue lightning, bold chunky silhouette | 2 | v1 |  |
| `art_soul_amulet` | `soul_amulet` | a soulbinder amulet, a black gem cage holding captive green ghost souls | 1 | v0 |  |
| `art_conquest_ring` | `conquest_ring` | a heavy gold ring of conquest shaped like a crown with a red ruby | 1 | v0 |  |
| `art_twin_axes` | `twin_axes` | two crossed bearded war axes with red-wrapped handles | 1 | v0 |  |
| `art_bastion_aegis` | `bastion_aegis` | a massive bastion aegis shield of white stone and gold with a fortress emblem, glowing blue ward | 1 | v0 |  |
| `art_bloodlust_ring` | `bloodlust_ring` | a crimson ring with fangs gripping a pulsing red gem, blood glow | 1 | v0 |  |
| `art_dawn_sword` | `dawn_sword` | the sword of the dawn, a radiant golden longsword with a rising sun crossguard and blazing light | 1 | v0 |  |
| `art_damned_armour` | `damned_armour` | an empty suit of black spiked plate armour breastplate and pauldrons on display, wreathed in dark red flames, skull ornaments, no person, no head | 2 | v1 |  |
| `art_angel_wings` | `angel_wings` | a pair of radiant white angel feather wings with golden light | 1 | v0 |  |
| `art_inhibition_orb` | `inhibition_orb` | an orb of inhibition, a dark grey sphere bound in silver chains with glowing blue sealing runes | 1 | v0 |  |
| `art_life_ring` | `life_ring` | a ring of life eternal, a golden ring with a glowing green leaf-shaped emerald and life light | 1 | v0 |  |
| `art_cornucopia` | `cornucopia` | a golden cornucopia horn overflowing with gold coins, gems and fruit | 1 | v0 |  |
| `art_heavens_helm` | `heavens_helm` | the helm of heavenly light, a winged golden helmet blazing with holy light and a halo | 1 | v0 |  |
| `art_archmage_hat` | `archmage_hat` | a tall pointed archmage's hat of deep blue velvet with silver stars and runes | 1 | v0 |  |
| `art_magi_robe` | `magi_robe` | a flowing deep blue robe of the magi with silver star embroidery and a high collar | 1 | v0 |  |
| `art_storm_wand` | `storm_wand` | a short silver wand tipped with a crackling blue lightning crystal | 1 | v0 |  |
| `art_hellfire_blade` | `hellfire_blade` | a hellfire blade, a jagged black sword with a blade of molten orange fire | 1 | v0 |  |
| `art_brimstone_plate` | `brimstone_plate` | a brimstone breastplate of black iron with glowing orange lava cracks | 1 | v0 |  |
| `art_cinder_boots` | `cinder_boots` | a pair of black iron boots with smouldering embers and orange lava cracks | 1 | v0 |  |
| `art_titan_helm` | `titan_helm` | a titan's helm, a colossal bronze war helmet with a tall crest and stern face guard | 1 | v0 |  |
| `art_titan_cuirass` | `titan_cuirass` | a titan's cuirass, a massive bronze muscled breastplate with gold engravings | 1 | v0 |  |
| `art_titan_gauntlet` | `titan_gauntlet` | a titan's gauntlet, a giant bronze armoured fist clenched | 1 | v0 |  |
| `art_coin_ring` | `coin_ring` | a gold ring set with a gleaming gold coin | 1 | v0 |  |
| `art_golden_goose` | `golden_goose` | a golden goose statuette sitting on a golden egg, shining | 1 | v0 |  |
| `art_gilded_ledger` | `gilded_ledger` | a gilded ledger book with golden corners and a coin clasp | 1 | v0 |  |
| `art_shadow_hood` | `shadow_hood` | a black assassin hood with a shadowy face and violet eyes glowing | 1 | v0 |  |
| `art_venom_dagger` | `venom_dagger` | a curved dagger dripping green venom, black hilt | 1 | v0 |  |
| `art_shadowstep_boots` | `shadowstep_boots` | a pair of black leather boots trailing violet shadow smoke | 1 | v0 |  |

## Artifact sets (10)

| id | serves | prompt (subject; the category suffix is added) | gens | pick | init |
|---|---|---|---|---|---|
| `set_warlord` | `warlord` | a crimson red heraldic shield badge with a blackened iron rim and a gold wolf head emblem | 1 | v0 |  |
| `set_sentinel` | `sentinel` | a heraldic badge with a golden sunburst, polished silver plate with royal blue enamel and a golden sunburst emblem | 1 | v0 |  |
| `set_sharpshooter` | `sharpshooter` | a heraldic badge with a silver leaf and an arrow, dark green elven leather with silver leaf filigree | 1 | v0 |  |
| `set_wings` | `wings` | a burnished bronze heraldic badge with two spread tawny griffin wings and a griffin head in the centre | 1 | v0 |  |
| `set_undead` | `undead` | a heraldic badge with a crowned skull, bone white with glowing green necrotic runes | 1 | v0 |  |
| `set_archmage` | `archmage` | a deep blue heraldic badge with a silver star and an open spellbook, silver filigree | 1 | v0 |  |
| `set_hellforged` | `hellforged` | a black iron heraldic badge with a flaming horned sigil and lava cracks | 1 | v0 |  |
| `set_titan` | `titan` | a bronze heraldic badge with a colossal clenched fist emblem | 1 | v0 |  |
| `set_gilded` | `gilded` | a gold heraldic badge with a stack of coins and a goose emblem, jewels | 1 | v0 |  |
| `set_nightstalker` | `nightstalker` | a black heraldic badge with a violet crescent moon and a dagger | 1 | v0 |  |

## Spells (8)

| id | serves | prompt (subject; the category suffix is added) | gens | pick | init |
|---|---|---|---|---|---|
| `spell_arrow` | `arrow` | a single glowing blue magic arrow of light flying up to the right, one arrowhead, sparkle trail | 1 | v0 |  |
| `spell_bless` | `bless` | a radiant golden halo with holy light rays and sparkles | 1 | v0 |  |
| `spell_stoneskin` | `stoneskin` | a shield made of cracked grey stone with a faint green magic glow | 1 | v0 |  |
| `spell_cure` | `cure` | a green glowing healing heart with a white cross and sparkles | 1 | v0 |  |
| `spell_haste` | `haste` | a swirling green wind gust with motion lines and a small wing | 1 | v0 |  |
| `spell_slow` | `slow` | a purple glowing hourglass wrapped in heavy chains | 1 | v0 |  |
| `spell_bolt` | `bolt` | a crackling jagged lightning bolt spell, white-hot core with electric blue glow | 1 | v0 |  |
| `spell_fireball` | `fireball` | a roaring fireball spell, blazing orange and white-hot core with a flaming comet tail | 2 | v0 |  |

## Skills (11)

| id | serves | prompt (subject; the category suffix is added) | gens | pick | init |
|---|---|---|---|---|---|
| `skill_logistics` | `logistics` | round bronze-rimmed medallion with a galloping horse head in the centre | 1 | v0 |  |
| `skill_offense` | `offense` | round medallion with two crossed steel swords in the centre | 2 | v1 |  |
| `skill_archery` | `archery` | round bronze-rimmed medallion with two crossed arrows in the centre | 1 | v0 |  |
| `skill_armorer` | `armorer` | round bronze-rimmed medallion with a shiny steel knight breastplate cuirass in the centre | 1 | v0 |  |
| `skill_wisdom` | `wisdom` | round bronze-rimmed medallion with an unrolled parchment scroll in the centre | 1 | v0 |  |
| `skill_sorcery` | `sorcery` | round bronze-rimmed medallion with a glowing purple crystal ball in the centre | 1 | v0 |  |
| `skill_leadership` | `leadership` | round bronze-rimmed medallion with a red battle flag in the centre | 1 | v0 |  |
| `skill_luck` | `luck` | round bronze-rimmed medallion with a green four-leaf clover in the centre | 1 | v0 |  |
| `skill_scouting` | `scouting` | round bronze-rimmed medallion with a long brass spyglass telescope lying diagonally in the centre | 1 | v0 |  |
| `skill_estates` | `estates` | round bronze-rimmed medallion with a bulging coin purse in the centre | 1 | v0 |  |
| `skill_necromancy` | `necromancy` | round bronze-rimmed medallion with a glowing green-eyed skull in the centre | 1 | v0 |  |

## Resources (4)

| id | serves | prompt (subject; the category suffix is added) | gens | pick | init |
|---|---|---|---|---|---|
| `res_gold` | `gold` | a heap of gleaming gold coins with a few coins standing on edge, floating, no ground, no floor | 3 | v2 |  |
| `res_wood` | `wood` | a neat stack of three chopped brown wooden logs with light round cut ends | 1 | v0 |  |
| `res_ore` | `ore` | a pile of grey iron ore rocks with metallic glints | 1 | v0 |  |
| `res_gems` | `gems` | a cluster of three cut gemstones, one red ruby, one blue sapphire, one green emerald, sparkling | 1 | v0 |  |

## Stats (13)

| id | serves | prompt (subject; the category suffix is added) | gens | pick | init |
|---|---|---|---|---|---|
| `stat_attack` | `attack` `att` | an ornate steel longsword pointing up diagonally, golden hilt, gleaming edge | 1 | v0 |  |
| `stat_defense` | `defense` `def` `defend` | a blue heater shield with a golden rim and gold cross | 1 | v0 |  |
| `stat_power` | `power` `pow` | a large glowing purple crystal orb in golden prongs on top of a short golden scepter, the orb fills most of the frame, sparkles | 1 | v0 |  |
| `stat_knowledge` | `knowledge` `know` | an open old spell book with parchment pages and a red ribbon bookmark | 1 | v0 |  |
| `stat_morale` | `morale` | a golden war horn with a red tassel | 1 | v0 |  |
| `stat_luck` | `luck` `clover` | a bright green four-leaf clover with a golden sparkle | 1 | v0 |  |
| `stat_movement` | `movement` `move` `mp` `spd` `speed` `boots` | a brown leather boot with a small white wing on the heel | 1 | v0 |  |
| `stat_mana` | `mana` | a glowing blue mana droplet crystal | 1 | v0 |  |
| `stat_experience` | `experience` `xp` | a shining five-pointed golden star | 1 | v0 |  |
| `stat_hp` | `hp` `heart` | a glossy red heart | 1 | v0 |  |
| `stat_damage` | `damage` `dmg` | a jagged spiky impact burst star shape, bright orange and red explosion blast with a white-hot centre and flying shards, no logs, no ground, no wood | 4 | v2 |  |
| `stat_shots` | `shots` `ranged` | a leather quiver holding three arrows with clear steel arrowheads and red fletching, tilted | 1 | v0 |  |
| `stat_fly` | `fly` | a single large white feathered angel wing | 1 | v0 |  |

## Town buildings (generic + per faction, dwellings d1–d7, upgraded u1–u7) (118)

| id | serves | prompt (subject; the category suffix is added) | gens | pick | init |
|---|---|---|---|---|---|
| `bld_hall2` | `hall2` `village` `hall` | a stone town hall building with a red roof and a clock tower | 1 | v0 |  |
| `bld_hall3` | `hall3` | a grand marble city hall palace with golden domes | 1 | v0 |  |
| `bld_fort` | `fort` | a grey stone fort with crenellated walls, a gate and two towers | 1 | v0 |  |
| `bld_market` | `market` | a market stall with a striped awning, crates and golden scales | 1 | v0 |  |
| `bld_tavern` | `tavern` | a cosy timber tavern with a hanging sign and a foaming ale mug | 1 | v0 |  |
| `bld_mage1` | `mage1` `mage` `guild` | a small stone mage tower with a blue pointed roof and glowing window | 1 | v0 |  |
| `bld_mage2` | `mage2` | a tall stone mage tower with a green pointed roof and floating runes | 1 | v0 |  |
| `bld_mage3` | `mage3` | a grand mage tower with a red pointed roof, crystal spire and arcane glow | 1 | v0 |  |
| `bld_haven_hall2` | `haven:hall2` | town hall with a big clock tower and a flag, in haven style: white stone and blue roofs | 1 | v0 |  |
| `bld_haven_hall3` | `haven:hall3` | grand capitol palace with domes and towers, in haven style: white stone and blue roofs | 1 | v0 |  |
| `bld_haven_fort` | `haven:fort` | fortress with crenellated walls, a gate and towers, in haven style: white stone and blue roofs | 1 | v0 |  |
| `bld_haven_market` | `haven:market` | marketplace stall with an awning, crates and golden scales, in haven style: white stone and blue roofs | 1 | v0 |  |
| `bld_haven_tavern` | `haven:tavern` | tavern with a big hanging beer mug sign, barrels and a bench outside, in haven style: white stone and blue roofs | 1 | v0 |  |
| `bld_haven_mage1` | `haven:mage1` | small round mage tower topped by a glowing magic orb, in haven style: white stone and blue roofs | 1 | v0 |  |
| `bld_haven_mage2` | `haven:mage2` | tall mage tower with a big glowing rune circle and floating books, in haven style: white stone and blue roofs | 1 | v0 |  |
| `bld_haven_mage3` | `haven:mage3` | grand mage guild tower with a crystal spire and arcane glow, in haven style: white stone and blue roofs | 1 | v0 |  |
| `bld_haven_d1` | `haven:d1` | creature dwelling: guardhouse with pikes and a shield, in haven style: white stone and blue roofs | 1 | v0 |  |
| `bld_haven_d2` | `haven:d2` | creature dwelling: archers' tower with a big red and white archery target and bows, in haven style: white stone and blue roofs | 1 | v0 |  |
| `bld_haven_d3` | `haven:d3` | a griffin tower: a tall white stone tower with blue roofs, a huge straw nest on top with a golden griffin perched in it, banners | 2 | v1 |  |
| `bld_haven_d4` | `haven:d4` | creature dwelling: barracks with crossed swords over the door and weapon racks, in haven style: white stone and blue roofs | 1 | v0 |  |
| `bld_haven_d5` | `haven:d5` | creature dwelling: monastery with a bell tower, in haven style: white stone and blue roofs | 1 | v0 |  |
| `bld_haven_d6` | `haven:d6` | creature dwelling: jousting yard with a horse, lances and striped tents, in haven style: white stone and blue roofs | 1 | v0 |  |
| `bld_haven_d7` | `haven:d7` | creature dwelling: portal of glory, a radiant golden archway with angel wings, in haven style: white stone and blue roofs | 1 | v0 |  |
| `bld_haven_u1` | `haven:u1` | upgraded creature dwelling: guardhouse with pikes and a shield, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in haven style: white stone and blue roofs | 2 | v1 | bld_haven_d1.png @60 |
| `bld_haven_u2` | `haven:u2` | upgraded creature dwelling: archers' tower with a big red and white archery target and bows, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in haven style: white stone and blue roofs | 2 | v1 | bld_haven_d2.png @60 |
| `bld_haven_u3` | `haven:u3` | upgraded creature dwelling: tower with a huge straw nest on top and a golden griffin sitting in it, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in haven style: white stone and blue roofs | 2 | v1 | bld_haven_d3.png @60 |
| `bld_haven_u4` | `haven:u4` | upgraded creature dwelling: barracks with crossed swords over the door and weapon racks, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in haven style: white stone and blue roofs | 2 | v1 | bld_haven_d4.png @60 |
| `bld_haven_u5` | `haven:u5` | upgraded creature dwelling: monastery with a bell tower, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in haven style: white stone and blue roofs | 2 | v1 | bld_haven_d5.png @60 |
| `bld_haven_u6` | `haven:u6` | upgraded creature dwelling: jousting yard with a horse, lances and striped tents, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in haven style: white stone and blue roofs | 2 | v1 | bld_haven_d6.png @60 |
| `bld_haven_u7` | `haven:u7` | upgraded creature dwelling: portal of glory, a radiant golden archway with angel wings, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in haven style: white stone and blue roofs | 2 | v1 | bld_haven_d7.png @60 |
| `bld_necro_hall2` | `necro:hall2` | town hall with a big clock tower and a flag, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | v0 |  |
| `bld_necro_hall3` | `necro:hall3` | grand capitol palace with domes and towers, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | v0 |  |
| `bld_necro_fort` | `necro:fort` | fortress with crenellated walls, a gate and towers, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | v0 |  |
| `bld_necro_market` | `necro:market` | marketplace stall with an awning, crates and golden scales, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | v0 |  |
| `bld_necro_tavern` | `necro:tavern` | tavern with a big hanging beer mug sign, barrels and a bench outside, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | v0 |  |
| `bld_necro_mage1` | `necro:mage1` | small round mage tower topped by a glowing magic orb, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | v0 |  |
| `bld_necro_mage2` | `necro:mage2` | tall mage tower with a big glowing rune circle and floating books, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | v0 |  |
| `bld_necro_mage3` | `necro:mage3` | grand mage guild tower with a crystal spire and arcane glow, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | v0 |  |
| `bld_necro_d1` | `necro:d1` | creature dwelling: cursed temple with skeletons, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | v0 |  |
| `bld_necro_d2` | `necro:d2` | creature dwelling: graveyard with tombstones and an open grave, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | v0 |  |
| `bld_necro_d3` | `necro:d3` | creature dwelling: tomb of souls with ghostly mist, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | v0 |  |
| `bld_necro_d4` | `necro:d4` | creature dwelling: vampire estate manor with bats, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | v0 |  |
| `bld_necro_d5` | `necro:d5` | creature dwelling: mausoleum with a lich statue, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | v0 |  |
| `bld_necro_d6` | `necro:d6` | creature dwelling: hall of darkness with a black knight banner, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | v0 |  |
| `bld_necro_d7` | `necro:d7` | creature dwelling: dragon vault, a bone crypt with a dragon skull gate, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | v0 |  |
| `bld_necro_u1` | `necro:u1` | upgraded creature dwelling: cursed temple with skeletons, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 2 | v1 | bld_necro_d1.png @60 |
| `bld_necro_u2` | `necro:u2` | upgraded creature dwelling: graveyard with tombstones and an open grave, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 2 | v1 | bld_necro_d2.png @60 |
| `bld_necro_u3` | `necro:u3` | upgraded creature dwelling: tomb of souls with ghostly mist, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 2 | v1 | bld_necro_d3.png @60 |
| `bld_necro_u4` | `necro:u4` | upgraded creature dwelling: vampire estate manor with bats, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 2 | v1 | bld_necro_d4.png @60 |
| `bld_necro_u5` | `necro:u5` | upgraded creature dwelling: mausoleum with a lich statue, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 2 | v1 | bld_necro_d5.png @60 |
| `bld_necro_u6` | `necro:u6` | upgraded creature dwelling: hall of darkness with a black knight banner, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 2 | v1 | bld_necro_d6.png @60 |
| `bld_necro_u7` | `necro:u7` | upgraded creature dwelling: dragon vault, a bone crypt with a dragon skull gate, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 2 | v1 | bld_necro_d7.png @60 |
| `bld_sylvan_hall2` | `sylvan:hall2` | town hall with a big clock tower and a flag, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | v0 |  |
| `bld_sylvan_hall3` | `sylvan:hall3` | grand capitol palace with domes and towers, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | v0 |  |
| `bld_sylvan_fort` | `sylvan:fort` | fortress with crenellated walls, a gate and towers, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | v0 |  |
| `bld_sylvan_market` | `sylvan:market` | marketplace stall with an awning, crates and golden scales, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | v0 |  |
| `bld_sylvan_tavern` | `sylvan:tavern` | tavern with a big hanging beer mug sign, barrels and a bench outside, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | v0 |  |
| `bld_sylvan_mage1` | `sylvan:mage1` | small round mage tower topped by a glowing magic orb, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | v0 |  |
| `bld_sylvan_mage2` | `sylvan:mage2` | tall mage tower with a big glowing rune circle and floating books, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | v0 |  |
| `bld_sylvan_mage3` | `sylvan:mage3` | grand mage guild tower with a crystal spire and arcane glow, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | v0 |  |
| `bld_sylvan_d1` | `sylvan:d1` | creature dwelling: centaur stables of woven branches, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | v0 |  |
| `bld_sylvan_d2` | `sylvan:d2` | creature dwelling: dwarf cottage carved into a rock and tree, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | v0 |  |
| `bld_sylvan_d3` | `sylvan:d3` | creature dwelling: elven homestead treehouse, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | v0 |  |
| `bld_sylvan_d4` | `sylvan:d4` | creature dwelling: enchanted spring with a pegasus fountain, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | v0 |  |
| `bld_sylvan_d5` | `sylvan:d5` | creature dwelling: dendroid arches of living trees, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | v0 |  |
| `bld_sylvan_d6` | `sylvan:d6` | creature dwelling: unicorn glade with a crystal pool, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | v0 |  |
| `bld_sylvan_d7` | `sylvan:d7` | creature dwelling: dragon cliffs with a green dragon nest, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | v0 |  |
| `bld_sylvan_u1` | `sylvan:u1` | upgraded creature dwelling: centaur stables of woven branches, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 2 | v1 | bld_sylvan_d1.png @60 |
| `bld_sylvan_u2` | `sylvan:u2` | upgraded creature dwelling: dwarf cottage carved into a rock and tree, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 2 | v1 | bld_sylvan_d2.png @60 |
| `bld_sylvan_u3` | `sylvan:u3` | upgraded creature dwelling: elven homestead treehouse, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 2 | v1 | bld_sylvan_d3.png @60 |
| `bld_sylvan_u4` | `sylvan:u4` | upgraded creature dwelling: enchanted spring with a pegasus fountain, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 2 | v1 | bld_sylvan_d4.png @60 |
| `bld_sylvan_u5` | `sylvan:u5` | upgraded creature dwelling: dendroid arches of living trees, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 2 | v1 | bld_sylvan_d5.png @60 |
| `bld_sylvan_u6` | `sylvan:u6` | upgraded creature dwelling: unicorn glade with a crystal pool, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 2 | v1 | bld_sylvan_d6.png @60 |
| `bld_sylvan_u7` | `sylvan:u7` | upgraded creature dwelling: dragon cliffs with a green dragon nest, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 2 | v1 | bld_sylvan_d7.png @60 |
| `bld_inferno_hall2` | `inferno:hall2` | town hall with a big clock tower and a flag, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | v0 |  |
| `bld_inferno_hall3` | `inferno:hall3` | grand capitol palace with domes and towers, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | v0 |  |
| `bld_inferno_fort` | `inferno:fort` | fortress with crenellated walls, a gate and towers, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | v0 |  |
| `bld_inferno_market` | `inferno:market` | marketplace stall with an awning, crates and golden scales, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | v0 |  |
| `bld_inferno_tavern` | `inferno:tavern` | tavern with a big hanging beer mug sign, barrels and a bench outside, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | v0 |  |
| `bld_inferno_mage1` | `inferno:mage1` | small round mage tower topped by a glowing magic orb, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | v0 |  |
| `bld_inferno_mage2` | `inferno:mage2` | tall mage tower with a big glowing rune circle and floating books, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | v0 |  |
| `bld_inferno_mage3` | `inferno:mage3` | grand mage guild tower with a crystal spire and arcane glow, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | v0 |  |
| `bld_inferno_d1` | `inferno:d1` | creature dwelling: imp crucible, a bubbling lava cauldron, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | v0 |  |
| `bld_inferno_d2` | `inferno:d2` | creature dwelling: hellhound kennels with chains, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | v0 |  |
| `bld_inferno_d3` | `inferno:d3` | creature dwelling: demon gate, a horned portal, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | v0 |  |
| `bld_inferno_d4` | `inferno:d4` | creature dwelling: hall of sins, a seductive dark pavilion, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | v0 |  |
| `bld_inferno_d5` | `inferno:d5` | creature dwelling: efreet fire lake with a flaming lamp, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | v0 |  |
| `bld_inferno_d6` | `inferno:d6` | creature dwelling: nightmare stables with fiery horseshoes, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | v0 |  |
| `bld_inferno_d7` | `inferno:d7` | creature dwelling: forsaken palace, a towering pit lord citadel, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | v0 |  |
| `bld_inferno_u1` | `inferno:u1` | upgraded creature dwelling: imp crucible, a bubbling lava cauldron, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in inferno style: black obsidian with glowing orange lava cracks and flames | 2 | v1 | bld_inferno_d1.png @60 |
| `bld_inferno_u2` | `inferno:u2` | upgraded creature dwelling: hellhound kennels with chains, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in inferno style: black obsidian with glowing orange lava cracks and flames | 2 | v1 | bld_inferno_d2.png @60 |
| `bld_inferno_u3` | `inferno:u3` | upgraded creature dwelling: demon gate, a horned portal, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in inferno style: black obsidian with glowing orange lava cracks and flames | 2 | v1 | bld_inferno_d3.png @60 |
| `bld_inferno_u4` | `inferno:u4` | upgraded creature dwelling: hall of sins, a seductive dark pavilion, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in inferno style: black obsidian with glowing orange lava cracks and flames | 2 | v1 | bld_inferno_d4.png @60 |
| `bld_inferno_u5` | `inferno:u5` | upgraded creature dwelling: efreet fire lake with a flaming lamp, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in inferno style: black obsidian with glowing orange lava cracks and flames | 2 | v1 | bld_inferno_d5.png @60 |
| `bld_inferno_u6` | `inferno:u6` | upgraded creature dwelling: nightmare stables with fiery horseshoes, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in inferno style: black obsidian with glowing orange lava cracks and flames | 2 | v1 | bld_inferno_d6.png @60 |
| `bld_inferno_u7` | `inferno:u7` | upgraded creature dwelling: forsaken palace, a towering pit lord citadel, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in inferno style: black obsidian with glowing orange lava cracks and flames | 2 | v1 | bld_inferno_d7.png @60 |
| `bld_dungeon_hall2` | `dungeon:hall2` | town hall with a big clock tower and a flag, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | v0 |  |
| `bld_dungeon_hall3` | `dungeon:hall3` | grand capitol palace with domes and towers, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | v0 |  |
| `bld_dungeon_fort` | `dungeon:fort` | fortress with crenellated walls, a gate and towers, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | v0 |  |
| `bld_dungeon_market` | `dungeon:market` | marketplace stall with an awning, crates and golden scales, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | v0 |  |
| `bld_dungeon_tavern` | `dungeon:tavern` | tavern with a big hanging beer mug sign, barrels and a bench outside, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | v0 |  |
| `bld_dungeon_mage1` | `dungeon:mage1` | small round mage tower topped by a glowing magic orb, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | v0 |  |
| `bld_dungeon_mage2` | `dungeon:mage2` | tall mage tower with a big glowing rune circle and floating books, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | v0 |  |
| `bld_dungeon_mage3` | `dungeon:mage3` | grand mage guild tower with a crystal spire and arcane glow, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | v0 |  |
| `bld_dungeon_d1` | `dungeon:d1` | creature dwelling: troglodyte warren, cave holes in a rock, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | v0 |  |
| `bld_dungeon_d2` | `dungeon:d2` | creature dwelling: harpy loft on a jagged crag, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | v0 |  |
| `bld_dungeon_d3` | `dungeon:d3` | creature dwelling: pillar of eyes with a floating eyeball, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | v0 |  |
| `bld_dungeon_d4` | `dungeon:d4` | creature dwelling: medusa chapel with snake statues, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | v0 |  |
| `bld_dungeon_d5` | `dungeon:d5` | creature dwelling: labyrinth entrance with a minotaur horn arch, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | v0 |  |
| `bld_dungeon_d6` | `dungeon:d6` | creature dwelling: manticore lair in a thorny cave, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | v0 |  |
| `bld_dungeon_d7` | `dungeon:d7` | creature dwelling: black dragon cave with glowing crystals, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | v0 |  |
| `bld_dungeon_u1` | `dungeon:u1` | upgraded creature dwelling: troglodyte warren, cave holes in a rock, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in dungeon style: dark cavern stone with glowing purple and teal crystals | 2 | v1 | bld_dungeon_d1.png @60 |
| `bld_dungeon_u2` | `dungeon:u2` | upgraded creature dwelling: harpy loft on a jagged crag, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in dungeon style: dark cavern stone with glowing purple and teal crystals | 2 | v1 | bld_dungeon_d2.png @60 |
| `bld_dungeon_u3` | `dungeon:u3` | upgraded creature dwelling: pillar of eyes with a floating eyeball, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in dungeon style: dark cavern stone with glowing purple and teal crystals | 2 | v1 | bld_dungeon_d3.png @60 |
| `bld_dungeon_u4` | `dungeon:u4` | upgraded creature dwelling: medusa chapel with snake statues, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in dungeon style: dark cavern stone with glowing purple and teal crystals | 2 | v1 | bld_dungeon_d4.png @60 |
| `bld_dungeon_u5` | `dungeon:u5` | upgraded creature dwelling: labyrinth entrance with a minotaur horn arch, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in dungeon style: dark cavern stone with glowing purple and teal crystals | 2 | v1 | bld_dungeon_d5.png @60 |
| `bld_dungeon_u6` | `dungeon:u6` | upgraded creature dwelling: manticore lair in a thorny cave, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in dungeon style: dark cavern stone with glowing purple and teal crystals | 2 | v1 | bld_dungeon_d6.png @60 |
| `bld_dungeon_u7` | `dungeon:u7` | upgraded creature dwelling: black dragon cave with glowing crystals, a grand upgraded fortress version: much taller with extra towers and golden spires, gilded gold roofs and trim, waving banners, radiant golden magical light, in dungeon style: dark cavern stone with glowing purple and teal crystals | 2 | v1 | bld_dungeon_d7.png @60 |

## Map objects (17)

| id | serves | prompt (subject; the category suffix is added) | gens | pick | init |
|---|---|---|---|---|---|
| `obj_chest` | `chest` `treasure` | a wooden treasure chest with iron bands, lid open, overflowing with gold | 1 | v0 |  |
| `obj_artifact` | `artifact` | a glowing golden amulet with a large teal gem on a golden chain, floating, magical sparkles | 2 | v1 |  |
| `obj_campfire` | `campfire` | a small campfire, crossed wooden logs with bright orange flames on a ring of grey stones, isolated object | 1 | v0 |  |
| `obj_goldmine` | `goldmine` | a small isolated rocky mound with a timber-framed mine entrance and a wooden cart full of gold nuggets in front, isolated object | 2 | v0 |  |
| `obj_sawmill` | `sawmill` | a wooden sawmill with a water wheel and a pile of logs | 1 | v0 |  |
| `obj_orepit` | `orepit` | an open ore pit quarry with grey rocks and a pickaxe | 1 | v0 |  |
| `obj_gemmine` | `gemmine` | a small isolated rocky outcrop with a cave mouth and big glowing blue and purple crystals growing out of it, isolated object | 1 | v0 |  |
| `obj_arena` | `arena` | a small round stone colosseum arena with banners | 1 | v0 |  |
| `obj_tower` | `tower` | a slender wizard star tower with a telescope and stars | 1 | v0 |  |
| `obj_library` | `library` | an old library building with stacks of books and scrolls | 1 | v0 |  |
| `obj_stone` | `stone` | a mossy standing learning stone with glowing blue runes | 1 | v0 |  |
| `obj_shrine` | `shrine` | a small marble shrine of magic with a floating glowing blue orb | 1 | v0 |  |
| `obj_well` | `well` | a stone magic well with glowing blue water | 1 | v0 |  |
| `obj_windmill` | `windmill` | a rustic windmill with four sails | 1 | v0 |  |
| `obj_stables` | `stables` | a wooden stable with a brown horse looking out | 1 | v0 |  |
| `obj_dwelling` | `dwelling` | a primitive thatched hut with a wooden fence and a spear | 1 | v0 |  |
| `obj_obelisk` | `obelisk` | a tall dark stone obelisk with a glowing golden eye carving | 1 | v0 |  |

## Crown Run sites (10)

| id | serves | prompt (subject; the category suffix is added) | gens | pick | init |
|---|---|---|---|---|---|
| `site_pandora` | `pandora` | pandora's box, an ornate golden jewelled chest with its lid bursting open, purple and gold magical light erupting out | 2 | v1 |  |
| `site_witchhut` | `witchhut` | a crooked witch hut on chicken legs with a green glowing window | 1 | v0 |  |
| `site_scholar` | `scholar` | a wooden lectern with an open book and a candle | 1 | v0 |  |
| `site_seer` | `seer` | a fortune teller's tent with a glowing crystal ball | 1 | v0 |  |
| `site_merchant` | `merchant` | a merchant's wagon with a canopy, displaying swords and amulets | 1 | v0 |  |
| `site_blackmarket` | `blackmarket` | a dark hooded smuggler stall with a lantern and a sack of loot | 1 | v0 |  |
| `site_tradingpost` | `tradingpost` | a trading post with crates, barrels and a set of golden scales | 1 | v0 |  |
| `site_grail` | `grail` | the holy grail, a jewelled golden chalice glowing with light, legendary relic radiating golden light | 1 | v0 |  |
| `site_keymaster` | `keymaster` | a keymaster's striped tent with a big golden key above it | 1 | v0 |  |
| `site_border` | `border` | a stone border gate archway with a locked iron portcullis and a keyhole | 1 | v0 |  |

## UI glyphs (20)

| id | serves | prompt (subject; the category suffix is added) | gens | pick | init |
|---|---|---|---|---|---|
| `ui_hero` | `hero` | a golden knight helmet with a red plume, front view | 1 | v0 |  |
| `ui_town` | `town` | a small fantasy castle with blue roofs and flags | 1 | v0 |  |
| `ui_end` | `end` | a crescent moon with stars on a dark blue night disc | 1 | v0 |  |
| `ui_lock` | `lock` | a heavy golden padlock | 1 | v0 |  |
| `ui_day` | `day` | a bright golden sun with pointed rays, no face | 1 | v0 |  |
| `ui_calendar` | `calendar` `week` | a parchment calendar page with a grid of day squares and red ring binding on top | 1 | v0 |  |
| `ui_wait` | `wait` | a wooden hourglass with sand | 1 | v0 |  |
| `ui_spellbook` | `spellbook` `spells` `spell` `magic` | a closed purple spellbook with a golden pentacle and gem on the cover | 1 | v0 |  |
| `ui_auto` | `auto` | two crossed swords over a steel cogwheel | 1 | v0 |  |
| `ui_build` | `build` | a builder hammer and a trowel crossed over a stone brick | 1 | v0 |  |
| `ui_recruit` | `recruit` | a round wooden shield with a red pennant spear crossed behind it, bold chunky silhouette | 1 | v0 |  |
| `ui_army` | `army` | a red war banner with crossed swords | 1 | v0 |  |
| `ui_victory` | `victory` `crown` | a golden royal crown inside a golden laurel wreath, radiant | 2 | v1 |  |
| `ui_defeat` | `defeat` `skull` | a cracked bone skull | 1 | v0 |  |
| `ui_music` | `music` | a golden lute with musical notes | 1 | v0 |  |
| `ui_save` | `save` | a rolled parchment scroll with a red wax seal and a quill | 1 | v0 |  |
| `ui_banner` | `banner` | a blue and gold heraldic banner on a pole | 1 | v0 |  |
| `ui_upgrade` | `upgrade` `up` | a round blue badge with a big shining golden upward arrow and sparkles | 1 | v0 |  |
| `ui_dwelling` | `dwelling` | a red canvas army tent with a flag | 1 | v0 |  |
| `ui_quick` | `quick` | a golden fast-forward emblem, two bold golden triangles pointing right with a winged hourglass | 1 | v0 |  |

## Category suffixes

- **portrait:** `epic heroic bust portrait, three-quarter view, chest and head filling the frame, realistic heroic proportions, fierce noble expression, legendary strategy game portrait, painterly HD pixel art, epic high fantasy, dramatic cinematic lighting, strong bright rim light outlining the silhouette, deep rich shadows, rich saturated jewel-tone colours, centered, no text, no background`
- **item:** `legendary fantasy RPG item icon, three-quarter object view, gleaming polished materials, faint magical aura glow, painterly HD pixel art, epic high fantasy, dramatic cinematic lighting, strong bright rim light outlining the silhouette, deep rich shadows, rich saturated jewel-tone colours, centered, no text, no background`
- **spell:** `powerful spell icon, swirling magical energy burst, glowing core, sparks and light particles, painterly HD pixel art, epic high fantasy, dramatic cinematic lighting, strong bright rim light outlining the silhouette, deep rich shadows, rich saturated jewel-tone colours, centered, no text, no background`
- **skill:** `ornate heroic emblem medallion icon, gold filigree rim, embossed relief, gleaming metal, painterly HD pixel art, epic high fantasy, dramatic cinematic lighting, strong bright rim light outlining the silhouette, deep rich shadows, rich saturated jewel-tone colours, centered, no text, no background`
- **building:** `epic fantasy strategy game building icon, isometric three-quarter view, grand architecture, glowing windows, on a small patch of ground, painterly HD pixel art, epic high fantasy, dramatic cinematic lighting, strong bright rim light outlining the silhouette, deep rich shadows, rich saturated jewel-tone colours, centered, no text, no background`
- **crest:** `ornate heraldic coat of arms shield crest, front view, gold filigree, gleaming enamel, glowing emblem, painterly HD pixel art, epic high fantasy, dramatic cinematic lighting, strong bright rim light outlining the silhouette, deep rich shadows, rich saturated jewel-tone colours, centered, no text, no background`
- **ui:** `fantasy strategy game interface icon, bold readable silhouette, gleaming gold and enamel, painterly HD pixel art, epic high fantasy, dramatic cinematic lighting, strong bright rim light outlining the silhouette, deep rich shadows, rich saturated jewel-tone colours, centered, no text, no background`
