# EIDOLON · Intro: seven scenes on a turning amphora

The intro is one amphora, drawn by a script (stylised, not a photograph), seen close on its picture panel. Each
card is the painting in that panel; at every change of scene the vase turns and the next painting comes round. The
words appear on the black band under the panel, a sentence or two at a time, in the game's own letter. Small things
move inside the paintings.

Everything is in `amphora/`:

- `character_sheet.jpg` — Theron (standing, kneeling) and Ione in her four states: marble statue (all white, no
  face), just come alive (in colour, still no face), with her face, and veiled (the veil hides hair and face).
  Every scene is drawn from this one sheet, so that he and she are the same people throughout.
- `panels/card1.jpg … card7.jpg` — the seven paintings, flat, as they are wrapped onto the vase; `all_scenes.jpg`
  shows them together.
- `layers/cardN/` — each painting cut into layers (every element alone on a transparent ground, at 2048 px, plus
  the bare clay background and, in cards 5 to 7, the band of sea).
- `prompts/` — the prompts they were made with (Gemini image model `gemini-3-pro-image`).
- `tools/gen.py` sends a prompt and reference images to the model (the key is read from a private file outside the
  repository). `tools/install.py` turns the drawings into panels. `tools/vase.py` draws the vase, wraps the paintings
  on it, turns it, writes the words, moves the small things, and writes the film. `tools/layers.py` cuts the layers.
- `clips/cardN.mp4` — the moving pictures (the painted figures in motion, one loop each).
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
   of the scene, and is told that the people must be exactly those of the sheet. Three scenes then got a correction
   pass (`prompts/cardN_fix*.txt`): the picture itself is given back with one thing to change (the veil must hide
   the face completely; Theron's tunic and head as on the sheet; white skin).
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

The figures themselves move: hands, steps, cloth. Each painting was given to a video model (`gemini-omni-1.2-flash`,
through `tools/genvid.py`) as the first frame of a clip of up to 15 seconds; the prompt (`prompts/motion/cardN.txt`)
says what happens, in order, and that the camera, the ground and the drawing itself do not change. The action goes
forward and does not return: the clips are not loops. The clips are in `clips/`.

`tools/vidprep.py` turns a clip into the frames the vase wears: the clip's colours are fitted to the painting (each
channel by itself, on flat places only); where nothing ever moves, the painting itself is kept (so it stays crisp
and cannot shimmer). On the vase each picture is still as it comes round, then begins; it plays once, slows to rest
over its last second, and after that only breathes (a few of its last frames, very slowly, to and fro).

| Card | What happens |
|---|---|
| 1 | Theron strokes the statue's cheek, steps back to look at the whole of her, comes close again and lays his hand on her shoulder. The statue is stone and does not move; the olive branch sways |
| 2 | she steps down from the block and stands; nothing more (the clip is cut there: after it she turned toward the viewer) |
| 3 | she walks along the rocks into the wind, feeling her face, and stops by the water; Theron watches from the doorway, hides his eyes and goes inside |
| 4 | her face is seen first; then Theron lowers the veil over her hair and her face, smooths it, and stands (the painting was redrawn for this: she is unveiled in it, and he holds the veil above her) |
| 5 | she takes two small steps to the water's edge and stands there; the woman in the water does the same |
| 6 | she sits up and rows two strokes, lays the oar down, leans over the side and touches the water; rings spread (in the painting the arms of the woman in the water are white, as hers are) |
| 7 | the empty boat rocks; the veil drifts away; on the shore Theron walks to the edge, stretches out his arm, lets it sink |

Card 5 was first drawn with her bending over the water from a rock; the video model refused that picture three
times, so she was redrawn standing upright on a low shore (`prompts/card5_fix3_standing.txt`), which it accepted.

## What the intro holds back

The lifting of the veil, and the goddess stilling the sea, are not shown here: they belong to Chapters III and IV.
In cards 5 to 7 the woman stays veiled, and the sea is simply, strangely, still. What cards 5 and 6 do say is why she
goes: the sea is the one mirror left, she sees a woman in it for the first time, and she rows out to look closer.
