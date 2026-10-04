# STYLE.md — PSX Character Creator

Goal: a character creator in the style of the reference screenshots in /refs (cute chibi PSX low-poly, paper-like hair planes, pixel faces), with extra Y2K / NewJeans-inspired fashion packs.

## 1. Rendering (PSX)
- Render the 3D scene to a low-res WebGLRenderTarget (default 480x360, configurable), upscale to screen with NearestFilter. Keep aspect ratio.
- Vertex snapping: in the vertex shader, after projection, snap xy to a grid: `floor(clip.xy/clip.w * RES) / RES * clip.w` (RES ~ 160-240; uniform).
- Affine-like texture warp: optional uniform `affine` (default 0.5) mixing perspective-correct and affine UV.
- Textures: NearestFilter, no mipmaps, no anisotropy. Sizes: face 128x128, patterns 32x32.
- Lighting: Gouraud/Lambert, one directional + ambient. No shadows, no PBR, no bloom.
- Optional post: colour quantization + dither (uniform, default OFF).
- Background of the page UI is NOT rendered in 3D (CSS checkerboard). Canvas has transparent background.

## 2. Character body
- Chibi proportion: head ~ 1/3 of total height. Head is a rounded low-poly box (about 8-12 faces per side group), not a smooth sphere.
- Parts (separate meshes): head, torso, armL, armR, handL, handR, legL, legR, footL, footR.
- Body triangle budget: <= 800 total (excluding hair/clothes/accessories).
- Colouring: vertex-colour vertical gradient (lighter top -> darker bottom, ~15-25% darker) on skin, clothes, hair. Gradient strength is a uniform.
- Default pose: slight A-pose, arms out ~25 degrees. No animation required except auto-rotation (turntable).
- Skin colour is user-selectable (colour picker + 8 presets).

## 3. Face system
- One 128x128 canvas texture on the face quad of the head, composed of 3 layers: skin base -> eyes layer -> mouth layer. Optional blush layer.
- Eyes: 12 styles (round, half-lidded, angry-brow, sleepy-brow, droopy, blush-closed arcs, "u u", ">_<", pill, dot, spiral, flat-closed). Mouth: >= 6 styles (smile, cat-mouth, flat, open, small-o, tongue-out).
- Drawn procedurally on canvas with a limited palette (<= 16 colours), 1-2 px black pixel outline, no anti-aliasing (`ctx.imageSmoothingEnabled = false`, draw at 32x32 then upscale 4x).
- Eyes are large (about half of the face width in total).
- Changing a choice only redraws the canvas and sets `needsUpdate = true`.

## 4. Hair (11 styles + none)
- Built from several flat double-sided planes/strips ("paper" look) with jagged edges. Not volumetric.
- <= 150 triangles each. Single colour with vertex gradient; colour user-selectable.
- IDs: hair_01 ... hair_11 (see catalog.json for descriptions). Option 0 = none.

## 5. Clothes, shoes, accessories
- All items defined in catalog.json with: id, slot, label, tags (style packs), colorSlots, anchor/coverage, maxTris, pattern.
- Slots: top, outer (layered over top), bottom, socks, shoes, hair, headwear, eyewear, neck, waist, wrist, bag.
- Every colour slot is user-selectable. Patterns (plaid, stripes, star, denim wash, pleats) are generated on a 32x32 canvas with Nearest sampling; the pattern uses colorSlot[0] as main and colorSlot[1] as secondary.
- Cropped tops: expose a strip of skin at the waist. Low-rise bottoms: lower waistline to hip so skin shows between top and bottom.
- Pleated skirts: 6-8 vertical planes (not a smooth cone). Wide pants: tapered boxes, wider at ankle.
- Logos/crests/stars are 32x32 canvas decals, ORIGINAL designs only.
- Layering rules: outer hides nothing but must be slightly larger (scale 1.04-1.08) than top. Bottom hides legs under it. Socks drawn under shoes.

## 6. Style packs (tags) and presets
- preppy: plaid pleated skirt, tennis skirt, cropped knit vest, polo, blazer with crest, white long socks, white sneakers, choker.
- street: wide cargo pants, off-shoulder crop top, beanie, platform sneakers, big sunglasses.
- denim: low-rise jeans, denim shirt, denim jacket, baguette bag.
- sport: crop jersey, knee socks, sneakers.
- colorblock: monochrome set; "auto colour-block" button picks one hue and derives shades for top/bottom/shoes.
- Presets list is in catalog.json -> "presets". UI shows a "Style" tab to apply a preset in one click.

## 7. UI (match screenshots)
- Page background: yellow/orange checkerboard (CSS), orange frame border (~10px).
- Title text: pixel font, red with dark drop shadow (use a free pixel font or CSS text-shadow with `image-rendering: pixelated`; no copying of site assets).
- Left: a pink vertical column of round thumbnails = currently selected items of the active category. Next to it a coloured panel (colour changes by category) with a title and a 2-column grid of round thumbnail buttons.
- Bottom: 5 round category buttons: Face (eye icon, orange), Head (hair/headwear, green), Top (blue), Bottom (purple), Shoes (pink). Extra tabs allowed for Accessories and Style presets, same visual language.
- Top right: three buttons: AUTO ROTATION (pink), RANDOM (purple), RESET (orange).
- Colour picker for every selected item (swatch row + custom input).
- Rotation: mouse drag, arrow keys, A/D, touch drag. Auto-rotation toggle.
- Layout must work in portrait mobile (panel collapses to bottom sheet).
- Thumbnails: render each item once to an offscreen canvas at 64x64 (or draw procedural icons) and cache.
- UI layout follows `ui-psx-mockup.png`


## 8. Config / save format
```json
{
  "skin": "#f5d5bf", "eyes": 3, "mouth": 1,
  "hair": {"id": "hair_07", "color": "#ffffff"},
  "headwear": null, "eyewear": null,
  "top": {"id": "top_jacket", "colors": ["#9b4d6f"]},
  "outer": null,
  "bottom": {"id": "bot_long_skirt", "colors": ["#3a5ca8"]},
  "socks": null,
  "shoes": {"id": "shoe_sneaker", "colors": ["#e8913a"]},
  "neck": null, "waist": null, "wrist": null, "bag": null
  "pose": {"preset": "pose\_default", "custom": null}
}
```
Saved to localStorage key `psxcc.v1`. Export/import as JSON file.

## 9. Acceptance checklist (use after every milestone)
- [ ] Rendering looks low-res and pixelated; vertex wobble visible when rotating.
- [ ] Head is ~1/3 of height; body parts are simple tapered boxes.
- [ ] Colours show vertical gradients, no smooth PBR highlights.
- [ ] Faces are crisp pixels with black outlines.
- [ ] Hair looks like flat paper strips.
- [ ] Every item has a colour option; changes apply instantly.
- [ ] UI matches layout in /refs (checkerboard, orange frame, pink left column, 5 bottom buttons, 3 top-right buttons).
- [ ] Works on mobile portrait; keyboard/mouse/touch rotation OK.
- [ ] Triangle budgets respected (log counts in console in dev mode).
- [ ] No copied assets, no real brand logos.
- [x] (M6.5) Rendering low-res/pixelated ✓; head ~1/3 ✓; gradients ✓; face crisp ✓; paper hair ✓; colour options ✓; UI layout ✓; mobile portrait ✓; triangle budgets unchanged (rig split +12 tris/leg, sleeves unchanged) ✓; no copied assets ✓.

## 10. Pose system (M6.5)
- Joint hierarchy of THREE.Groups (root → hips → waist → chest → neck → head; chest → shoulder → elbow; hips → thigh → knee → foot). No skinning, no skeletal libraries.
- Pivots at true joints; fixed rotation order (root YXZ, joints ZXY); all angles clamped to LIMITS.
- 9 presets in catalog.json ("poses"): default, wave, hands on hips, peace, walk, run, salute, arms up, sit. Interpolated over ~0.25 s at 12-15 fps steps on switch; sliders apply immediately.
- Pose tab: preset grid with cached 64x64 chibi stick-figure thumbs; manual sliders grouped (Body / L arm / R arm / L leg / R leg) with numeric readout + reset dot; MIRROR / SYMMETRY / RESET pose buttons.
- Slider edits switch config to preset "custom" seeded from the last preset; MIRROR copies one arm/leg to the other (twist sign flipped).
- Collision guard (analytic, no physics): palm tip tested against head box and torso core; offending raise/forward/elbow shrunk iteratively. Feet auto-level: `foot.rotation.x = (forward − knee)` keeps soles flat in walk/run/sit.
- Clothing follows the rig: tagged pieces re-parented to joints at rest with world-preserving `attach()` (sleeves → shoulder, pant tubes + socks + boot shafts split at the knee, skirts/shoe pairs → hips/shin). Skirt cones and pant tubes flare (scale x/xz up to ~1.25) with leg spread AND forward lean; long hair shifts back when arms are raised.
- Sit preset folds legs within slider clamps + internal `drop` 0.12 (keeps feet on the ground; long skirt hides the fold).
- Preset "custom" saved in config; old saves (no pose key) load as pose_default. RANDOM picks a random preset (not random sliders); RESET returns to pose_default.
