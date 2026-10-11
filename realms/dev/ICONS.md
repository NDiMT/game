# Crownforge: icon inventory

Painted icons made with PixelLab (`generate-image-pixflux`, 192×192, transparent, outline "single color black outline", shading "detailed shading", detail "highly detailed", text guidance 8).
Every prompt ends with the shared style suffix: *"fantasy strategy game item icon, painterly HD pixel art, bold single black outline, light from the top left, saturated vivid colours, centered, no text"*. The seed is derived from the id and the attempt (md5("id:n")), so each version is reproducible; it is listed per icon.

Pipeline (scratchpad `icons/`): `pl.py` generates into `raw/<id>_v<n>.png` and logs each call to `ledger.jsonl`; `finalize.py` removes stray specks, trims, centres with a 4 % margin and writes
`art/icons/<id>.png` (192 px master) and `art/icons/<id>.webp` (144 px, q82, shipped). `table.py` / `apply_table.py` regenerate the `ART` table in `icons.js`.

In the game, `icons.js` holds the single `ART` table (kind → game id → file). `icon(name)` uses the painted art for glyph names, and `artIcon(kind, id, size, fallback)` covers artifacts, skills, Legendary Heroes, backgrounds, sets, crests, map objects and sites.
Under 14 px, or with `?art=0` in the URL, the hand-drawn SVG is used. If a file fails to load, it falls back to the SVG.

**Not replaced (by design):** unit portraits and dwellings (rendered from the 3D models, portraits.js); the SVG glyphs `close`, `check`, `more`, `info` and `menu` (crisper as vector at 13–22 px); the `logo` emblem (art/emblem.png).

## Resources and stats

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `res_gold` | `gold` | a heap of shiny gold coins, a few coins standing on edge | 1 | 201263124 | final |
| `res_wood` | `wood` | a neat stack of three chopped brown wooden logs with light round cut ends | 1 | 159899431 | final |
| `res_ore` | `ore` | a pile of grey iron ore rocks with metallic glints | 1 | 264764958 | final |
| `res_gems` | `gems` | a cluster of three cut gemstones, one red ruby, one blue sapphire, one green emerald, sparkling | 1 | 18097966 | final |
| `stat_attack` | `attack`, `att` | a steel sword pointing up diagonally, golden hilt | 1 | 240266037 | final |
| `stat_defense` | `defense`, `def`, `defend` | a blue heater shield with a golden rim and gold cross | 1 | 215999043 | final |
| `stat_power` | `power`, `pow` | a large glowing purple crystal orb in golden prongs on top of a short golden scepter, the orb fills most of the frame, sparkles | 3 | 47237594 | final (v2) |
| `stat_knowledge` | `knowledge`, `know` | an open old spell book with parchment pages and a red ribbon bookmark | 1 | 234229520 | final |
| `stat_morale` | `morale` | a golden war horn with a red tassel | 1 | 118709891 | final |
| `stat_luck` | `luck`, `clover` | a bright green four-leaf clover with a golden sparkle | 1 | 48618768 | final |
| `stat_movement` | `movement`, `move`, `mp`, `spd`, `speed`, `boots` | a brown leather boot with a small white wing on the heel | 1 | 187475576 | final |
| `stat_mana` | `mana` | a glowing blue mana droplet crystal | 1 | 163507317 | final |
| `stat_experience` | `experience`, `xp` | a shining five-pointed golden star | 1 | 12810026 | final |
| `stat_hp` | `hp`, `heart` | a glossy red heart | 1 | 126247102 | final |
| `stat_damage` | `damage`, `dmg` | an orange starburst impact explosion | 1 | 184563987 | final |
| `stat_shots` | `shots`, `ranged` | a leather quiver holding three arrows with clear steel arrowheads and red fletching, tilted | 2 | 63000808 | final (v1) |
| `stat_fly` | `fly` | a single large white feathered angel wing | 1 | 216097773 | final |

## Spells (data.js SPELLS)

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `spell_arrow` | `arrow` | a single glowing blue magic arrow of light flying up to the right, one arrowhead, sparkle trail | 2 | 147999591 | final (v1) |
| `spell_bless` | `bless` | a radiant golden halo with holy light rays and sparkles | 1 | 134591231 | final |
| `spell_stoneskin` | `stoneskin` | a shield made of cracked grey stone with a faint green magic glow | 1 | 116082833 | final |
| `spell_cure` | `cure` | a green glowing healing heart with a white cross and sparkles | 1 | 181886401 | final |
| `spell_haste` | `haste` | a swirling green wind gust with motion lines and a small wing | 1 | 76875225 | final |
| `spell_slow` | `slow` | a purple glowing hourglass wrapped in heavy chains | 1 | 4694970 | final |
| `spell_bolt` | `bolt` | a crackling yellow lightning bolt spell with blue electric glow | 1 | 12413688 | final |
| `spell_fireball` | `fireball` | a blazing orange fireball with a flaming tail | 1 | 113185867 | final |

## Skills (data.js SKILLS), bronze medallions

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `skill_logistics` | `logistics` | round bronze-rimmed medallion with a galloping horse head in the centre | 1 | 124630252 | final |
| `skill_offense` | `offense` | round bronze-rimmed medallion with two crossed swords in the centre | 1 | 155397898 | final |
| `skill_archery` | `archery` | round bronze-rimmed medallion with two crossed arrows in the centre | 1 | 56977638 | final |
| `skill_armorer` | `armorer` | round bronze-rimmed medallion with a shiny steel knight breastplate cuirass in the centre | 2 | 161468597 | final (v1) |
| `skill_wisdom` | `wisdom` | round bronze-rimmed medallion with an unrolled parchment scroll in the centre | 1 | 38749651 | final |
| `skill_sorcery` | `sorcery` | round bronze-rimmed medallion with a glowing purple crystal ball in the centre | 1 | 144367123 | final |
| `skill_leadership` | `leadership` | round bronze-rimmed medallion with a red battle flag in the centre | 1 | 45831570 | final |
| `skill_luck` | `luck` | round bronze-rimmed medallion with a green four-leaf clover in the centre | 1 | 121384593 | final |
| `skill_scouting` | `scouting` | round bronze-rimmed medallion with a long brass spyglass telescope lying diagonally in the centre | 2 | 77878425 | final (v1) |
| `skill_estates` | `estates` | round bronze-rimmed medallion with a bulging coin purse in the centre | 1 | 57892649 | final |
| `skill_necromancy` | `necromancy` | round bronze-rimmed medallion with a glowing green-eyed skull in the centre | 1 | 45339835 | final |

## Artifacts: plain stats + Free Play

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `art_centaur_axe` | `centaur_axe`, `fp:sword` | a heavy double-headed bronze battle axe with two huge curved blades and a short carved wooden handle, upright, blades filling the frame | 3 | 266024641 | final (v2) |
| `art_lion_shield` | `lion_shield`, `fp:shield` | a round golden shield with a roaring lion head emblem | 1 | 173063284 | final |
| `art_staff_embers` | `staff_embers`, `fp:staff` | a short thick gnarled wooden staff held diagonally, its top a burning ember crown with bright orange flames, bold chunky silhouette | 2 | 137350558 | final (v1) |
| `art_helm_command` | `helm_command`, `fp:helm` | a golden knight helmet with a red plume and a small crown circlet | 1 | 127669157 | final |
| `art_shadow_cloak` | `shadow_cloak`, `fp:cloak` | a dark purple hooded cloak with wisps of shadow and a silver clasp | 1 | 237065694 | final |
| `art_judgement` | `judgement`, `fp:blade` | a broad holy greatsword held diagonally with a wide glowing white blade and a golden winged crossguard, bold chunky silhouette | 2 | 52011968 | final (v1) |
| `art_tempest_orb` | `tempest_orb`, `fp:orb` | a glass orb containing a swirling blue storm with tiny lightning, on a silver stand | 1 | 209667555 | final |
| `art_clover` | `clover`, `fp:clover` | a lucky four-leaf clover pendant set in gold | 1 | 268209363 | final |
| `art_valor_badge` | `valor_badge` | a golden medal badge with a red ribbon and a lion on it | 1 | 96495141 | final |
| `art_vitality_ring` | `vitality_ring`, `fp:ring` | a gold ring with a large glowing red heart-shaped ruby | 1 | 16798898 | final |
| `art_speed_boots` | `speed_boots`, `fp:boots` | a pair of green leather boots with golden wings at the ankles | 1 | 7937784 | final |
| `art_pike_pauldron` | `pike_pauldron` | a single steel shoulder pauldron, layered curved armour plates with blue trim and brass rivets, side view | 2 | 67087021 | final (v1) |
| `art_tome` | `fp:tome` | a thick closed leather tome with brass corners and a glowing blue rune on the cover | 1 | 69807166 | final |
| `art_banner_valor` | `fp:banner` | a red and gold war banner on a wooden pole with a golden lion embroidered | 1 | 98926090 | final |

## Artifacts: the five Crown Run sets

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `art_war_drum` | `war_drum` | a war drum with drumsticks, crimson red cloth and blackened iron with a gold wolf-head emblem | 1 | 90520247 | final |
| `art_vanguard_standard` | `vanguard_standard` | a large square crimson battle flag with a gold wolf head, on a short blackened iron pole, bold | 2 | 102489662 | final (v1) |
| `art_executioner_axe` | `executioner_axe` | a huge double-bladed executioner axe, crimson red cloth and blackened iron with a gold wolf-head emblem | 1 | 214000240 | final |
| `art_sentinel_helm` | `sentinel_helm` | a closed knight great helm with a cross eye slit, polished silver with royal blue enamel and a golden sunburst on the brow | 2 | 160133412 | final (v1) |
| `art_sentinel_plate` | `sentinel_plate` | a knight breastplate cuirass, polished silver plate with royal blue enamel and a golden sunburst emblem | 1 | 208896295 | final |
| `art_sentinel_shield` | `sentinel_shield` | a tall tower shield, polished silver plate with royal blue enamel and a golden sunburst emblem | 1 | 113852509 | final |
| `art_plenty_quiver` | `plenty_quiver` | a quiver overflowing with many arrows, dark green elven leather with silver leaf filigree | 1 | 125409903 | final |
| `art_sharpshooter_bow` | `sharpshooter_bow` | an elegant recurve longbow, dark green elven leather with silver leaf filigree | 3 | 115251468 | final |
| `art_elven_bowstring` | `elven_bowstring` | a coiled shimmering silver bowstring wound around a green elven leaf, dark green leather tie, glowing | 2 | 179863564 | final (v1) |
| `art_griffin_cape` | `griffin_cape` | a hooded cloak cape made of tawny golden-brown griffin feathers with a burnished bronze clasp | 2 | 215906187 | final (v1) |
| `art_feathered_boots` | `feathered_boots` | a pair of boots with feathered wings, tawny griffin feathers and burnished bronze | 1 | 149492771 | final |
| `art_talon_ring` | `talon_ring` | a ring shaped like a griffin talon clutching an amber gem, tawny griffin feathers and burnished bronze | 1 | 11804478 | final |
| `art_bone_cloak` | `bone_cloak` | a tattered black cloak with a mantle of ribs and small skulls, bone white with glowing green necrotic runes | 1 | 200933948 | final |
| `art_skull_helm` | `skull_helm` | a horned helmet made from a giant skull, bone white with glowing green necrotic runes | 1 | 103804298 | final |
| `art_vampire_ring` | `vampire_ring` | a ring with a blood red gem held by two fangs, bone white with glowing green necrotic runes | 1 | 177929500 | final |

## Artifacts: singles, economy, faction relics

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `art_last_stand` | `last_stand` | a crystal heart amulet glowing red-gold, cracked but shining, on a chain | 1 | 225435343 | final |
| `art_berserker_helm` | `berserker_helm` | a horned iron viking helmet with red war paint and blood-red glow | 1 | 210674244 | final |
| `art_riposte_bracer` | `riposte_bracer` | a cylindrical forearm vambrace arm guard of steel plates and brown leather straps with one small curved blade spike, armour piece, no sword | 3 | 143774247 | final (v2) |
| `art_iron_oath` | `iron_oath` | a heavy dark iron ring engraved with glowing orange runes | 1 | 108300308 | final |
| `art_trophy_necklace` | `trophy_necklace` | a necklace of beast fangs and claws on a leather cord | 1 | 235839880 | final |
| `art_veteran_medal` | `veteran_medal` | a silver star medal with a blue and gold ribbon | 1 | 99413669 | final |
| `art_hourglass` | `hourglass` | an ornate golden hourglass with glowing sand | 1 | 142111085 | final |
| `art_sky_lances` | `sky_lances` | a pair of sky blue vambraces with small silver lance points and white feathers | 1 | 95716317 | final |
| `art_crown_command` | `crown_command` | a magnificent jewelled golden king crown, radiant golden aura, legendary relic | 1 | 30816073 | final |
| `art_phylactery` | `phylactery` | a small ornate glass phylactery vial with a glowing soul inside, silver filigree, radiant golden aura, legendary relic | 1 | 224776921 | final |
| `art_usurper_crown` | `usurper_crown` | a jagged black iron crown with red gems and dark flames, radiant golden aura, legendary relic | 1 | 108417693 | final |
| `art_miser_ring` | `miser_ring` | a fat gold signet ring engraved with a coin symbol | 1 | 112412679 | final |
| `art_endless_purse` | `endless_purse` | a red velvet coin purse spilling endless gold coins | 1 | 90364571 | final |
| `art_endless_sack` | `endless_sack` | a small wooden mine cart loaded with ore rocks and logs | 1 | 134847206 | final |
| `art_mason_hammer` | `mason_hammer` | a chunky stone mason hammer with a big square steel head and a short wooden handle, crossed with an iron chisel | 2 | 96858332 | final (v1) |
| `art_builders_crown` | `builders_crown` | a bronze circlet crown shaped like a ring of tiny castle towers with battlements and small golden gems, front view | 2 | 253722634 | final (v1) |
| `art_fortress_shield` | `fortress_shield` | a grey stone shield with a castle tower emblem and iron rim | 1 | 200443512 | final |
| `art_sylvan_leaf` | `sylvan_leaf` | a glowing golden-green leaf of the world tree with veins of light | 1 | 68685462 | final |
| `art_inferno_brand` | `inferno_brand` | a thick red-hot iron branding rod held diagonally, glowing horned demon sigil at its end, flames and sparks, bold chunky silhouette | 2 | 152083233 | final (v1) |
| `art_dungeon_eye` | `dungeon_eye` | a purple crystal amulet with a single glowing eye inside | 1 | 41284419 | final |

## Artifact set sigils (crown.js SETS)

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `set_warlord` | `warlord` | a crimson red heraldic shield badge with a blackened iron rim and a gold wolf head emblem | 2 | 83065640 | final (v1) |
| `set_sentinel` | `sentinel` | a heraldic badge with a golden sunburst, polished silver plate with royal blue enamel and a golden sunburst emblem | 1 | 168299295 | final |
| `set_sharpshooter` | `sharpshooter` | a heraldic badge with a silver leaf and an arrow, dark green elven leather with silver leaf filigree | 1 | 210953576 | final |
| `set_wings` | `wings` | a burnished bronze heraldic badge with two spread tawny griffin wings and a griffin head in the centre | 2 | 99731895 | final (v1) |
| `set_undead` | `undead` | a heraldic badge with a crowned skull, bone white with glowing green necrotic runes | 1 | 53090003 | final |

## Legendary Heroes (crown.js GUARDIANS) and hero backgrounds (BACKGROUNDS)

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `guard_wall` | `wall` | bust portrait of a huge grey-skinned ogre warlord with a stone tower shield and iron helmet | 1 | 198306285 | final |
| `guard_plague` | `plague` | bust portrait of a red demon pit lord with horns, surrounded by sickly green plague fumes | 1 | 219561289 | final |
| `guard_lich_queen` | `lich_queen` | bust portrait of a lich queen, skull face with a silver crown, purple hood, glowing green eyes | 1 | 241802332 | final |
| `guard_silence` | `silence` | bust portrait of a dark elf warlock sorceress with purple robes and a finger to her lips | 1 | 47082033 | final |
| `guard_hunger` | `hunger` | bust portrait of a hulking green troll chieftain with tusks and a bone necklace | 1 | 65354056 | final |
| `guard_gale` | `gale` | bust portrait of an elven druid woman with green hood and swirling wind leaves | 1 | 187974150 | final |
| `guard_eclipse` | `eclipse` | bust portrait of a dark sorceress overlord with a black eclipse sun halo behind her | 1 | 57765401 | final |
| `guard_stampede` | `stampede` | bust portrait of a demon knight in black and red armour with flaming horns | 1 | 130381077 | final |
| `guard_iron_hide` | `iron_hide` | bust portrait of a fallen paladin knight in tarnished dark steel armour with a cracked halo | 1 | 156461990 | final |
| `bg_knight` | `knight` | bust portrait of a young knight-errant with a blue tabard and a sword over the shoulder | 1 | 267140792 | final |
| `bg_merchant` | `merchant` | bust portrait of a rich merchant prince with a feathered hat and gold coins | 1 | 108040467 | final |
| `bg_warlord` | `warlord` | bust portrait of a scarred warlord with a fur mantle and a horned helmet | 1 | 224613491 | final |
| `bg_exile` | `exile` | bust portrait of a hooded exile wanderer in a ragged grey cloak | 1 | 90730693 | final |
| `bg_scholar` | `scholar` | bust portrait of an old bearded scholar mage with spectacles and a book | 1 | 238463203 | final |
| `bg_gravecaller` | `gravecaller` | bust portrait of a pale necromancer with a bone staff and green ghostly glow | 1 | 82531414 | final |
| `bg_siegelord` | `siegelord` | bust portrait of a siege engineer lord in heavy armour with a castle tower behind | 1 | 122855797 | final |

## Faction crests

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `crest_haven` | `haven` | royal blue heraldic shield crest with a golden griffin and gold trim | 1 | 179164187 | final |
| `crest_necro` | `necro` | crimson and black heraldic shield crest with a bone-white skull and gold trim | 1 | 97815467 | final |
| `crest_sylvan` | `sylvan` | emerald green heraldic shield crest with a golden great oak tree and gold trim | 1 | 141405638 | final |
| `crest_inferno` | `inferno` | fiery orange heraldic shield crest with a horned demon skull in flames and gold trim | 1 | 248245592 | final |
| `crest_dungeon` | `dungeon` | deep purple heraldic shield crest with a black dragon and gold trim | 1 | 103242734 | final |

## Town buildings (data.js BUILDINGS, non-dwelling)

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `bld_hall2` | `hall2`, `village`, `hall` | a stone town hall building with a red roof and a clock tower | 1 | 77147256 | final |
| `bld_hall3` | `hall3` | a grand marble city hall palace with golden domes | 1 | 229404061 | final |
| `bld_fort` | `fort` | a grey stone fort with crenellated walls, a gate and two towers | 1 | 215887702 | final |
| `bld_market` | `market` | a market stall with a striped awning, crates and golden scales | 1 | 17640751 | final |
| `bld_tavern` | `tavern` | a cosy timber tavern with a hanging sign and a foaming ale mug | 1 | 21574450 | final |
| `bld_mage1` | `mage1`, `mage`, `guild` | a small stone mage tower with a blue pointed roof and glowing window | 1 | 3664746 | final |
| `bld_mage2` | `mage2` | a tall stone mage tower with a green pointed roof and floating runes | 1 | 255791047 | final |
| `bld_mage3` | `mage3` | a grand mage tower with a red pointed roof, crystal spire and arcane glow | 1 | 151146512 | final |

## Map objects (data.js OBJECTS) and Crown Run sites

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `obj_chest` | `chest`, `treasure` | a wooden treasure chest with iron bands, lid open, overflowing with gold | 1 | 58687960 | final |
| `obj_artifact` | `artifact` | a glowing golden amulet with a teal gem, magical sparkles | 1 | 106996751 | final |
| `obj_campfire` | `campfire` | a small campfire, crossed wooden logs with bright orange flames on a ring of grey stones, isolated object | 2 | 201023612 | final (v1) |
| `obj_goldmine` | `goldmine` | a small isolated rocky mound with a timber-framed mine entrance and a wooden cart full of gold nuggets in front, isolated object | 2 | 147195374 | final (v1) |
| `obj_sawmill` | `sawmill` | a wooden sawmill with a water wheel and a pile of logs | 1 | 218099123 | final |
| `obj_orepit` | `orepit` | an open ore pit quarry with grey rocks and a pickaxe | 1 | 152376614 | final |
| `obj_gemmine` | `gemmine` | a small isolated rocky outcrop with a cave mouth and big glowing blue and purple crystals growing out of it, isolated object | 2 | 58045625 | final (v1) |
| `obj_arena` | `arena` | a small round stone colosseum arena with banners | 1 | 238596118 | final |
| `obj_tower` | `tower` | a slender wizard star tower with a telescope and stars | 1 | 166550604 | final |
| `obj_library` | `library` | an old library building with stacks of books and scrolls | 1 | 83190203 | final |
| `obj_stone` | `stone` | a mossy standing learning stone with glowing blue runes | 1 | 257146883 | final |
| `obj_shrine` | `shrine` | a small marble shrine of magic with a floating glowing blue orb | 1 | 152348598 | final |
| `obj_well` | `well` | a stone magic well with glowing blue water | 1 | 238819314 | final |
| `obj_windmill` | `windmill` | a rustic windmill with four sails | 1 | 104642369 | final |
| `obj_stables` | `stables` | a wooden stable with a brown horse looking out | 1 | 84068811 | final |
| `obj_dwelling` | `dwelling` | a primitive thatched hut with a wooden fence and a spear | 1 | 165913637 | final |
| `obj_obelisk` | `obelisk` | a tall dark stone obelisk with a glowing golden eye carving | 1 | 252462760 | final |
| `site_pandora` | `pandora` | an ornate magical box with a lid open and purple and gold light bursting out | 1 | 38501130 | final |
| `site_witchhut` | `witchhut` | a crooked witch hut on chicken legs with a green glowing window | 1 | 252122580 | final |
| `site_scholar` | `scholar` | a wooden lectern with an open book and a candle | 1 | 1703968 | final |
| `site_seer` | `seer` | a fortune teller's tent with a glowing crystal ball | 1 | 205532841 | final |
| `site_merchant` | `merchant` | a merchant's wagon with a canopy, displaying swords and amulets | 1 | 247725350 | final |
| `site_blackmarket` | `blackmarket` | a dark hooded smuggler stall with a lantern and a sack of loot | 1 | 96269266 | final |
| `site_tradingpost` | `tradingpost` | a trading post with crates, barrels and a set of golden scales | 1 | 246869301 | final |
| `site_grail` | `grail` | the holy grail, a jewelled golden chalice glowing with light, radiant golden aura, legendary relic | 1 | 220609178 | final |
| `site_keymaster` | `keymaster` | a keymaster's striped tent with a big golden key above it | 1 | 189498033 | final |
| `site_border` | `border` | a stone border gate archway with a locked iron portcullis and a keyhole | 1 | 29044155 | final |

## UI glyphs

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `ui_hero` | `hero` | a golden knight helmet with a red plume, front view | 1 | 36597782 | final |
| `ui_town` | `town` | a small fantasy castle with blue roofs and flags | 1 | 247961227 | final |
| `ui_end` | `end` | a crescent moon with stars on a dark blue night disc | 1 | 261671471 | final |
| `ui_lock` | `lock` | a heavy golden padlock | 1 | 239366584 | final |
| `ui_day` | `day` | a bright golden sun with pointed rays, no face | 2 | 159418888 | final (v1) |
| `ui_calendar` | `calendar`, `week` | a parchment calendar page with a grid of day squares and red ring binding on top | 2 | 148260268 | final (v1) |
| `ui_wait` | `wait` | a wooden hourglass with sand | 1 | 254211444 | final |
| `ui_spellbook` | `spellbook`, `spells`, `spell`, `magic` | a closed purple spellbook with a golden pentacle and gem on the cover | 1 | 157104478 | final |
| `ui_auto` | `auto` | two crossed swords over a steel cogwheel | 1 | 73678533 | final |
| `ui_build` | `build` | a builder hammer and a trowel crossed over a stone brick | 1 | 252557790 | final |
| `ui_recruit` | `recruit` | a round wooden shield with a red pennant spear crossed behind it, bold chunky silhouette | 2 | 108830310 | final (v1) |
| `ui_army` | `army` | a red war banner with crossed swords | 1 | 142558900 | final |
| `ui_victory` | `victory`, `crown` | a golden laurel wreath around a golden crown | 1 | 16608846 | final |
| `ui_defeat` | `defeat`, `skull` | a cracked bone skull | 1 | 56523528 | final |
| `ui_music` | `music` | a golden lute with musical notes | 1 | 262591489 | final |
| `ui_save` | `save` | a rolled parchment scroll with a red wax seal and a quill | 1 | 158528517 | final |
| `ui_banner` | `banner` | a blue and gold heraldic banner on a pole | 1 | 27056647 | final |
| `ui_upgrade` | `upgrade`, `up` | a round blue badge with a big shining golden upward arrow and sparkles | 2 | 260095098 | final (v1) |
| `ui_dwelling` | `dwelling` | a red canvas army tent with a flag | 1 | 176929368 | final |
| `ui_quick` | `quick` | a golden fast-forward emblem, two bold golden triangles pointing right with a winged hourglass | 1 | 200982307 | final |

## Totals

- icons: 166; shipped: 166
- PixelLab generations: 201 (style tests: 4), i.e. 1.21 per icon
- shipped WebP total: 1129 KB; PNG masters: 7019 KB (not downloaded by the game)
