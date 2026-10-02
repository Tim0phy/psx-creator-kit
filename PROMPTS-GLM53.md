# PROMPTS.md — GLM-5.3 Flash

## Operating mode
Use GLM-5.3 Flash for every milestone. You are both the visual QA agent and the frontend/Three.js implementation agent. Inspect reference images and current screenshots. Do not assume a working build is visually correct. Work on one milestone only, then stop.

## M0 — project shell
```text
Read AGENTS.md, STYLE.md, PLAN.md and catalog.json. Inspect every image in /refs.
Implement M0 only: create the Vite project, scripts (dev, build, shots), 1024x768 desktop and 390x844 mobile layouts with CSS checkerboard, orange frame, empty stage, placeholder panels, bottom category buttons and the three top-right buttons. Do not implement 3D character logic.
Before editing, list files. Run npm run build and npm run shots. Compare both screenshots with /refs, report the five largest visual differences, fix only those five, rebuild, and stop for approval.
```

## M1 — PSX renderer and base body
```text
Read all instructions and inspect /refs plus latest /shots. Implement M1 only: Three.js scene, low-resolution WebGLRenderTarget with nearest upscaling, transparent canvas, vertex snapping shader, one directional light plus ambient light, separate low-poly chibi body parts, mouse/keyboard/touch rotation and auto-rotation. Use original geometry only. Do not add face options, hair, clothes, random, save or GLB export. Log triangle counts. Build, screenshot at 1024x768 and 390x844, compare, fix only five largest differences, stop.
```

## M2 — face system
```text
Read AGENTS.md, STYLE.md, PLAN.md, catalog.json, /refs and latest screenshots. Implement M2 only: procedural 128x128 face texture with skin base, 12 eye styles, 6 mouth styles and optional blush. Draw pixel art at 32x32, upscale 4x, disable antialiasing, limited palette and crisp outlines. Add skin presets/custom colour input and the Face panel with pink selected column and two-column circular option grid. Update only the face texture when choices change. Do not implement hair/clothes/accessories/random/save/export. Test every option, build, screenshot both sizes, compare, fix five largest differences, stop.
```

## M3 — hair system
```text
Read all instructions, catalog.json, /refs and latest screenshots. Implement M3 only. First implement hair_01, hair_02 and hair_03 as original low-poly paper-plane geometry: double-sided jagged strips, flat shading, vertex gradient, selectable colour and head anchors, within maxTris. Review screenshots before adding hair_04 through hair_11 and none. Do not implement clothes/accessories/presets/random/save/export. Build, screenshot both sizes, compare, fix five largest differences, stop.
```

## M4 — base clothes <---2026.10.2 12:33
```text
Read all instructions, catalog.json, /refs and latest screenshots. Implement M4 only: base tops, outerwear, long pants, shorts, short skirt, long skirt, socks and base sneakers. Use data-driven items, selectable colour slots, correct layering, cropped/low-rise exposure, tapered pants and faceted skirts. Implement only catalog-specified procedural 32x32 nearest patterns. No logos or copied assets. Log triangle counts. Do not implement Y2K items/accessories/presets/random/save/export. Build, test every base slot, screenshot both sizes, fix five largest differences, stop.
```

## M5 — accessories and anchors
```text
Read all instructions, catalog.json, /refs and latest screenshots. Implement M5 only: accessory slots and named anchors; cat/bunny ears, glasses, sunglasses, beanie, caps, hair clips, hairband, choker, pendant, belly chain, bracelet and bags from catalog.json. Each must be original, low-poly, colourable and within maxTris. Add the accessories panel. Do not add items outside catalog.json or implement presets/random/save/export. Build, test every accessory, screenshot both sizes, fix five largest differences, stop.
```

## M6 — Y2K / NewJeans-inspired packs <---2026.10.3 03:20
```text
Read all instructions, catalog.json, /refs and latest screenshots. Implement M6 only: baby tee, knit vest, polo, off-shoulder top, crop jersey, denim shirt, original-crest blazer, denim jacket, bomber, low-rise jeans, cargo pants, plaid pleated skirt, tennis skirt, low-rise mini, metallic pants, striped knee socks, platform sneakers, Mary Janes and boots. Add nearest procedural plaid/stripe/denim/number/star/metallic treatments. Use original designs, no real logos. Add Style tab and catalog presets: Preppy, Street, Denim, Sport, Y2K, Colour block, plus auto colour-block. Keep low-poly PSX silhouettes and no PBR. Build, test presets/colours, screenshot both sizes, fix five largest differences, stop.
```

## M7 — state and persistence
```text
Read all instructions, catalog.json, /refs and latest screenshots. Implement M7 only using the STYLE.md config format. Add Random, Reset, localStorage key psxcc.v1, JSON export/import, valid-ID and colour validation, selection preservation and a dev-only state inspector. Test reload persistence, invalid JSON, unknown IDs, missing fields, random/reset and mobile controls. Do not implement GLB export. Build, screenshot both sizes, compare, fix five largest differences, stop.
```

## M8 — polish and GLB export
```text
Read all instructions, catalog.json, /refs and latest screenshots. Implement M8 only: GLTFExporter GLB export, JSON UI, portrait mobile bottom-sheet layout, focus/touch states, loading/error states and disposal of replaced resources. Keep config format and visual direction. Document that post-process pixel shader may not transfer to GLB. Test all tabs, presets, colours, random/reset, reload, JSON round-trip and GLB download. Build and screenshot both sizes, compare, fix five largest differences, then stop with an acceptance report. Do not add features outside STYLE.md and PLAN.md.
```

## After every milestone
```text
Do not continue automatically. Report files changed, commands and pass/fail, screenshot paths and viewport sizes, five largest visual differences before final fixes, remaining issues, triangle-count summary and checklist status. Then wait for my approval.
```
