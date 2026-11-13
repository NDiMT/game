# EIDOLON · Intro: seven scenes on a turning amphora

The intro is one amphora, drawn by a script (stylised, not a photograph), seen close on its picture panel. Each
card is the painting in that panel; at every change of scene the vase turns and the next painting comes round. The
words are written like a vase inscription on the black band under the panel. Small things move inside the paintings.

Everything is in `amphora/`:

- `character_sheet.jpg` — Theron, and Ione in her three states (marble statue, alive, veiled). Every scene is drawn
  from this sheet, so that he and she are the same people throughout.
- `panels/card1.jpg … card7.jpg` — the seven paintings, flat, as they are wrapped onto the vase.
- `prompts/` — the prompts they were made with (Gemini image model `gemini-3-pro-image`).
- `tools/gen.py` — sends a prompt and reference images to the model (the key is read from a private file outside
  the repository). `tools/vase.py` — draws the vase, wraps the paintings on it, turns it, writes the words, moves the
  small things, and writes the film.

## The words (one card each)

1. On Kythira there lived a sculptor named Theron. From white marble he carved a woman, and loved her more than
   stone should be loved.
2. After Theron's prayers, Aphrodite gave her life, on one condition: "Leave her face smooth. A face is carved by
   living, from within."
3. They called her Ione. And life began to carve her a face, a face the sculptor had never imagined. He could not
   bear a face he had not carved himself.
4. So he covered her face with a veil, so that he need not see it. And he hid every mirror, so that she never
   would. For as long as she had not seen her own face, she was still only what he had made.
5. But there was one mirror he could not hide: the sea. One morning the Aegean lay still as glass, and at the
   water's edge Ione saw a veiled woman looking up at her. She had never seen her before.
6. She wanted to see her closer. So that morning Ione rowed out alone, to where the water lay stillest, and leaned
   over the side to look.
7. The sea took her. There was no wave to blame.

## How the pictures were made

1. **Style**: authentic Attic black-figure: flat black slip figures in profile with incised lines, added cream-white
   (marble, women's skin), added matt purple-red (cloth), on warm orange clay.
2. **Character sheet** first (`prompts/character_sheet.txt`): Theron standing and kneeling; Ione as a marble
   statue (all cream-white, blank face), alive (white skin, long black hair, purple-red dress with a black hem), and
   veiled (the same, a long purple-red veil over head and face).
3. **Each scene** (`prompts/cardN.txt`): the model gets the character sheet and a composition, and is told to keep
   the composition and draw the people exactly as on the sheet. The picture is flat and evenly lit, with plain clay
   to all four edges: the vase, its ornament bands, its light and its turning are added by `vase.py`.

## What moves in each painting

| Card | Small movements |
|---|---|
| 1 | a light passes over the marble; the olive branch stirs; the waves run |
| 2 | Theron bows as he prays; she sways on her first step; a spark on the goddess's mirror |
| 3 | her hair and her dress in the wind; the waves run |
| 4 | the one bare mirror shines; the cloth that waits for it stirs; a spark on the hand mirror |
| 5 | the gulls hang in the air; the sun's road and the woman in the water tremble |
| 6 | the boat rides; what the water shows of it trembles |
| 7 | the veil moves with the water; rings widen where she went down; the boat's reflection trembles |

## What the intro holds back

The lifting of the veil, and the goddess stilling the sea, are not shown here: they belong to Chapters III and IV.
In cards 5 to 7 the woman stays veiled, and the sea is simply, strangely, still. What cards 5 and 6 do say is why she
goes: the sea is the one mirror left, she sees a woman in it for the first time, and she rows out to look closer.
