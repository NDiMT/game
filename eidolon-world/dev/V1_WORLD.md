# EIDOLON v1.0 M3: the free world (Agent W design, 2026-10-31)

The serial chain of thirteen rooms becomes a HUB with three WINGS, playable in any order, looped by
shortcuts and joined by traversal sections. Every existing puzzle stays where it is, as it is. The
geography of Chapter I is reused; only the new spaces are new. Coordinates are world metres. `-z` is
"north" (up the screen and away from the camera); the camera looks from the south-west, (-x, +z).

## 1. The map

```
                 z -52 ... SC  Scales ─────────┐(lift)
                         EC  Echo Corridor ──┤               ┃WK  the Mirror Walk (y 4) ── Warden patrol
             MZ  Mist Maze ┘(EC_a)       EC_room (seal E)   ┃      SPB the Upward Spring (off WK)
                 │                                          ┃
          TS Tree of Shards ── MZ_door      S  Gate of the Four Veiled ─ sealed way ─ First Shrine
                 │                          │ (EB, the ledge's bridge)
             L  Court of Light ══(LB drawbridge: N shortcut)══ E  Eidolon Ledge ─ WK_down ┛
                 │ HW_ramp                                     │
 W_top ─ W_corr ─ H  Hall of Glass   HW  Our Steps             ║ T3 the Wind-swept Balcony (y 2)
   │                 │      GL Shadow Chamber   │ (garden door)  ║    banners, veils, gusts
 W_stair2            b1     │ (south gate)      G  Garden ─────┘║
 W_breath (stair)    │      CO_w ── CO stones ── (garden SE)      ║ T2 the Scaffold Climb (0 -> 2)
 W_stair1            │      │ (shortcut gate:     ╲ colossus head  ║
 W_land ═pool stones═ T  Waking Pool  W shortcut)  ╲ (19, 0)      ║ T5 the Undercroft (dark: lamp)
                     │ stub                         T4 the Flooded Colonnade (her reflection shows
                     T1 the Crumbling Bridge             the safe stones; the lake, x 10..13)
                     │
     ┌───────────────────── A  THE ATRIUM OF A THOUSAND FACES (hub, y 0) ──────────────────────┐
     │ x -4..14, z 9..23: rows of half-carved faces, Theron's scaffolds, a dry fountain, fog;   │
     │ the scaffold gallery (y 2.6) with his workbench: THE OIL LAMP. Exits: N (bridge to the     │
     │ pool), NE (colonnade into the lake), E (undercroft -> scaffold -> balcony), a cracked wall │
     │ (chisel) and a hidden inscription (shard) to the memory alcove under the fountain.         │
     └────────────────────────────────────────────────────────────────────────────────────────────┘
```

Free space checked: the colossus lake ends at z 7.6 and x 22.4 (its head at (19.3, 0, 0), about 8 m
across). South of z 8.5 and east of x 23.5 nothing stands. The balcony runs between the Our Steps
room's east wall (x 25.8) and x 30, from z -5 to -19, then onto the Ledge's south-east corner.

## 2. The new spaces (all at the fixed camera; occlusion, overlap, centreline tests extended to them)

| Space | Where | What it is |
|---|---|---|
| **A, the Atrium** (hub) | x -4..14, z 9..23, y 0 | Theron's open-air workshop. Three rows of plinths with unfinished faces (aisles 2.4 m), a round dry fountain (centre (5, 0, 16)), two scaffold towers, chisel marks, a fallen crane arm, fog. The scaffold gallery (y 2.6) runs along its south side (camera side: low parapet only). A slab map of the chapter on the fountain's rim (the map's in-world anchor). |
| **T1, the Crumbling Bridge** | stub (z 7.3) -> Atrium (z 9.6), x -1..1, y 0 | A short bridge of loose slabs over the gap: each slab settles 3-6 cm as you step on it (dust, a creak, a pebble falls), one drops away behind you once (no way to fall: rails, the gap is behind you). |
| **T2, the Scaffold Climb** | Atrium east, x 11..14, z 18..22 | Plank ramps and a ladder up Theron's scaffold to the gallery (0 -> 2.6). The planks flex under you. The lamp is on his workbench up there. |
| **T5, the Undercroft** | x 14..24, z 10..14 (under the gallery's east end and on east), y 0 | A low vaulted passage, dark: without the lamp the mist and the dark close in (the hint: "too dark to see your feet"); carrying it, its real light (an OmniLight following you, shadows off) shows fallen blocks to weave through. Ends at a stair up (0 -> 2) at x 25. |
| **T3, the Wind-swept Balcony** | x 26.5..29.5, z 9 -> -19, y 2 | A long open balcony along the lake's east shore and the Our Steps room's east wall: torn veils on poles stream in gusts (cloth), petals and grit blow across, the wind sound swells; one stretch is a narrow ledge past a broken rail. Arrives at the Ledge's south-east corner (28, 2, -19). |
| **T4, the Flooded Colonnade** | x 10..13, z 4 -> 9, the lake (y 0.15) | A drowned colonnade from the Atrium's north-east into the lake, to the colossus stones' southern apex (12, 3.4). The stones are just under the surface, invisible from above; the still water (a planar reflection) shows them, and her, walking ahead on them. Only the true stones are walkable (no fall: a misstep is refused, a splash). |
| **Veil Seals** | W: the colossus brow; N: her pool in the maze; E: the echo room | Each rises into reach when the wing's last puzzle is solved. |

## 3. The wings (every existing puzzle, where it lands)

| Wing | Spaces and puzzles, in order | Enter from the Atrium | Seal | Shortcut back |
|---|---|---|---|---|
| **West, the Glass Wing** | Waking Pool crossing (pool stones) -> Stair of Breath (breath glass) -> Hall of Glass (drum/brazier/bust; THE SHARD) -> Shadow Chamber (braziers, eyes; THERON'S CHISEL appears on her plinth) -> Sunken Colossus | over T1 to the pool | on the colossus brow, after the Shadow Chamber | the shortcut gate (colossus side -> pool), as today |
| **North, the Garden Wing** | Garden of the Veiled (turned ones, her small glass; THE AMPHORA in a niche) -> Our Steps -> Court of Light (mirrors, beam, drawbridge) -> Tree of Shards -> Mist Maze | T4 across the lake to the colossus stones, then the stones to the garden's south-east corner | from her pool in the Mist Maze | the Court's drawbridge (LB) to the Ledge, then T3 down to the Atrium |
| **East, the High Wing** | Eidolon Ledge (two plates) -> the Mirror Walk WK (the Warden's patrol) -> Upward Spring -> Scales (lift) -> Echo Corridor (singing stones; THE BRONZE TUNING PIN in the echo room) | T5 (the lamp) -> T2/T3 to the Ledge | in the echo room, after the song | a ladder from the Mirror Walk's south end down to T3 (one way, unbolted from above) |

The High Wing is entered at its FOOT (the Ledge) and climbs to the Echo Corridor: the brief lists it top
down; geographically the Atrium meets it at the Ledge. Puzzle logic is unchanged (WK_down already joins the
Ledge to the Walk; the Scales' lift works both ways).

**The finale.** The Ledge's bridge (EB) leads to the Gate of the Four Veiled (S). The gate has three
sockets; it opens when all three seals are set ("you are the fourth"). Then the sealed way, the First
Shrine and the finale, unchanged.

## 4. The critical path and the item gating graph

```
Pool ─T1─ ATRIUM ──climb T2── LAMP ──┐
  │         │                        ├─ T5 (needs LAMP) ─ T3 ─ Ledge ─ Walk ─ Spring ─ Scales ─ Echo ─▶ SEAL E
  │         └─ T4 ─ CO stones ─ Garden ─ Our Steps ─ Court ─ Tree ─ Maze ─────────────────────────▶ SEAL N
  └─ pool stones ─ Stair ─ Hall (SHARD) ─ Shadow Chamber (CHISEL) ─ Colossus ─────────────────────▶ SEAL W
SEAL W + SEAL N + SEAL E ─▶ Gate of the Four Veiled (S, via the Ledge's bridge) ─▶ First Shrine ─▶ finale
```

Required items: the LAMP (T5) and the three SEALS. Everything else is optional (secrets, memories, the
"Face" ending), so no item can soft-lock a wing.

| Item | Found | Uses (all through the interact button when it applies) |
|---|---|---|
| Oil Lamp | Atrium, scaffold gallery | carried: a real light round you; lights the Undercroft; lights distant braziers (the Shadow Chamber's, from the floor); keeps the Warden's mist back; in the Mist Maze its light shows her footprints |
| The Shard | Hall of Glass (as today) | the lens is back: hidden inscriptions; the secret path in the Atrium (an inscription on the fountain names the cracked wall); two memory alcoves |
| Theron's Chisel | Shadow Chamber, after its solve | breaks CRACKED marble: the Hall's cracked wall (a memory), the Atrium's cracked wall (to the alcove), a statue in the Garden that hides a memory |
| The Amphora | Garden niche | fill at any water; pour on a marked dry floor: a PUDDLE MIRROR (a small planar reflection) shows what is not there: her footprints, a hidden glyph, the Shadow Chamber's eyes from above |
| Bronze Tuning Pin | Echo room | strike near singing stone or glass: replays the motif, resonates sealed panels open; at the Upward Spring the falling water answers (a memory) |
| Wax Tablets (8) | 2 in the Atrium, 2 per wing | Theron's notes: the lore journal |
| Memory Shards (7) | the hidden places above | the hidden "Face" ending |
| Veil Seals (3) | one per wing | the Gate's three sockets |

## 5. The living world

- **The Glass Warden (Theron).** A tall veiled figure seen only in reflections and at the fog's edge. Now
  and then he stands in a mirror BEHIND you (a cold string sting) and is gone when you turn. On the Mirror
  Walk he patrols the long glass: while his reflection faces you, stand still in the shadow of a pillar;
  cross while it looks away. Seen: the glass rings, a sigh, and you are back at the Walk's start (no death,
  no fail screen). The lamp's light keeps his mist away (the mist marks where he will look next).
- **Her presence.** In reflections she lags or moves on her own; near a secret she points (the existing gaze
  system, aimed at secrets); on still water she writes a single rune that fades.
- **Ambient life.** Moths at every lit flame (the world's existing moths), drifting petals in the Garden and
  on the Balcony, dripping water in the Undercroft and the Stair, distant bells, and (rare) a statue whose
  head has turned when you come back.
- **The map.** A hand-drawn plan of the chapter (UI, from the satchel): rooms fill in as you visit them,
  shortcuts appear when opened, an icon per seal (empty / set). Its in-world anchor is the slab map on the
  fountain.

## 6. Save format (v3)

```
{ "v": 3,
  "pos", "yaw", "cam", "area", "glimpses", "runes_awake", "visited",     # as v2
  "puzzles": {...}, "chapter": {...},                                      # as v2, plus the new keys below
  "inv": { "items": ["lamp", "shard", "chisel", "amphora", "pin"],         # owned
           "held": "lamp",                                                  # in hand (the lamp is carried)
           "tablets": ["t1", ...], "mem": ["m1", ...], "seals": ["W", "N", "E"],
           "socketed": ["W", ...] },                                        # set in the Gate
  "world": { "shortcuts": {"W": bool, "N": bool, "E": bool}, "broken": ["atrium_crack", ...],
             "puddles": [...], "warden_seen": int },
  "map": { "seen": ["A", "T1", "W_land", ...] } }                          # region names visited
```

v2 saves load: the chain's progress maps onto the wings (a solved puzzle stays solved; the shard, if taken,
is in "items"; seals are granted for every wing already finished). The jump/dev order (Names.ORDER) becomes
the wing order: pool, atrium, then W, N, E, gate, shrine.

## 7. Building order (each step ends green: playthrough, occlusion, overlap, smoke)

1. M3a, the structure: the Atrium and T1-T5 (geometry, walk regions, names, music areas), the seals and
   the Gate's three sockets, the High Wing's ladder shortcut, the playthrough rewritten as hub -> W -> N
   -> E -> gate (and a second order check: E -> N -> W with jumps).
2. M3b, the inventory: the satchel UI (slots, 3D icons from A or a render-to-texture fallback, name, one
   line), the lamp (carried light), the shard lens back, the chisel and cracked walls, the amphora and
   puddle mirrors, the tuning pin, tablets and memory shards, the save v3 and the v2 migration.
3. M3c, the life: the Warden (reflections, the Mirror Walk patrol), her presence, ambient life, the map.
4. A's M2 assets (heroine, textures, item models) integrated as they land in HANDOFF.

## 8. Pacing: the in-between points (v1.1)

Rule: no two puzzle rooms are adjacent without a space between them where nothing is asked of you.

**Route audit.** Puzzles are in **bold**. Between them, *in-between points* (all optional, each says one thing once; `scripts/points.gd`), wonders, and traversals.

| From | Between (what is there) | To |
|---|---|---|
| **The Waking Pool** | the landing (W_land): *a hanging bell* to ring; the far bells answer | **The Stair of Breath** |
| **The Stair of Breath** | the stair top (W_top): *a votive* to light (it stays lit) | **The Hall of Glass** |
| **The Hall of Glass** | the way in (x 5..7): *an offering* of stone grapes, a comb, a ribbon | **Where Her Shadow Fell** |
| **Where Her Shadow Fell** (+ the reliquary) | the west court, then the Sunken Colossus (a wonder) | **Garden of the Veiled** |
| **Garden of the Veiled** | the doorway and the landing round the board | **Our Steps** (two boards) |
| **Our Steps** | the ramp up to the Court | **Court of Light** |
| **Court of Light** | the mural door and the Tree of Shards (a wonder) | **The Mist Maze** |
| **The Mist Maze** | its end: the dry ring and the amphora's puddle mirror (an item point), the North seal | **The Echo Corridor** |
| **The Echo Corridor** | the corridor's carved relief: three panels that speak as you walk past | **The Scales** |
| **The Scales** | the lift up to the Mirror Walk (the Warden's beat), the Upward Spring (a wonder) | **The Eidolon Ledge** |
| **The Eidolon Ledge** | the Gate's sockets (the seals) | **The First Shrine** |

**The hub.**
- The Atrium: *a coin for the dry fountain* (it rings on dry stone), the thousand faces, Theron's ladder.
- The Undercroft: *Theron's cot*, under his workshop; you find it by lamplight.
- The Wind-swept Balcony: *a bench with a view*. Sitting turns the view toward the drowned head below. Also urns, veils, and the pin's stele.

**Seven in-between points** (`Points.POINTS` plus `Points.RELIEF`): bell, votive, offering, coin, cot, bench, relief.
- The memory shards and tablets (Items) are collectible spots on top of these.
- The shortcuts (the drawbridge, the Echo bars, the Walk) count as the wing returns.
