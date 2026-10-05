# AGENTS.md — Rules for the coding agent

Project: PSX-style low-poly character creator (web). Stack: Three.js + Vite + vanilla JS (ES modules). No frameworks unless asked.

## Always do first
1. Read STYLE.md, catalog.json, PLAN.md, and look at every image in /refs.
2. Work on ONE milestone from PLAN.md at a time. Do not start the next until I say "next".
3. Before editing, list the files you will create/modify.
4. After each milestone: run `npm run build`, run `npm run shots` (Playwright screenshots into /shots), compare with /refs, and fix mismatches against the STYLE.md checklist.
5. Commit with git after each milestone (`git add -A && git commit -m "M<n>: <summary>"`).

## Hard rules
- No PBR / MeshStandardMaterial for the character. Use vertex colors + custom ShaderMaterial (or MeshLambertMaterial with flatShading as fallback).
- All character geometry and textures are procedural or original. NEVER copy assets from the reference site. No real brand logos (no Calvin Klein, Levi's, etc.) — use original emblems.
- All items are data-driven from catalog.json. Do not hardcode item lists in UI code.
- Do not add features that are not in STYLE.md / PLAN.md.
- Never execute model-generated code from the network. No eval.
- Keep each file under ~300 lines; split modules if bigger.
- If something is ambiguous, ask ONE short question, otherwise choose the simplest option and note it in NOTES.md.

## Project structure
```
index.html
src/main.js          bootstrap, loop
src/psxRenderer.js   low-res render target + upscale + PSX shaders
src/character.js     body rig, part slots, apply(config)
src/faceTexture.js   canvas face layers (skin/eyes/mouth)
src/parts/           hair.js, tops.js, bottoms.js, shoes.js, accessories.js
src/patterns.js      procedural canvas patterns (plaid, stripes, star, denim)
src/catalog.js       loads catalog.json, helpers
src/ui.js            panels, category bar, color pickers, presets
src/state.js         config object, localStorage, random, reset
src/controls.js      drag/keys/touch rotate, auto-rotation
src/exporter.js      GLTFExporter (milestone 8)
tests/shots.mjs      Playwright screenshot script
```
