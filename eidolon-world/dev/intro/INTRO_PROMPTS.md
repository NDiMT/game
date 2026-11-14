# EIDOLON · Intro: seven scenes on a turning amphora

The intro is one amphora, drawn by a script (stylised, not a photograph), seen close on its picture panel. Each
card is the painting in that panel; at every change of scene the vase turns and the next painting comes round. The
words appear on the black band under the panel, a sentence or two at a time, in the game's own letter. In each
painting one simple thing happens, once, and then the picture stands still.

Everything is in `amphora/`:

- `character_sheet.jpg` — Theron (standing, kneeling) and Ione in her four states: marble statue (all white, no
  face), just come alive (in colour, still no face), with her face, and veiled (the veil hides hair and face).
  Every scene is drawn from this one sheet, so that he and she are the same people throughout.
- `panels/card1.jpg … card7.jpg` — the seven paintings, flat, as they are wrapped onto the vase; `all_scenes.jpg`
  shows them together. Card 2 has two more: `panels/card2_statue.jpg` (as it begins: she is still marble) and
  `panels/card2_end.jpg` (as it ends: she has stepped down).
- `layers/cardN/` — each painting cut into layers (every element alone on a transparent ground, at 2048 px, plus
  the bare clay background and, in cards 5 to 7, the band of sea).
- `prompts/` — the prompts they were made with (Gemini image model `gemini-3-pro-image`).
- `tools/gen.py` sends a prompt and reference images to the model (the key is read from a private file outside the
  repository). `tools/install.py` turns the drawings into panels. `tools/vase.py` draws the vase, wraps the paintings
  on it, turns it, writes the words, moves the small things, and writes the film. `tools/layers.py` cuts the layers.
- `clips/cardN.mp4` — the moving pictures (the painted figures in motion; each plays once; card 2 has two, a and b).
- `intro_amphora.mp4` — the film (1080×1920, 24 fps).

## The words (one card each; a new line here is a new page on the vase)

1. On Kythira there lived a sculptor named Theron.
   From white marble he carved a woman, and loved her more than stone should be loved.
2. After Theron's prayers, Aphrodite gave her life, on one condition:
   "Leave her face smooth. A face is carved by living, from within."
3. They called her Ione. And life began to carve her a face, a face the sculptor had never imagined.
   He could not bear a face he had not carved himself.
4. So he covered her face with a veil, so that he need not see it.
   And he hid every mirror, so that she never would.
   For as long as she had not seen her own face, she was still only what he had made.
5. But there was one mirror he could not hide: the sea.
   One morning the Aegean lay still as glass, and at the water's edge Ione saw a veiled woman looking up at her.
   She had never seen her before.
6. She wanted to see her closer.
   So that morning Ione rowed out alone, to where the water lay stillest, and leaned over the side to look.
7. The sea took her. There was no wave to blame.

## How the pictures were made

1. **Style**: authentic Attic black-figure: flat black slip figures in profile with incised lines, added cream-white
   (marble, women's skin), added red (cloth), on warm orange clay.
2. **Character sheet** first (`prompts/character_sheet.txt`), six figures in one row.
3. **Each scene** (`prompts/cardN.txt`) is drawn new from the sheet alone: the model gets the sheet and a description
   of the scene, and is told that the people must be exactly those of the sheet. The seven scenes were drawn a second
   time from nothing, this time *for the movement*: every figure stands in a quiet, stable pose in strict profile
   with both feet on the ground, figures do not overlap unless they must, and there is room where someone is going
   to move (empty ground in front of the block in card 2, shore in front of her in card 5). What used to go wrong in
   motion is simply not in the pictures: no oar (card 6, 7), the veil already on her head with only its front edge
   still to come down (card 4), the reflection's arm white from the start (card 6).
4. **Into panels** (`tools/install.py`): cropped square (the sea scenes are cropped to their sea, so that it runs
   from edge to edge), one clay colour for all seven, the added red turned to the red of Ione's dress in the game,
   and the sea given a deep sea colour.

## How the vase is drawn (what makes it the game's)

- The light is the game's: flat facets that turn with the vase, warm where the sun falls and lilac in the shade;
  no photographic shine; the black slip is a deep plum, never dead black.
- Behind it, the pale haze over the sea, with soft slanting light; the film begins and ends in that haze.
- The red is the red of Ione's dress; the sea is sea-coloured.
- The words are in the game's letter (EB Garamond Italic), large and clean over the old glaze.
- The vase is old: a net of fine cracks, breaks, flakes lost from the glaze. The words are not worn.

## How the figures move

One simple action in each picture, calm and steady, and then stillness. Each painting was given to a video model
(`gemini-omni-1.2-flash`, through `tools/genvid.py`) as the first frame of an 8-second clip; the prompt
(`prompts/motion/cardN.txt`) names the one thing that happens and says that everything else, the camera and the
drawing itself do not change. The clips are in `clips/`.

Card 2 is two clips that run on as one, each made between two pictures (`LAST=n` in `tools/genvid.py` gives the
last frame):

- **a, the statue comes alive**: from `panels/card2_statue.jpg` (the same painting with her all in white marble,
  `prompts/card2_statue.txt`) to the painting itself. Colour rises through her from the feet to the head; she does
  not move.
- **b, she steps down**: from the very last frame of clip a (`FIRSTIMG=` in `tools/genvid.py`) to
  `panels/card2_end.jpg` (she stands on the ground beside the block, `prompts/card2_end_pose.txt`). Given only a
  first frame the model kept her on the block, or slid the block along under her; given where she must end, she
  steps down and stands there. Beginning b on a's own last frame matters: when b began on the painting instead, her
  pose at the join was a little different and the two had to be dissolved into each other, which showed as a ghost.

`tools/join2.py join` puts the two end to end (and takes out the frames the model holds inside a movement, which
read as a stutter); `tools/vidprep.py` then treats them as one clip, cut where she has come to stand; `tools/join2.py
red` turns the red that rises in her dress to the game's red.

Card 3 was tried on a tall rock stair down to the sea, so that she would have a long way to come down: the video
model refused that picture every time (six tries, with and without the man, with and without the sea). On the low
rock it accepts her walking.

`tools/vidprep.py` turns a clip into the frames the vase wears: the clip's colours are fitted to the painting (each
channel by itself, on flat places only); where nothing ever moves, the painting itself is kept (so it stays crisp
and cannot shimmer); the clip is cut at its stillest frame after the action (`END=`), and places that must not move
can be kept as painted (`STILLBOX=`: in card 2 everything but her, in card 7 the veil on the water). `FITPANEL=`
and `PANEL=` name the painting a clip begins on and the painting kept where nothing moves, when they are not the
card's own (card 2a begins on the statue). On the vase
each picture is still as it comes round, begins a moment later, plays once, slows to rest over its last second, and
then stands still.

| Card | What happens |
|---|---|
| 1 | Theron's hand strokes the statue's cheek once and rests there; his head bows a little. He does not step; the statue, the branch and the bench do not move |
| 2 | she is white marble on the block; colour rises through her, feet to head, and she is alive (still without a face); then she steps down from the block, takes two small steps and stands, in profile, before the goddess's mirror |
| 3 | she takes a few slow steps on the rock, her hand at her cheek, the wind in her hair and shawl; in the doorway Theron lowers his hand, turns, goes inside, and the door shuts |
| 4 | her face is seen; then Theron draws the front edge of the veil down in front of it like a curtain, lets go, and lowers his arms |
| 5 | she takes a few small steps forward along the shore and stands; the woman in the water does the same |
| 6 | kneeling in the boat, she lowers her hand the last small way until her fingertips touch the water; rings spread |
| 7 | the empty boat rocks very slightly; on the shore Theron slowly holds out his open hand toward it, and keeps it there |

## What the intro holds back

The lifting of the veil, and the goddess stilling the sea, are not shown here: they belong to Chapters III and IV.
In cards 5 to 7 the woman stays veiled, and the sea is simply, strangely, still. What cards 5 and 6 do say is why she
goes: the sea is the one mirror left, she sees a woman in it for the first time, and she rows out to look closer.
