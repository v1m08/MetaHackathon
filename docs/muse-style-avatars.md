# Muse-style avatars

How the Hangout's muse-style critters were made, copied from `reconnect-prototype` so the same look can be applied to
new images. The prompts below are verbatim from that branch.

Sources:
- `scripts/generate-critters.ts`: style text, first draw, house-style restyle, Muse host
- `src/server/hangout/pipeline.ts`: how Muse Wonder designs each critter
- `src/server/hangout/art.ts`: mood edits and background cutout
- `scripts/critter-moods.ts`, `scripts/cutout-critters.ts`: batch runners

The app shows the **soft** style: white-background originals in `public/seed/critters/soft/`, transparent cutouts in
`public/seed/critters/art/`.

## The pipeline

1. **Design (Muse Wonder).** Picks an animal, a pastel fur color, one prop and a caption for each friendship.
2. **First draw (Muse Image).** The soft-style prompt plus that design draws the critter on a white background.
3. **House-style restyle (Muse Image edit).** One approved drawing is used as the anchor. Every other critter is
   redrawn from it, so the whole set shares one style and only the animal, color and prop change.
4. **Moods (Muse Image edit).** The critter is edited into awake, sleepy, napping and celebrating poses. The character
   stays the same; only the expression and pose change.
5. **Cutout.** Removes the white background and crops to the character, then bottom-aligns it on a 512px transparent
   square and saves it as webp.

Model: `muse-image-1.0` (`MUSE_IMAGE_MODEL` or `MODEL_IMAGE`), at 1024x1024.

## 1. Design: Muse Wonder system prompt

```
You design a small friendship critter. Base every choice on this friendship's specific shared places or inside jokes. No em-dashes.
1. Parts: pick body, color and accessory IDs only from the lists, and write one short line on why (max 14 words) that names the place or joke.
2. art: design its soft plush-animal look for an illustrator.
   - animal: one cute real or storybook animal that fits this friendship, 2 to 5 words (e.g. "kitten with pointed ears"). Never a mascot, brand or existing character.
   - color: a soft pastel fur color, 2 or 3 words.
   - detail: one tiny prop or accessory taken from a specific shared place or inside joke, max 12 words.
   - caption: one line starting with "A" that names the animal and the place or joke, max 14 words.
```

The user prompt also lists the animals already in the Hangout:
`ALREADY IN THE HANGOUT (pick a different kind of animal and a different fur color): …`
That keeps every critter a different animal.

## 2. First draw: soft style prompt

```
An original kawaii plush animal character: a {animal} in {color}, {detail}. Minimal kawaii design: a big round head on a small rounded body, a smooth cream-colored face, two small shiny black dot eyes set wide apart, a tiny curved smile, soft oval pink blush, short nub arms and little feet. Photorealistic 3D render of a soft collectible plush with short, smooth felted fuzz in muted pastel tones, standing full-body facing the viewer, pure white background, soft diffused studio lighting, gentle shadow, centered, no text, no logos.
```

## 3. House-style restyle (image edit from the anchor)

Input image: the approved anchor drawing (`public/seed/critters/anchor/<id>.webp`).

```
Redraw this exact plush character as a different animal, keeping exactly the same art style: the same big round head with a smooth cream-colored face, the same small black dot eyes set wide apart, the same tiny curved smile and pink blush, the same body proportions with short nub arms and little feet, the same soft felted fuzz texture, lighting and plain white background. Make it a {animal} with {color} fur; only its ears, tail and small features show the animal. Remove any feature of the old animal this one wouldn't have (ears, tail, beak). Give it one small prop: {prop}. No other props, no text.
```

`{prop}` is the first part of the design's detail, cut at the first " and " or ", ".

## 4. Moods (image edit)

```
Keep this exact same character: same animal, colors, fur, accessories, art style, lighting and plain white background. Only change its expression and pose so it looks {mood}.
```

| Mood | Text |
|---|---|
| awake | bright, happy and wide awake: sparkling open eyes, a big warm smile, waving one paw hello |
| sleepy | sleepy: droopy half-closed eyes, a small yawn, head tilted a little, arms hanging relaxed |
| napping | fast asleep: eyes closed as gentle curved lines, a peaceful little smile, sitting down and slightly slumped as if napping |
| celebrating | overjoyed and celebrating: eyes squeezed shut in happy arcs, a big open smile, both arms raised high |

Keepsake edit (after a meetup):

```
Keep this exact same character: same animal, colors, fur, accessories, art style, lighting and plain white background. Keep its pose and expression too. Add one small detail: a tiny {keepsake} enamel pin on its chest.
```

## 5. Cutout

`cutout()` in `src/server/hangout/art.ts` (uses `sharp`):
- Flood-fills the white background from the edges. Pale characters get a gentler fill so the cut doesn't eat into them.
- Erodes the edge by 1px, then blurs it 1.4px so fuzzy edges stay soft.
- Crops to the character, scales it to 94% of a 512px square, bottom-aligns it 4px from the edge and saves it as webp
  (quality 90).

## Muse host (the star plush in the popups)

```
An original mascot for a cozy app: a small soft plush star-shaped creature in warm golden yellow with five rounded points, a smooth cream face in the center, two small shiny black dot eyes, soft pink blush, a tiny smile and little nub arms, holding a tiny glowing lantern. Photorealistic 3D render of a soft felted plush, pure white background, soft diffused studio lighting, centered, no text, no logos.
```

## Team profile pictures (photo → plush)

Each teammate's photo was upscaled to 1024px and edited with Muse Image. This is the soft style prompt with the face
kept in the person's own skin tone:

```
Turn the person in this photo into an original kawaii plush character. Minimal kawaii design: a big round head on a small rounded body, a smooth felt face in the same skin tone as the person, two small shiny black dot eyes set wide apart, a tiny curved smile, soft oval pink blush, short nub arms and little feet. Keep what makes them recognizable: {hair, glasses, outfit}. Photorealistic 3D render of a soft collectible plush with short, smooth felted fuzz in muted pastel tones, standing full-body facing the viewer, pure white background, soft diffused studio lighting, gentle shadow, centered, no text, no logos.
```

Nivan's plush got a second edit:

```
Keep this exact same plush character: same hair, black suit, bow tie, buttons, eyes, smile, pink blush, pose, felt texture, lighting and plain white background. Only change the felt color of its face, ears and hands to a warm light brown skin tone.
```

Each plush was then cut out of the white background and cropped to the head and shoulders. It sits on the person's
`MUSE_COLORS` background as a 256px webp in `public/demo/avatars/<id>.webp`, and `museAvatarFor` uses it.

## Rules that came with it

- Always an original character. Never a mascot, a brand or an existing character.
- One animal per person, with a different animal and fur color for each.
- One small prop, taken from something real about the person or friendship.
- No text and no logos in the image.
