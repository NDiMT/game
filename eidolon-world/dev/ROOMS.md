# EIDOLON v0.5: Chapter I rooms (for the score)

These are the room ids that `audio.gd` looks up in `assets/audio/v5/manifest.json`, in play order.
Each room is one continuous space. Crossfades between rooms take about 3 s.

| # | room_id | Space | Mood (one line) |
|---|---|---|---|
| 1 | `waking_pool` | The Waking Pool | First breath after a long sleep: still water, a pale void, the faintest pulse of Eurydice's motif under the surface. |
| 2 | `stair_breath` | The Stair of Breath | A narrow exposed stair: wind on stone, a held breath; a small glass that fogs, an intimate whisper of the motif. |
| 3 | `hall_glass` | The Hall of Glass | Cold, resonant, crystalline; tall glass hum and slow tinkles; something on the other side remembers. |
| 4 | `shard_gallery` | The Shard Gallery | A corridor of broken mirror panes: shimmering, fractured, close; secrets just out of sight. |
| 5 | `garden_veiled` | Garden of the Veiled | Dead trees, veiled statues turning on their plinths; dry wind, far crows, grief held very still. |
| 6 | `hollow_walk` | The Hollow Walk | Uneasy stillness: empty statues that move only when you stop; sparse low pulses, stone that breathes. |
| 7 | `court_light` | Court of Light | Warmth returning: a low beam hum, a distant choir-like pad, a mural waiting for a shadow. |
| 8 | `mist_maze` | The Mist Maze | Lost in white: muffled, directionless, her footsteps in water as the only guide. |
| 9 | `echo_corridor` | The Echo Corridor | Long stone reverb, footsteps returning late; a hidden room with a memory of the sea. |
| 10 | `scales` | The Scales | Balance and weightlessness: slow metallic creaks, chains, a suspended tone. |
| 11 | `eidolon_ledge` | The Eidolon Ledge | Wind over the drop; the great glass; she walks beside you, the motif closest yet. |
| 12 | `gate_four` | Gate of the Four Veiled | Solemn, ceremonial: three statues and an empty plinth; a deep chord when you become the fourth. |
| 13 | `first_shrine` | The First Shrine | Sacred, deep; the awakening, then "The Hand in the Water" cinematic, the motif at its fullest. |

## Manifest schema

The schema the game reads:

```json
{"rooms": {"<room_id>": {"layers": [{"file": "...", "gain_db": 0, "loop": true}],
                         "events": [{"file": "...", "min_s": 20, "max_s": 60, "gain_db": -6}]}},
 "cues": {"solve_<room_id>": "...", "shrine_awaken": "...", "cinematic_hand": "...", "glimpse": "...",
          "breath": "...", "touch_glass": "...", "statue_turn": ["...", "..."],
          "footsteps_stone": ["..."], "footsteps_water": ["..."], "cloth": ["..."]}}
```

- File paths are relative to `assets/audio/v5/`.
- Until the manifest lands, the game falls back to the v0.4 layers.
