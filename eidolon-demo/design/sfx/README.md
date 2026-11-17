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

Levels in the preview mix (files peak at -3 dBFS): play_note -8.3 dB, line_sigh -11.9, stones_rise -12.6,
gate_pass -4.3, no_move about -14; the music ducks 4 dB under the lines and the stones.

`gate_hum.txt` was generated too but is not used: Lyria gave a moving chord loop (Am Em F G), and a loop that keeps
its own chords under the Lament clashes with it near the gate.
