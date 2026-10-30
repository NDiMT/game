# EIDOLON Chapter I: v1.0 plan ("make it outrageously good")

The owner's brief (2026-10-30, translated):
- Make a major improvement to graphics and optimisation, and deliver the smoothest possible gameplay and the richest look.
- Rich textures. Every object placed perfectly: no interpenetration, nothing blocking the view.
- Not only puzzles. A free-world structure rather than a serial chain of rooms, with traversal sections, an inventory and items you pick up and use later.
- KEEP the puzzles; the owner likes them.
- Redesign the heroine: more mysterious, an odd figure that exudes mystery.
- Juice everywhere. Example: the pool slabs should rise out of the water realistically.

Two agents work in parallel. File ownership is strict, to avoid conflicts:

| Area | Owner |
|---|---|
| Gameplay, layout, puzzles, inventory, UI, save, story text: `scripts/` (except the rendering files below), `tests/`, `ch1_geo`, `chapter`, `puzzles`, `level` layout, `ui`, `main`, `controls` | **Agent W (world / gameplay)**. W is also the INTEGRATOR: W alone exports `build/web` and runs `tests/smoke.sh`. |
| Look and performance: `shaders/`, `assets/` (models, textures, audio import settings), `palette.gd`, `world.gd` (environment, lights, post, quality tiers), material code in `level.gd` (`marble_mat` and similar: coordinate with W through small, clearly marked functions), Tripo, rigging | **Agent A (art / tech-art)** |

**Handoffs** go through `dev/HANDOFF.md`, an append-only log: date, who, what is ready, which paths, and what the other agent must do. Never edit a file the other agent owns. Ask for a change through HANDOFF instead.

**Every milestone ends green:**
- the playthrough;
- the occlusion test;
- the NEW overlap test (see M1-W5);
- `SMOKE PASS`.

W reports to the main session, which deploys. Never commit, push or deploy yourselves.

---

## M1: fixes and juice (deploy as soon as it's ready)

**Agent W**
1. **Stale fog bug.** When a breath close-up opens on a new glass, it first shows the PREVIOUS glass's fog and strokes. Reset the close-up state, viewports and shader uniforms BEFORE the first frame shows. Keep it hidden until the first clean render. Test it in the playthrough.
2. **"Our Steps".**
   - The owner thinks it CANNOT be solved in practice. Replay it through the REAL input path, i.e. joystick vectors through `controls` and the grid snap, not the dev command, and fix whatever blocks it: snap thresholds, diagonal stick input, the auto-teach step, the blocked-move feel.
   - Her side must look like a NORMAL REFLECTION, like every other mirror in the game: a tall planar glass wall, with her room seen IN the glass as the mirror image of yours. Use twin geometry on the reflection-only layer (`LAYER_DOUBLE`) for her differences (stones and gaps), and a crimson puppet on the reflection layer at her logical mirrored position. That replaces the separate "room above the glass".
   - Lay the grid ALONG the glass, about 5 wide × 3 deep. A 3 m+ glass shows about 4 m of virtual floor at our camera pitch.
   - Keep the solver test, and add an input-path solve test.
3. **Juice pass.** Find at least 15 moments and make each feel physical and alive. Examples:
   - Pool slabs: they rise out of the water with water sheeting off the edges, droplets, a displacement bulge and ring ripples, then the wet darkening dries over 3 s, and a deep stone-grind plus splash plays.
   - Doors: dust from the lintel and a camera micro-shake (no rotation or zoom: translation only, tiny).
   - Statue turns: grit trickle.
   - Lamps igniting: a flare, then settle.
   - Footstep puffs on dusty floors.
   - Small ripples where she walks through shallow water.
   - Cloth reacting to the start and stop of walking.
   - Interact anticipation: a small lean and reach animation on the heroine before each interaction.
4. **Smoothness.**
   - Re-profile.
   - Add physics interpolation if any motion still updates at a fixed tick.
   - Make sure no frame does more than 4 ms of script work.
   - No hitch on room entry. Pre-warm everything that's new.
5. **NEW `tests/overlap_test`.**
   - No two solid props or statues interpenetrate. Use the AABB plus a mesh-sample check.
   - No prop intersects a wall or a walkway rail.
   - Nothing floats more than 2 cm above or sinks more than 2 cm into its support, unless it's whitelisted (sunken colossus, fallen debris).
   - No prop sits on a walkable path's centreline.
   - Fix every hit.

**Agent A**
1. **Realistic fog writing.** It should look like a HUMAN FINGER drawing on condensation:
   - The stroke is drawn progressively with an irregular speed profile: it accelerates and slows on curves.
   - The width varies with pressure.
   - The fingertip wipe is cleaner in the centre, with ragged, beaded edges where the water gathers.
   - Tiny droplets form along the edges, grow, and some run down, leaving clear streaks.
   - The fog slowly re-condenses over the strokes.
   - Add a slight fingerprint texture at stroke starts.
   - Her hand moves along the strokes: the existing hand print, now tracking the writing tip.
   - Work in `glass_closeup.gdshader` / the mask viewports. Tell W through HANDOFF if `glass_talk.gd` needs changes.
2. **Water shader upgrade.** Better normal-mapped ripples, a fresnel edge, depth darkening and soft shoreline foam. This supports W's slab juice.

---

## M2: art and look (Agent A, with W integrating placements)

1. **Heroine redesign in Tripo** (the owner has credits; use up to about 400).
   - **More mysterious, an ODD figure.** Directions to try, 2–3 attempts each, then present the 3 best on a contact sheet:
     - an unnaturally tall, thin faceless statue-woman, with hands slightly too long, in a floor-length veil of hanging glass beads or threads;
     - a figure whose veil is a cascade of mirror shards;
     - a cracked porcelain/marble body wrapped in grey gauze, its face a smooth blank mirror-polished oval;
     - a hunched, cloaked silhouette with a tall headdress and trailing ribbons.
   - **Must have:**
     - still readable as "her" (a veiled woman);
     - an elegant, eerie silhouette at 40–60 px on screen;
     - a skirt or veil that can carry spring chains;
     - a marble/stone skin;
     - a dress readable in grey, and recolourable to crimson for the reflection.
   - Pick the strongest, rig it with the existing pipeline (same 25 body bones plus cloth chains) and hand it to W.
   - Also consider an idle "oddness" layer: a slow, unnatural head tilt; fingers that twitch now and then; a hover-glide in the walk.
2. **Rich textures (PBR).**
   - Source CC0 texture sets (ambientCG / Poly Haven are fine; record each in CREDITS.md), or generate them:
     - weathered white marble (several variants);
     - veined marble;
     - worn floor slabs with grout;
     - cracked plaster;
     - bronze patina;
     - wet stone;
     - moss and lichen in the crevices;
     - dark water-stained stone;
     - old wood for the braziers and stools.
   - 1K maps, mobile-friendly. Use VRAM compression suitable for the web Compatibility renderer, and check that it actually uploads on the web (Basis failed before).
   - Use triplanar or world-space mapping on the procedural geometry (the game is built from boxes). Add edge wear and AO from the existing vertex-colour conventions.
   - Keep the soft, foggy, painterly mood. Rich is not noisy.
3. **Lighting and post.**
   - Baked or approximated AO (vertex AO or a cheap SSAO-like pass in Compatibility).
   - Better fog layering, with height fog and distant silhouettes.
   - Subtle colour grading.
   - Crimson light bounce from the flames.
   - Soft contact shadows under props.
4. **Textured Tripo hero props:**
   - the inventory item models (see M3);
   - a few bespoke landmarks;
   - better braziers, doors and a gate.
5. **Performance budget.** High must stay smooth on a mid phone.
   - Draw calls under 250 per view.
   - Texture memory under 120 MB.
   - Measure everything and report before/after numbers.

---

## M3: free world, inventory, items (Agent W designs and builds; A supplies the models and icons)

**Structure: a hub with three wings, playable in any order, plus shortcuts and backtracking.**

- **Start:** the Waking Pool leads to **the Atrium of a Thousand Faces**. This is the HUB, and also a traversal space: Theron's ruined open-air workshop, with rows of half-carved faces, scaffolds, a dry fountain and fog. From it, three wings:
  - **West, the Glass Wing:** Stair of Breath → Hall of Glass → Shadow Chamber → Sunken Colossus.
  - **North, the Garden Wing:** Garden of the Veiled → Our Steps → Tree of Shards → Court of Light → Mist Maze.
  - **East, the High Wing:** Echo Corridor → Scales → Upward Spring → Eidolon Ledge.
- Each wing ends with a **Veil Seal**, a key item. Three seals open the **Gate of the Four Veiled**: you are the fourth. Then the First Shrine and the finale.
- **Shortcuts:** each wing unlocks a shortcut back to the Atrium (a one-way gate, a lowered bridge or a ladder), so the world loops.
- **Traversal sections between the puzzles:**
  - a crumbling bridge that settles under you;
  - a scaffold climb;
  - a wind-swept balcony with blowing veils;
  - a flooded colonnade where only her reflection shows the safe stones;
  - a dark undercroft where you carry the oil lamp, and its real light shapes the space.
  - No combat. Mood first.

**Inventory.** A slot bar that opens from a satchel icon. Items show a 3D-rendered icon, a name and a one-line description. Context use works through the interact button when an item applies. Saved in the savegame.

| Item | Where | Use |
|---|---|---|
| **The Shard** | Hall of Glass | It's back: the lens. Reveals hidden inscriptions, a secret path in the Atrium and two memory alcoves. |
| **Theron's Chisel** | West wing | Breaks cracked marble: shortcuts, a secret room, and a statue that hides a memory. |
| **The Oil Lamp** | Atrium | Carry fire: light distant braziers, light the dark undercroft, and keep the Warden's mist away. |
| **The Amphora** | North wing | Fill it at water and pour it on a floor to make a PUDDLE MIRROR where there was none. It reveals reflections, hidden glyphs, and her footprints on dry stone. |
| **The Bronze Tuning Pin** | Echo corridor | Strike it near singing stones and glass. It replays the motif and resonates sealed panels open. |
| **Wax Tablets** (collectible) | Spread around | Theron's notes: the lore journal. |
| **Memory Shards** (collectible, 7) | Hidden | Optional; tie into the hidden "Face" ending. |
| **Veil Seals** (3) | Wing rewards | Keys for the Gate. |

**Mechanics that combine items with existing puzzles:**
- the puddle mirror plus the Shadow Chamber (see the eyes in a puddle);
- the lamp plus the Mist Maze (the lamp's light shows her footprints);
- the chisel plus the Hall (a cracked wall);
- the tuning pin plus the Upward Spring.

**Extra gameplay to make it feel alive:**
- **The Glass Warden (Theron).** A distant, tall, veiled figure seen in reflections and at the edges of the fog. He sometimes appears in a mirror behind you, with a subtle sting. In one wing he "patrols" a mirror gallery, and you cross while his reflection looks away. That's a gentle stealth beat, with no death: if he sees you, you are softly returned to the gallery entrance with a sigh.
- **Her presence.**
  - Now and then she lags or moves on her own in reflections.
  - She points toward secrets.
  - On a still water surface she writes a single rune.
- **Ambient life:** moths at lights, drifting petals, dripping water, distant bells, and statues whose heads have turned when you look back (rare and subtle).
- **A map:** a stylised hand-drawn plan filling in as you explore, with an icon for each wing seal.

**Placement and composition rule, for ALL milestones.** Every object is placed deliberately:
- no overlaps;
- no floating;
- nothing blocking a puzzle or path from the fixed camera;
- clear sight lines to exits and interactables;
- set dressing frames the paths and never clutters them.

The overlap and occlusion tests must cover the whole world.

---

## M4: final polish and QA
- Run the QA agent's audit again on the whole chapter.
- Fix every P0/P1.
- Do a performance pass on High at DPR 3.
- Run the smoke test on live.
