# EIDOLON v2.0: Chapter I from the final script (Agent W plan, 2026-11-05)

Source of truth: `dev/EIDOLON_SCRIPT.md` (§1, §3, §4, §5, §6). This plan maps that script onto the existing
world. Most of the existing geometry and puzzles are reused and re-sequenced; little is new. Coordinates are
world metres; `-z` is north (up the screen).

## 1. The map (v2)

```
                    SC Scales ── E BEACON (lift top)            WK Mirror Walk (Warden patrol) ── SPB Spring
                    EC Echo Corridor (relief: a pause)          ┃  e_panel (opened by the Singing Stones)
     MZ Mist Maze ── N BEACON (maze end: lamp footprints)       ┃
     TS Tree of Shards                    S Gate of the Four ── sealed way ── First Shrine (I.23)
     L Court of Light ══ LB ══ E Eidolon Ledge: SINGING STONES (E.2, moved here) + Eidolon Plate (E.6)
            ║ HW_ramp + votive_n (N.3)        ║ EB (opens: E.6 + Act 3)
 W_top(offering W.2) ─ W_corr ─ H Hall of Glass ── hdoor (W.4 the shard's star) ── GL Shadow Chamber (W.5)
   │ Stair (W.1)        │ b1 (shut; opens from the Hall side: shortcut)      │ south gate = HIDDEN WAY (W.6)
 W_land ── NEW north-shore walk ── T  WAKE (I.1 puddle plate)          CO_w ── W BEACON ── CO stones (W.7)
           (x -10.2..-5, z -3.6..-1.6)  │ pool of halves: Act 3 (I.20)      ╲ T4 Flooded Colonnade (N.1)
                                        stub: door (I.1), bell (I.2), first glass (I.3), low gate
                                        T1 bridge: single turning slab (I.4); crumbles in Act 3 (I.21)
                                        CR NEW crypt (I.5): still basin, LIT LAMP, Theron's cot, tablet 1
     ┌──────────── A  ATRIUM (I.6): 3 Beacon pillars (W, N, E sides), dry fountain with a still basin ─────┐
     │  exits: N = T1 (to T and the West), NE = T4 (North), E = UC Undercroft (dark) -> BAL (East)        │
     └──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Acts and beats → where they live

### Act 1: Awakening (linear, no fail; hints at 30 s)

| Beat | Where | Reused / new |
|---|---|---|
| I.1 the plate only her reflection stands on | T's east strip: a still puddle (horizontal planar, the old amphora-puddle machinery) holds a glowing plate on LAYER_DOUBLE. Stand on it; her reflection arrives 0.5 s later; the stub's door opens | new door leaf in the stub gateway; puddle reused |
| I.2 the bell | moved from W_land to T's south strip, beside the stub | moved point |
| I.3 the first glass (ONE stroke) | a misted pane in the stub; glass_talk with a one-stroke rune; a low gate at the bridge's head rises | breath glass and glass_talk reused; new 1-stroke rune |
| I.4 the single turning slab | T1's middle span is missing over a stream: one turning slab (the pool rule; its other half only in the reflection) completes the footbridge | the pool slab code, generalised to one slab |
| I.5 the crypt | NEW small vault where T1 lands (x -3.85..2.6, z 9.65..13.2, the Atrium's NW corner, walled and roofed, dark). At its mouth, a still basin: a hand pushes the LIT lamp up through it; the Warden turns in the water; the hand is gone. Inside, by lamplight: Theron's cot (moved from UC) and tablet 1, *"She is not gone. Only behind the veil."* Exit door south into the Atrium | new geometry; lamp pickup moved from the scaffold; darkness reused (UC rules) |
| I.6 the Atrium | 3 unlit Beacon pillars on its W, N and E edges; the map opens; at the fountain (a little still water in its basin) she turns her head toward the West | new pillars; the fountain's water is new; the head turn reuses the gaze system |

### Act 2: three wings (any order; easy → hard; hints at 90 s). Each wing ends at its Beacon, lit with the lamp.

| Wing | Beats in order | Changes |
|---|---|---|
| **West** (Glass) | Stair of Breath (2–3 stroke rune) → offering (flower, small flame; moved to W_top) → Hall of Glass: on the solve the great mirror cracks at one corner and her hand pushes the Shard through → hdoor passage: the Shard shows a carved star → Shadow Chamber (5 braziers, 3 eye pairs; the v1.1d layout) → Hidden Way: the chamber's south gate, visible only through the Shard → **W Beacon** at CO_w → Colossus stones back (W.7) | new access from T over the north-shore walk; b1 shut until the Hall is solved (then a shortcut back to T); the reliquary and the chisel removed |
| **North** (Garden) | T4 Flooded Colonnade (her reflection on the true stones) → Turned Ones → votive (votive_n moves to the garden door) → Our Steps (v1.1d as is) → Court of Light → Tree of Shards → Mist Maze: the lamp shows her red footprints; at the end, **N Beacon** | the amphora, the dry ring and the puddle removed; the Beacon stands at the maze end |
| **East** (High) | UC (dark) → Balcony with bench → Singing Stones (moved onto the Ledge: 4 stones, the melody plays once by itself, step them in order) open the Walk panel → Mirror Walk (patrol) → Upward Spring → Scales: the platform rises, **E Beacon** at the top → Eidolon Plate on the Ledge (E.6, the I.1 echo: it lowers EB, the way to the Gate) | the tuning pin removed; the Echo Corridor becomes a pause (the relief panels) between the Maze and the Scales |

### Act 3: convergence (hints at 150 s)

| Beat | Where |
|---|---|
| I.20 the Pool of Halves (4 slabs) | at T, where you woke. It stays fogged until all 3 Beacons burn; then the fog lifts, the 4 slabs show, and the joins rise as a road (the v1 pool puzzle, moved to the end) |
| I.21 the bridge that gives way | T1 on the way back from the pool: a slab drops away behind you; no fall |
| I.22 the Gate of the Four | S, reached over EB: 3 veiled statues and an empty plinth; all 3 Beacons lit; stand STILL on the plinth (the sockets are gone) |
| I.23 the First Shrine | her palm on yours; she writes **ΒΡΕΣ ΜΕ** on the water; a glass eye opens in the depths; the Stillness rune; memory *"The veil was his, not mine."* |

## 3. Items

- Kept: **Lamp** (crypt: lit, pushed through the basin), **Shard** (Hall: pushed through the crack), **comb** (story item in the satchel, glows, does nothing).
- Removed from Chapter I: the chisel, amphora and tuning pin. Their models stay, for later chapters.
  - Cracked walls: the Atrium alcove becomes a Shard inscription; the other two become lamp/Shard secrets.
  - The dry ring and the puddle: replaced by the Maze footprints and the N Beacon.
  - Pin song and pin spring: removed. The e_panel opens via the Singing Stones.
- Seals → **Beacons**: not inventory. Each wing has a beacon brazier; the matching Atrium pillar lights with it. The hotbar shows only the lamp and the shard.

## 4. The Warden

- The prologue abduction (cinematic).
- He turns in the water at the crypt's basin.
- Mirror Walk patrol (kept) and rare sightings (kept).
- NEW: now and then, a planar reflection just ahead of you goes dark for a few seconds, mist-rimmed, and comes back. Never at a puzzle's solve moment.

## 5. Text

- Intro cards: §5 English text, each shown briefly mirrored, then flipped readable.
- Tablets (Theron, 8), true in feeling, false in fact.
- Memories (Ione, 7 for Chapter I): the answers to the tablets. Pairs, e.g. t1 *"She is not gone. Only behind the veil."* / m1 *"The veil was his, not mine."*
- Names everywhere: Theron, Ione, Kythira, Milos, Aphrodite.

## 6. Save v4 and migration

- `{"v": 4, ...}`. New chapter keys:
  - `act` (1, 2, 3);
  - `a1`: {plate, door, glass, slab, lamp, atrium};
  - `beacons`: {W, N, E};
  - `pool_lifted`;
  - `bridge_fallen`;
  - `comb`;
  - `prologue_seen`.
- `inv.items` holds only lamp and shard; `inv.story` holds the comb.
- From v3 (v1.x): any save past the Atrium has Act 1 done (comb, lamp).
  - The shard is kept if it was owned.
  - Seals W/N/E become beacons W/N/E, lit.
  - Socketed seals mean the Gate is solved.
  - Chisel, amphora and pin are dropped.
  - `stones` (the old first pool) is reset to unsolved unless the Gate was solved: the pool is now Act 3.
- From v2 (older): as today, then v3 → v4.

## 7. Phases (each ends green: playthrough, occlusion, overlap, smoke, plus the Our Steps touch test)

1. **Structure.**
   - Items cut to lamp and shard. Beacons replace the seals.
   - Gate condition: beacons plus standing still.
   - The north-shore walk; b1 shut.
   - Singing Stones on the Ledge open the e_panel. Hidden Way. Maze end Beacon.
   - Save v4 and migration. Playthrough rewritten for the wings.
2. **Act 1.**
   - Puddle plate and door; bell moved; one-stroke glass and low gate.
   - T1 single slab. New crypt with the lamp beat (Warden in the water); cot and tablet.
   - Atrium Beacon pillars, fountain basin and her head turn. Map opens.
   - 30 s hints.
3. **Intro and prologue.**
   - Mirrored-flip cards. The 12 shots of §5 (the double's half-second lag, two taps, the Warden rises and drags her, the shell comb falls through).
   - Hold to skip. The comb in the satchel.
4. **Act 3.**
   - Pool fogged until 3 Beacons, then the 4-slab pool. T1 crumbles.
   - The Gate's stillness. Shrine cinematic: ΒΡΕΣ ΜΕ, the glass eye, the Stillness rune. Hints at 150 s.
5. **Warden and text.**
   - Reflections extinguished ahead. Tablets and memories rewritten.
6. **Feel.**
   - Stick curve and acceleration, interaction anticipation, camera smoothing, hitch hunt.
   - Feedback on every action; hint timings per act. Every puzzle played through the real input path.
