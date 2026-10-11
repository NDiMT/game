# Crownforge: icon inventory

Painted icons made with PixelLab (`generate-image-pixflux`, 192×192, transparent, outline "single color black outline", shading "detailed shading", detail "highly detailed", text guidance 8).
Every prompt ends with the shared style suffix: *"fantasy strategy game item icon, painterly HD pixel art, bold single black outline, light from the top left, saturated vivid colours, centered, no text"*. The seed is derived from the id and the attempt (md5("id:n")), so each version is reproducible; it is listed per icon.

Pipeline (scratchpad `icons/`): `pl.py` generates into `raw/<id>_v<n>.png` and logs each call to `ledger.jsonl`; `finalize.py` removes stray specks, trims, centres with a 4 % margin and writes
`dev/icon_masters/<id>.png` (192 px master) and `art/icons/<id>.webp` (144 px, q82, shipped). `table.py` / `apply_table.py` regenerate the `ART` table in `icons.js`.

In the game, `icons.js` holds the single `ART` table (kind → game id → file). `icon(name)` uses the painted art for glyph names, and `artIcon(kind, id, size, fallback)` covers artifacts, skills, Legendary Heroes, backgrounds, sets, crests, map objects and sites.
Under 14 px, or with `?art=0` in the URL, the hand-drawn SVG is used. If a file fails to load, it falls back to the SVG.

**Portraits:** `portraits.js` draws the painted creature / hero art (ART.unit / ART.hero) on the usual faction backdrop inside the usual gold frame (upgrade star, player-colour plate, round crop), through the same cache / LRU / async machinery; the 3D bust is only used until the art has loaded or if it fails. The img2img inputs are the 3D models rendered raw (shape `raw`, transparent, no frame).
**Buildings:** `artIcon('building', fac + ':' + id)` per faction (incl. every dwelling and upgraded dwelling), falling back to the generic building art.
**Coverage:** `node realms/dev/icon_coverage.mjs` checks that every id the game can show has a WebP.

**Not replaced (by design):** the SVG glyphs `close`, `check`, `more`, `info` and `menu` (crisper as vector at 13–22 px); the `logo` emblem (art/emblem.png).

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

## Haven town buildings (art key haven:<building id>)

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `bld_haven_hall2` | `haven:hall2` | isometric town hall with a big clock tower and a flag, in haven style: white stone and blue roofs | 2 | 245387929 | final (v1) |
| `bld_haven_hall3` | `haven:hall3` | isometric grand capitol palace with domes and towers, white stone walls and bright blue roofs with gold trim, knightly | 1 | 67116747 | final |
| `bld_haven_fort` | `haven:fort` | isometric fortress with crenellated walls, a gate and towers, white stone walls and bright blue roofs with gold trim, knightly | 1 | 255462533 | final |
| `bld_haven_market` | `haven:market` | isometric marketplace stall with an awning, crates and golden scales, white stone walls and bright blue roofs with gold trim, knightly | 1 | 263307636 | final |
| `bld_haven_tavern` | `haven:tavern` | isometric tavern with a big hanging beer mug sign, barrels and a bench outside, in haven style: white stone and blue roofs | 2 | 209477108 | final (v1) |
| `bld_haven_mage1` | `haven:mage1` | isometric small round mage tower topped by a glowing magic orb, in haven style: white stone and blue roofs | 2 | 123250191 | final (v1) |
| `bld_haven_mage2` | `haven:mage2` | isometric tall mage tower with a big glowing rune circle and floating books, in haven style: white stone and blue roofs | 2 | 185461299 | final (v1) |
| `bld_haven_mage3` | `haven:mage3` | isometric grand mage guild tower with a crystal spire and arcane glow, white stone walls and bright blue roofs with gold trim, knightly | 1 | 67569611 | final |
| `bld_haven_d1` | `haven:d1` | isometric creature dwelling: guardhouse with pikes and a shield, white stone walls and bright blue roofs with gold trim, knightly | 1 | 131498833 | final |
| `bld_haven_d2` | `haven:d2` | isometric creature dwelling: archers' tower with a big red and white archery target and bows, in haven style: white stone and blue roofs | 2 | 50560870 | final (v1) |
| `bld_haven_d3` | `haven:d3` | isometric creature dwelling: tower with a huge straw nest on top and a golden griffin sitting in it, in haven style: white stone and blue roofs | 2 | 99377703 | final (v1) |
| `bld_haven_d4` | `haven:d4` | isometric creature dwelling: barracks with crossed swords over the door and weapon racks, in haven style: white stone and blue roofs | 2 | 230127097 | final (v1) |
| `bld_haven_d5` | `haven:d5` | isometric creature dwelling: monastery with a bell tower, white stone walls and bright blue roofs with gold trim, knightly | 1 | 260229237 | final |
| `bld_haven_d6` | `haven:d6` | isometric creature dwelling: jousting yard with a horse, lances and striped tents, in haven style: white stone and blue roofs | 2 | 156157941 | final (v1) |
| `bld_haven_d7` | `haven:d7` | isometric creature dwelling: portal of glory, a radiant golden archway with angel wings, white stone walls and bright blue roofs with gold trim, knightly | 1 | 15535164 | final |

## Haven upgraded dwellings (img2img from the base dwelling, strength 60)

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `bld_haven_u1` | `haven:u1` | isometric upgraded creature dwelling: guardhouse with pikes and a shield, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in haven style: white stone and blue roofs | 2 | 28241745 | final (v1) |
| `bld_haven_u2` | `haven:u2` | isometric upgraded creature dwelling: archers' tower with a big red and white archery target and bows, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in haven style: white stone and blue roofs | 2 | 249028010 | final (v1) |
| `bld_haven_u3` | `haven:u3` | isometric upgraded creature dwelling: tower with a huge straw nest on top and a golden griffin sitting in it, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in haven style: white stone and blue roofs | 2 | 172336338 | final (v1) |
| `bld_haven_u4` | `haven:u4` | isometric upgraded creature dwelling: barracks with crossed swords over the door and weapon racks, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in haven style: white stone and blue roofs | 2 | 248461558 | final (v1) |
| `bld_haven_u5` | `haven:u5` | isometric upgraded creature dwelling: monastery with a bell tower, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in haven style: white stone and blue roofs | 2 | 54766763 | final (v1) |
| `bld_haven_u6` | `haven:u6` | isometric upgraded creature dwelling: jousting yard with a horse, lances and striped tents, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in haven style: white stone and blue roofs | 2 | 114850093 | final (v1) |
| `bld_haven_u7` | `haven:u7` | isometric upgraded creature dwelling: portal of glory, a radiant golden archway with angel wings, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in haven style: white stone and blue roofs | 2 | 33329358 | final (v1) |

## Necropolis town buildings (art key necro:<building id>)

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `bld_necro_hall2` | `necro:hall2` | isometric town hall with a big clock tower and a flag, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | 186113126 | final |
| `bld_necro_hall3` | `necro:hall3` | isometric grand capitol palace with domes and towers, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | 186596435 | final |
| `bld_necro_fort` | `necro:fort` | isometric fortress with crenellated walls, a gate and towers, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | 125174374 | final |
| `bld_necro_market` | `necro:market` | isometric marketplace stall with an awning, crates and golden scales, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | 172542312 | final |
| `bld_necro_tavern` | `necro:tavern` | isometric tavern with a big hanging beer mug sign, barrels and a bench outside, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | 184922930 | final |
| `bld_necro_mage1` | `necro:mage1` | isometric small round mage tower topped by a glowing magic orb, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | 36436949 | final |
| `bld_necro_mage2` | `necro:mage2` | isometric tall mage tower with a big glowing rune circle and floating books, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | 90385552 | final |
| `bld_necro_mage3` | `necro:mage3` | isometric grand mage guild tower with a crystal spire and arcane glow, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | 93581824 | final |
| `bld_necro_d1` | `necro:d1` | isometric creature dwelling: cursed temple with skeletons, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | 35424284 | final |
| `bld_necro_d2` | `necro:d2` | isometric creature dwelling: graveyard with tombstones and an open grave, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | 154845488 | final |
| `bld_necro_d3` | `necro:d3` | isometric creature dwelling: tomb of souls with ghostly mist, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | 25995951 | final |
| `bld_necro_d4` | `necro:d4` | isometric creature dwelling: vampire estate manor with bats, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | 69979914 | final |
| `bld_necro_d5` | `necro:d5` | isometric creature dwelling: mausoleum with a lich statue, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | 116338759 | final |
| `bld_necro_d6` | `necro:d6` | isometric creature dwelling: hall of darkness with a black knight banner, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | 9628293 | final |
| `bld_necro_d7` | `necro:d7` | isometric creature dwelling: dragon vault, a bone crypt with a dragon skull gate, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 1 | 222253593 | final |

## Necropolis upgraded dwellings (img2img from the base dwelling, strength 60)

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `bld_necro_u1` | `necro:u1` | isometric upgraded creature dwelling: cursed temple with skeletons, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 2 | 202346747 | final (v1) |
| `bld_necro_u2` | `necro:u2` | isometric upgraded creature dwelling: graveyard with tombstones and an open grave, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 2 | 146348849 | final (v1) |
| `bld_necro_u3` | `necro:u3` | isometric upgraded creature dwelling: tomb of souls with ghostly mist, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 2 | 105851238 | final (v1) |
| `bld_necro_u4` | `necro:u4` | isometric upgraded creature dwelling: vampire estate manor with bats, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 2 | 168559693 | final (v1) |
| `bld_necro_u5` | `necro:u5` | isometric upgraded creature dwelling: mausoleum with a lich statue, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 2 | 255655891 | final (v1) |
| `bld_necro_u6` | `necro:u6` | isometric upgraded creature dwelling: hall of darkness with a black knight banner, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 2 | 66760749 | final (v1) |
| `bld_necro_u7` | `necro:u7` | isometric upgraded creature dwelling: dragon vault, a bone crypt with a dragon skull gate, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in necro style: bone white and dark purple gothic stone, spikes, eerie green glow | 2 | 453609 | final (v1) |

## Sylvan town buildings (art key sylvan:<building id>)

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `bld_sylvan_hall2` | `sylvan:hall2` | isometric town hall with a big clock tower and a flag, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | 194134666 | final |
| `bld_sylvan_hall3` | `sylvan:hall3` | isometric grand capitol palace with domes and towers, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | 44275159 | final |
| `bld_sylvan_fort` | `sylvan:fort` | isometric fortress with crenellated walls, a gate and towers, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | 160119445 | final |
| `bld_sylvan_market` | `sylvan:market` | isometric marketplace stall with an awning, crates and golden scales, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | 29243252 | final |
| `bld_sylvan_tavern` | `sylvan:tavern` | isometric tavern with a big hanging beer mug sign, barrels and a bench outside, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | 99218013 | final |
| `bld_sylvan_mage1` | `sylvan:mage1` | isometric small round mage tower topped by a glowing magic orb, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | 204072158 | final |
| `bld_sylvan_mage2` | `sylvan:mage2` | isometric tall mage tower with a big glowing rune circle and floating books, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | 259245388 | final |
| `bld_sylvan_mage3` | `sylvan:mage3` | isometric grand mage guild tower with a crystal spire and arcane glow, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | 153313535 | final |
| `bld_sylvan_d1` | `sylvan:d1` | isometric creature dwelling: centaur stables of woven branches, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | 126417873 | final |
| `bld_sylvan_d2` | `sylvan:d2` | isometric creature dwelling: dwarf cottage carved into a rock and tree, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | 202112286 | final |
| `bld_sylvan_d3` | `sylvan:d3` | isometric creature dwelling: elven homestead treehouse, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | 50019824 | final |
| `bld_sylvan_d4` | `sylvan:d4` | isometric creature dwelling: enchanted spring with a pegasus fountain, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | 150299840 | final |
| `bld_sylvan_d5` | `sylvan:d5` | isometric creature dwelling: dendroid arches of living trees, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | 177603381 | final |
| `bld_sylvan_d6` | `sylvan:d6` | isometric creature dwelling: unicorn glade with a crystal pool, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | 25384873 | final |
| `bld_sylvan_d7` | `sylvan:d7` | isometric creature dwelling: dragon cliffs with a green dragon nest, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 1 | 122370140 | final |

## Sylvan upgraded dwellings (img2img from the base dwelling, strength 60)

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `bld_sylvan_u1` | `sylvan:u1` | isometric upgraded creature dwelling: centaur stables of woven branches, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 2 | 208265904 | final (v1) |
| `bld_sylvan_u2` | `sylvan:u2` | isometric upgraded creature dwelling: dwarf cottage carved into a rock and tree, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 2 | 209895030 | final (v1) |
| `bld_sylvan_u3` | `sylvan:u3` | isometric upgraded creature dwelling: elven homestead treehouse, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 2 | 159065595 | final (v1) |
| `bld_sylvan_u4` | `sylvan:u4` | isometric upgraded creature dwelling: enchanted spring with a pegasus fountain, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 2 | 139242696 | final (v1) |
| `bld_sylvan_u5` | `sylvan:u5` | isometric upgraded creature dwelling: dendroid arches of living trees, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 2 | 235588008 | final (v1) |
| `bld_sylvan_u6` | `sylvan:u6` | isometric upgraded creature dwelling: unicorn glade with a crystal pool, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 2 | 260020870 | final (v1) |
| `bld_sylvan_u7` | `sylvan:u7` | isometric upgraded creature dwelling: dragon cliffs with a green dragon nest, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in sylvan style: living wood and lush green leaves, tree trunks, vines and flowers | 2 | 6244917 | final (v1) |

## Inferno town buildings (art key inferno:<building id>)

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `bld_inferno_hall2` | `inferno:hall2` | isometric town hall with a big clock tower and a flag, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | 28768354 | final |
| `bld_inferno_hall3` | `inferno:hall3` | isometric grand capitol palace with domes and towers, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | 78568722 | final |
| `bld_inferno_fort` | `inferno:fort` | isometric fortress with crenellated walls, a gate and towers, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | 34748475 | final |
| `bld_inferno_market` | `inferno:market` | isometric marketplace stall with an awning, crates and golden scales, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | 143120690 | final |
| `bld_inferno_tavern` | `inferno:tavern` | isometric tavern with a big hanging beer mug sign, barrels and a bench outside, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | 112010058 | final |
| `bld_inferno_mage1` | `inferno:mage1` | isometric small round mage tower topped by a glowing magic orb, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | 108093535 | final |
| `bld_inferno_mage2` | `inferno:mage2` | isometric tall mage tower with a big glowing rune circle and floating books, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | 135846168 | final |
| `bld_inferno_mage3` | `inferno:mage3` | isometric grand mage guild tower with a crystal spire and arcane glow, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | 244454059 | final |
| `bld_inferno_d1` | `inferno:d1` | isometric creature dwelling: imp crucible, a bubbling lava cauldron, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | 116806657 | final |
| `bld_inferno_d2` | `inferno:d2` | isometric creature dwelling: hellhound kennels with chains, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | 33655735 | final |
| `bld_inferno_d3` | `inferno:d3` | isometric creature dwelling: demon gate, a horned portal, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | 53485407 | final |
| `bld_inferno_d4` | `inferno:d4` | isometric creature dwelling: hall of sins, a seductive dark pavilion, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | 118821719 | final |
| `bld_inferno_d5` | `inferno:d5` | isometric creature dwelling: efreet fire lake with a flaming lamp, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | 12766398 | final |
| `bld_inferno_d6` | `inferno:d6` | isometric creature dwelling: nightmare stables with fiery horseshoes, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | 21995998 | final |
| `bld_inferno_d7` | `inferno:d7` | isometric creature dwelling: forsaken palace, a towering pit lord citadel, in inferno style: black obsidian with glowing orange lava cracks and flames | 1 | 194582699 | final |

## Inferno upgraded dwellings (img2img from the base dwelling, strength 60)

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `bld_inferno_u1` | `inferno:u1` | isometric upgraded creature dwelling: imp crucible, a bubbling lava cauldron, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in inferno style: black obsidian with glowing orange lava cracks and flames | 2 | 253756278 | final (v1) |
| `bld_inferno_u2` | `inferno:u2` | isometric upgraded creature dwelling: hellhound kennels with chains, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in inferno style: black obsidian with glowing orange lava cracks and flames | 2 | 238376382 | final (v1) |
| `bld_inferno_u3` | `inferno:u3` | isometric upgraded creature dwelling: demon gate, a horned portal, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in inferno style: black obsidian with glowing orange lava cracks and flames | 2 | 260704293 | final (v1) |
| `bld_inferno_u4` | `inferno:u4` | isometric upgraded creature dwelling: hall of sins, a seductive dark pavilion, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in inferno style: black obsidian with glowing orange lava cracks and flames | 2 | 235272502 | final (v1) |
| `bld_inferno_u5` | `inferno:u5` | isometric upgraded creature dwelling: efreet fire lake with a flaming lamp, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in inferno style: black obsidian with glowing orange lava cracks and flames | 2 | 222425412 | final (v1) |
| `bld_inferno_u6` | `inferno:u6` | isometric upgraded creature dwelling: nightmare stables with fiery horseshoes, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in inferno style: black obsidian with glowing orange lava cracks and flames | 2 | 192767244 | final (v1) |
| `bld_inferno_u7` | `inferno:u7` | isometric upgraded creature dwelling: forsaken palace, a towering pit lord citadel, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in inferno style: black obsidian with glowing orange lava cracks and flames | 2 | 25591057 | final (v1) |

## Dungeon town buildings (art key dungeon:<building id>)

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `bld_dungeon_hall2` | `dungeon:hall2` | isometric town hall with a big clock tower and a flag, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | 199820774 | final |
| `bld_dungeon_hall3` | `dungeon:hall3` | isometric grand capitol palace with domes and towers, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | 127491837 | final |
| `bld_dungeon_fort` | `dungeon:fort` | isometric fortress with crenellated walls, a gate and towers, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | 155192107 | final |
| `bld_dungeon_market` | `dungeon:market` | isometric marketplace stall with an awning, crates and golden scales, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | 55378687 | final |
| `bld_dungeon_tavern` | `dungeon:tavern` | isometric tavern with a big hanging beer mug sign, barrels and a bench outside, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | 44249603 | final |
| `bld_dungeon_mage1` | `dungeon:mage1` | isometric small round mage tower topped by a glowing magic orb, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | 32503982 | final |
| `bld_dungeon_mage2` | `dungeon:mage2` | isometric tall mage tower with a big glowing rune circle and floating books, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | 59188936 | final |
| `bld_dungeon_mage3` | `dungeon:mage3` | isometric grand mage guild tower with a crystal spire and arcane glow, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | 87007008 | final |
| `bld_dungeon_d1` | `dungeon:d1` | isometric creature dwelling: troglodyte warren, cave holes in a rock, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | 69393905 | final |
| `bld_dungeon_d2` | `dungeon:d2` | isometric creature dwelling: harpy loft on a jagged crag, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | 210425190 | final |
| `bld_dungeon_d3` | `dungeon:d3` | isometric creature dwelling: pillar of eyes with a floating eyeball, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | 256387095 | final |
| `bld_dungeon_d4` | `dungeon:d4` | isometric creature dwelling: medusa chapel with snake statues, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | 99743274 | final |
| `bld_dungeon_d5` | `dungeon:d5` | isometric creature dwelling: labyrinth entrance with a minotaur horn arch, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | 122481534 | final |
| `bld_dungeon_d6` | `dungeon:d6` | isometric creature dwelling: manticore lair in a thorny cave, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | 238384625 | final |
| `bld_dungeon_d7` | `dungeon:d7` | isometric creature dwelling: black dragon cave with glowing crystals, in dungeon style: dark cavern stone with glowing purple and teal crystals | 1 | 152084801 | final |

## Dungeon upgraded dwellings (img2img from the base dwelling, strength 60)

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `bld_dungeon_u1` | `dungeon:u1` | isometric upgraded creature dwelling: troglodyte warren, cave holes in a rock, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in dungeon style: dark cavern stone with glowing purple and teal crystals | 2 | 28726860 | final (v1) |
| `bld_dungeon_u2` | `dungeon:u2` | isometric upgraded creature dwelling: harpy loft on a jagged crag, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in dungeon style: dark cavern stone with glowing purple and teal crystals | 2 | 179599437 | final (v1) |
| `bld_dungeon_u3` | `dungeon:u3` | isometric upgraded creature dwelling: pillar of eyes with a floating eyeball, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in dungeon style: dark cavern stone with glowing purple and teal crystals | 2 | 240356872 | final (v1) |
| `bld_dungeon_u4` | `dungeon:u4` | isometric upgraded creature dwelling: medusa chapel with snake statues, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in dungeon style: dark cavern stone with glowing purple and teal crystals | 2 | 211865282 | final (v1) |
| `bld_dungeon_u5` | `dungeon:u5` | isometric upgraded creature dwelling: labyrinth entrance with a minotaur horn arch, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in dungeon style: dark cavern stone with glowing purple and teal crystals | 2 | 62839908 | final (v1) |
| `bld_dungeon_u6` | `dungeon:u6` | isometric upgraded creature dwelling: manticore lair in a thorny cave, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in dungeon style: dark cavern stone with glowing purple and teal crystals | 2 | 86820396 | final (v1) |
| `bld_dungeon_u7` | `dungeon:u7` | isometric upgraded creature dwelling: black dragon cave with glowing crystals, UPGRADED: bigger, grander and taller, with extra towers, shining gold roof trim, gold banners and glowing windows, in dungeon style: dark cavern stone with glowing purple and teal crystals | 2 | 50330921 | final (v1) |

## Haven creature portraits (img2img from the 3D portrait, strength 120)

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `unit_pikeman` | `pikeman` | bust portrait of a sturdy human pikeman facing the viewer, steel kettle helmet, red sash over a blue tabard, holding a pike, three-quarter view facing the viewer, cute chibi proportions, game unit portrait, whole figure inside the frame | 2 | 19527657 | final (v1) |
| `unit_archer` | `archer` | bust portrait of a human archer in a green hood and leather jerkin holding a bow, three-quarter view, cute chibi proportions, game unit portrait | 1 | 263649738 | final |
| `unit_griffin` | `griffin` | bust portrait of a griffin with a golden eagle head, white feathered neck and brown wings, three-quarter view, cute chibi proportions, game unit portrait | 1 | 18629289 | final |
| `unit_swordsman` | `swordsman` | bust portrait of a human swordsman knight in silver plate armour with a sword and shield, three-quarter view, cute chibi proportions, game unit portrait | 1 | 210663587 | final |
| `unit_monk` | `monk` | bust portrait of a bald human monk in brown and orange robes holding a glowing staff, three-quarter view, cute chibi proportions, game unit portrait | 1 | 189559676 | final |
| `unit_cavalier` | `cavalier` | bust portrait of a knight cavalier in silver plate armour with a white plumed helmet riding a white warhorse with blue caparison, holding a lance, three-quarter view, cute chibi proportions, game unit portrait | 2 | 37880731 | final (v1) |
| `unit_angel` | `angel` | bust portrait of a radiant angel warrior with white feathered wings, golden armour and a flaming sword, three-quarter view, cute chibi proportions, game unit portrait | 1 | 103300293 | final |
| `unit_halberdier` | `halberdier` | bust portrait of a human halberdier in a steel helmet and blue tabard holding a halberd, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 63327430 | final |
| `unit_marksman` | `marksman` | bust portrait of a human marksman with a feathered hat and a crossbow, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 208714285 | final |
| `unit_royalgriffin` | `royalgriffin` | bust portrait of a royal griffin with a golden eagle head, white mane and golden wings, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 30128808 | final |
| `unit_crusader` | `crusader` | bust portrait of a crusader knight in white and gold plate armour with a red cross and a sword, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 169593316 | final |
| `unit_zealot` | `zealot` | bust portrait of a zealot priest in white and gold robes holding a glowing holy staff, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 33528658 | final |
| `unit_champion` | `champion` | bust portrait of a champion knight in gold and blue plate armour with a white plume riding an armoured warhorse, long lance, upgraded elite version with gold trim, three-quarter view facing the viewer, cute chibi proportions, game unit portrait, whole figure inside the frame | 2 | 78189809 | final (v1) |
| `unit_archangel` | `archangel` | bust portrait of an archangel with large white wings, shining golden armour and a holy sword, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 3892316 | final |

## Necropolis creature portraits (img2img from the 3D portrait, strength 120)

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `unit_skeleton` | `skeleton` | bust portrait of a grinning skeleton warrior with a rusty sword, three-quarter view, cute chibi proportions, game unit portrait | 1 | 63396702 | final |
| `unit_zombie` | `zombie` | bust portrait of a shambling green-skinned zombie in torn rags, three-quarter view, cute chibi proportions, game unit portrait | 1 | 180874268 | final |
| `unit_wight` | `wight` | bust portrait of a floating hooded wight ghost with glowing eyes and pale blue mist, three-quarter view, cute chibi proportions, game unit portrait | 1 | 91266643 | final |
| `unit_vampire` | `vampire` | bust portrait of a pale vampire in a black and crimson high-collared cloak, three-quarter view, cute chibi proportions, game unit portrait | 1 | 258600622 | final |
| `unit_lich` | `lich` | bust portrait of a lich in a purple hood with a skull face and green glowing eyes holding a staff, three-quarter view, cute chibi proportions, game unit portrait | 1 | 77426672 | final |
| `unit_blackknight` | `blackknight` | bust portrait of a black knight in dark spiked armour riding a skeletal horse, three-quarter view, cute chibi proportions, game unit portrait | 1 | 72679133 | final |
| `unit_bonedragon` | `bonedragon` | bust portrait of a bone dragon skeleton with bony wings and glowing eye sockets, three-quarter view, cute chibi proportions, game unit portrait | 1 | 223681243 | final |
| `unit_skelwarrior` | `skelwarrior` | bust portrait of a skeleton warrior in a horned helmet with a round shield and sword, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 24176753 | final |
| `unit_plaguezombie` | `plaguezombie` | bust portrait of a plague zombie with sickly green skin, pustules and a toxic cloud, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 7404894 | final |
| `unit_wraith` | `wraith` | bust portrait of a wraith, a dark hooded spectre with a scythe and blue ghost flames, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 130119155 | final |
| `unit_vampirelord` | `vampirelord` | bust portrait of a vampire lord with a crown, red eyes and a black and crimson cape, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 139791532 | final |
| `unit_powerlich` | `powerlich` | bust portrait of a power lich with a skull face, golden crown and a glowing green orb staff, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 223825275 | final |
| `unit_dreadknight` | `dreadknight` | bust portrait of a dread knight in black spiked armour with red eyes on a nightmare horse, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 5792208 | final |
| `unit_ghostdragon` | `ghostdragon` | bust portrait of a ghost dragon, a translucent pale blue spectral dragon skeleton, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 27559663 | final |

## Sylvan creature portraits (img2img from the 3D portrait, strength 120)

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `unit_centaur` | `centaur` | bust portrait of a centaur warrior: a young bearded HUMAN man's head and bare muscular human torso attached to a brown horse body, green headband with a feather, holding a spear, three-quarter view, cute chibi proportions, game unit portrait | 3 | 261910416 | final (v2) |
| `unit_dwarf` | `dwarf` | bust portrait of a stout bearded dwarf in a horned helmet with an axe, three-quarter view, cute chibi proportions, game unit portrait | 1 | 63367457 | final |
| `unit_woodelf` | `woodelf` | bust portrait of a wood elf archer with long hair, green cloak and a longbow, three-quarter view, cute chibi proportions, game unit portrait | 1 | 142967664 | final |
| `unit_pegasus` | `pegasus` | bust portrait of a white pegasus horse with feathered wings, three-quarter view, cute chibi proportions, game unit portrait | 1 | 111514148 | final |
| `unit_dendroid` | `dendroid` | bust portrait of a dendroid, a walking tree creature with a bark face and leafy crown, three-quarter view, cute chibi proportions, game unit portrait | 1 | 1443459 | final |
| `unit_unicorn` | `unicorn` | bust portrait of a white unicorn with a spiral horn and flowing mane, three-quarter view, cute chibi proportions, game unit portrait | 1 | 141289130 | final |
| `unit_greendragon` | `greendragon` | bust portrait of a green dragon with emerald scales and wings, three-quarter view, cute chibi proportions, game unit portrait | 1 | 204981325 | final |
| `unit_centaurcpt` | `centaurcpt` | bust portrait of a centaur captain: a HUMAN man with a blond beard, green headband and golden shoulder armour, holding a long spear, horse ears, upgraded elite version with gold trim, three-quarter view facing the viewer, cute chibi proportions, game unit portrait, whole figure inside the frame | 2 | 192467978 | final (v1) |
| `unit_battledwarf` | `battledwarf` | bust portrait of a battle dwarf with a braided red beard, steel helmet and big axe, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 178629294 | final |
| `unit_grandelf` | `grandelf` | bust portrait of a grand elf archer with silver armour and a longbow, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 62802099 | final |
| `unit_silverpegasus` | `silverpegasus` | bust portrait of a silver pegasus with shining silver wings and armour, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 99708880 | final |
| `unit_dendroidsoldier` | `dendroidsoldier` | bust portrait of a dendroid soldier, a walking tree with bark armour and a thick branch club, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 217869082 | final |
| `unit_warunicorn` | `warunicorn` | bust portrait of a war unicorn with silver barding and a golden horn, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 116050082 | final |
| `unit_golddragon` | `golddragon` | bust portrait of a gold dragon with shining golden scales and wings, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 54384778 | final |

## Inferno creature portraits (img2img from the 3D portrait, strength 120)

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `unit_imp` | `imp` | bust portrait of a small red imp with bat wings and a mischievous grin, three-quarter view, cute chibi proportions, game unit portrait | 1 | 183914547 | final |
| `unit_hellhound` | `hellhound` | bust portrait of a black and red hell hound with glowing eyes and fiery breath, three-quarter view, cute chibi proportions, game unit portrait | 1 | 234221811 | final |
| `unit_demon` | `demon` | bust portrait of a muscular red demon with curved horns, three-quarter view, cute chibi proportions, game unit portrait | 1 | 5831649 | final |
| `unit_succubus` | `succubus` | bust portrait of a succubus with red skin, horns and dark bat wings holding a fire orb, three-quarter view, cute chibi proportions, game unit portrait | 1 | 188099069 | final |
| `unit_efreet` | `efreet` | bust portrait of an efreet, a fiery genie made of flames with a turban, three-quarter view, cute chibi proportions, game unit portrait | 1 | 137242924 | final |
| `unit_nightmare` | `nightmare` | bust portrait of a nightmare, a black horse with a burning flaming mane and hooves, three-quarter view, cute chibi proportions, game unit portrait | 1 | 89281359 | final |
| `unit_devil` | `devil` | bust portrait of a pit lord, a huge red demon with big horns and a flaming whip, three-quarter view, cute chibi proportions, game unit portrait | 1 | 93534064 | final |
| `unit_familiar` | `familiar` | bust portrait of a familiar, an orange imp with small wings and a fire spark, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 245811342 | final |
| `unit_cerberus` | `cerberus` | bust portrait of cerberus, a three-headed hell hound breathing fire, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 90942347 | final |
| `unit_horneddemon` | `horneddemon` | bust portrait of a horned demon with huge ram horns and dark red skin, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 268332155 | final |
| `unit_succubusmistress` | `succubusmistress` | bust portrait of a succubus mistress with a crown, horns and a whip of fire, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 468853 | final |
| `unit_efreetsultan` | `efreetsultan` | bust portrait of an efreet sultan made of flames with a jewelled turban and scimitar, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 237082594 | final |
| `unit_hellcharger` | `hellcharger` | bust portrait of a hell charger, a black armoured horse with a blazing mane, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 39907800 | final |
| `unit_archdevil` | `archdevil` | bust portrait of an arch devil with dark crimson skin, great horns, wings and a trident, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 228145432 | final |

## Dungeon creature portraits (img2img from the 3D portrait, strength 120)

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `unit_troglodyte` | `troglodyte` | bust portrait of a troglodyte, a grey blind lizard man with a spear, three-quarter view, cute chibi proportions, game unit portrait | 1 | 224975703 | final |
| `unit_harpy` | `harpy` | bust portrait of a harpy, a woman with feathered green wings and talons, three-quarter view, cute chibi proportions, game unit portrait | 1 | 40587138 | final |
| `unit_beholder` | `beholder` | bust portrait of a beholder, a floating purple eyeball monster with eye stalks, three-quarter view, cute chibi proportions, game unit portrait | 1 | 141275915 | final |
| `unit_medusa` | `medusa` | bust portrait of a medusa with green snake hair and a bow, three-quarter view, cute chibi proportions, game unit portrait | 1 | 240769580 | final |
| `unit_minotaur` | `minotaur` | bust portrait of a brown minotaur with bull horns and a big axe, three-quarter view, cute chibi proportions, game unit portrait | 1 | 55667407 | final |
| `unit_manticore` | `manticore` | bust portrait of a manticore, a lion with bat wings and a scorpion tail, three-quarter view, cute chibi proportions, game unit portrait | 1 | 120714398 | final |
| `unit_blackdragon` | `blackdragon` | bust portrait of a black dragon with dark scales and purple glowing eyes, three-quarter view, cute chibi proportions, game unit portrait | 1 | 215005939 | final |
| `unit_infernaltrog` | `infernaltrog` | bust portrait of an infernal troglodyte, a reddish lizard man with a spear and armour, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 170623449 | final |
| `unit_harpyhag` | `harpyhag` | bust portrait of a harpy hag, a pale woman with white hair, pink and purple feathered wings and sharp talons, upgraded elite version, three-quarter view facing the viewer, cute chibi proportions, game unit portrait, whole figure inside the frame | 2 | 147510601 | final (v1) |
| `unit_evileye` | `evileye` | bust portrait of an evil eye, a floating purple eye monster with many glowing eye stalks, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 166757522 | final |
| `unit_medusaqueen` | `medusaqueen` | bust portrait of a medusa queen with snake hair, a golden crown and a bow, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 27651680 | final |
| `unit_minotaurking` | `minotaurking` | bust portrait of a minotaur king with golden horns, armour and a great axe, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 210366674 | final |
| `unit_scorpicore` | `scorpicore` | bust portrait of a scorpicore, a red manticore with a giant scorpion tail, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 20456938 | final |
| `unit_reddragon` | `reddragon` | bust portrait of a red dragon with crimson scales and fiery eyes, upgraded elite version with gold trim and a richer ornate outfit, three-quarter view, cute chibi proportions, game unit portrait | 1 | 109528176 | final |

## Neutral creature portraits (img2img from the 3D portrait, strength 120)

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `unit_goblin` | `goblin` | bust portrait of a small green goblin with big ears and a dagger, three-quarter view, cute chibi proportions, game unit portrait | 1 | 91601805 | final |
| `unit_wolf` | `wolf` | bust portrait of a snarling grey wolf with bright blue-grey fur and yellow eyes, bold and vivid, three-quarter view facing the viewer, cute chibi proportions, game unit portrait, whole figure inside the frame | 2 | 186665707 | final (v1) |
| `unit_orc` | `orc` | bust portrait of a green orc warrior with tusks and an axe, three-quarter view, cute chibi proportions, game unit portrait | 1 | 40989464 | final |
| `unit_ogre` | `ogre` | bust portrait of a big tan ogre with a club, three-quarter view, cute chibi proportions, game unit portrait | 1 | 143308556 | final |
| `unit_troll` | `troll` | bust portrait of a grey-green troll with a long nose and tusks, three-quarter view, cute chibi proportions, game unit portrait | 1 | 229608552 | final |
| `unit_cyclops` | `cyclops` | bust portrait of a one-eyed cyclops giant with a rock, three-quarter view, cute chibi proportions, game unit portrait | 1 | 250658759 | final |
| `unit_hydra` | `hydra` | bust portrait of a multi-headed green hydra serpent, three-quarter view, cute chibi proportions, game unit portrait | 1 | 183680915 | final |

## Faction hero portraits (colour-neutral; img2img from the 3D hero, strength 120)

| id | serves (game ids) | prompt | gens | seed | status |
|---|---|---|---|---|---|
| `hero_haven` | `haven` | bust portrait of a noble human knight hero with short hair, silver and blue armour and a cape, three-quarter view, cute chibi proportions, game hero portrait | 1 | 169548005 | final |
| `hero_necro` | `necro` | bust portrait of a necromancer hero with pale skin, a dark hood and a bone staff with a green glow, three-quarter view, cute chibi proportions, game hero portrait | 1 | 164272313 | final |
| `hero_sylvan` | `sylvan` | bust portrait of an elven ranger hero with long hair, a green cloak and a bow, three-quarter view, cute chibi proportions, game hero portrait | 1 | 226726046 | final |
| `hero_inferno` | `inferno` | bust portrait of a demonic warlord hero with small horns, black and red armour and a flaming sword, three-quarter view, cute chibi proportions, game hero portrait | 1 | 245233708 | final |
| `hero_dungeon` | `dungeon` | bust portrait of a dark elf warlock hero with white hair, purple robes and a crystal staff, three-quarter view, cute chibi proportions, game hero portrait | 1 | 205786752 | final |

## Totals

- icons: 358; shipped: 358
- PixelLab generations: 454 (style tests: 4), i.e. 1.27 per icon
- shipped WebP total: 2488 KB; PNG masters: 15631 KB (not downloaded by the game; each WebP is fetched only when shown)
