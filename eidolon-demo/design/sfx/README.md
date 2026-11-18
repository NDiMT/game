# Sound cues (Lyria 3.5, second set: melancholic)

The owner did not like the first Lyria set; this set was asked "more melancholic" (17/11/2026). Each prompt here
was run twice with `genmus.py` (MODEL=lyria-3.5). Lyria ignores silences and keys: it returns ~60 s of music, so
each cue is a cut of one take, retuned with ffmpeg `rubberband` (pitch only) onto the notes the Lament shares with
its D-minor turns (A C D E F G), so that a cue does not clash with the music wherever the player meets it.

| cue (`sfx/<cue>.ogg`) | take, seconds | retune | what it is | where |
|---|---|---|---|---|
| play_note | play_note_b 4.85-8.35 | +1 | low E minor pluck and cello, 3.5 s | PLAY, "tap to begin", "tap to play again" |
| line_sigh | line_sigh_b 9.92-16.6 | +5 (formant kept) | solo voice F-E-D-C-D, a sigh | each story line (not the last: the gate cue carries it) |
| stones_rise | stones_rise_a 8.8-14.9 | +1 | strings and choir swell E to F, 6 s | the winch: the stones come up |
| gate_pass | gate_pass_a 9.8-26.0 | -2 | rise, the peak at 1.15 s on the flash, voice climbs, long fade | into the gate (the music has faded out) |
| no_move | no_move_b 1.38-2.78 | 0 | soft low D pluck | a swipe where she cannot go |

Levels in the game since 18/11/2026 (files peak at -3 dBFS; the music plays at -2 dB, the Lament at -16.3 LUFS, and
nothing ducks under the cues): play_note -2.5 dB, line_sigh -4, stones_rise -6, gate_pass -2.5, no_move -8. They were
5-10 LU lower (-8.3, -10, -11, -4.3, -14), and on an Android phone's speaker the owner heard none of them over the
music: a cue cut from music under music must be about as loud as the music to be heard as a sound of its own.

`gate_hum.txt` was generated too but is not used: Lyria gave a moving chord loop (Am Em F G), and a loop that keeps
its own chords under the Lament clashes with it near the gate.

# Real sounds (18/11/2026: the owner asked for "real sounds too": steps on stone, the water and foam as the stones come up, the winch turning, the passing through the gate)

Cut and mixed by `tools/sfx_real.py` from CC0 recordings on OpenGameArt (no credit needed; given here all the same):

| sound (`sfx/<name>.ogg`) | from | made how | in the game |
|---|---|---|---|
| step_1..4 | "Different steps on wood, stone, leaves, gravel and mud" by TinyWorlds (opengameart.org/content/different-steps-on-wood-stone-leaves-gravel-and-mud), `stone01.ogg` | the heel's tap lifted (+6 dB at 2.6 kHz: a phone's speaker plays little under 300 Hz), held a little, four pitches | one at each footfall of her walk (`IVW_STEP_AT`: where in the clip each heel comes down, measured on the model), -1 dB ±; the steps of a turn on the spot 5 dB softer; one as she stops |
| stone_surface_1..3 | "40 CC0 water / splash / slime SFX" by rubberduck (opengameart.org/content/40-cc0-water-splash-slime-sfx): `splash_04`, `loop_water_02`, `loop_bubbles_02` | the splash without its plunge, then the water running off for 2.5 s, the foam fizzing under it; held so the water can be heard | each stone as it breaks the sea (`_ivw_emerge`), -7 dB, pitch ±7 % |
| winch_turn | "Chain winch sounds" by bart (opengameart.org/content/chain-winch-sounds), clicks from `winch - Marker #8`; "stone_rock_or_wood_moved_no_tick" by omegagreg; `clank1` from "Mechanical Sounds" by BMacZero | a ratchet click at each of 18 teeth as the wheel goes round once in 1.6 s, slow-quick-slow as the game turns it; the stone drum grinding under; a clank as it holds | as the wheel starts to turn, -3 dB |
| gate_light | "Teleport Spell" by Ogrebane (opengameart.org/content/teleport-spell) | its low end thinned, a little presence | at the gate, its swell's height (0.33 s in) on the flash, with gate_pass; -3.5 dB |

Loudness by EBU R128 (`ffmpeg -af ebur128`, the highest momentary value): the Lament at -2 dB peaks near -13 LUFS-M; a
step comes to about -27, a stone's water to -24, the winch to -19, the gate's light to -16. Spectrograms judge a sound
better than the audio model here: asked twice, it said opposite things of the same clip.
