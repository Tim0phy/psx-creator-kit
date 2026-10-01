# PLAN.md — Milestones (do one at a time)

M0 Setup: Vite project, git init, scripts: dev, build, shots (Playwright screenshot of the page at 1024x768 and 390x844 into /shots). Empty page with checkerboard + frame.
M1 PSX renderer + base body: low-res render target, vertex snapping, base chibi body with vertex-colour gradient, turntable + drag/keys/touch rotation, Auto Rotation button.
M2 Face system: canvas face texture, 12 eyes, 6 mouths, skin colour picker. Left pink column + eyes panel (2-col round buttons) + category bar (Face only).
M3 Hair: hair_01..hair_03 first (screenshot review), then the remaining 8. Hair colour picker.
M4 Tops/outer + bottoms + shoes + socks (base set from catalog.json). Colour pickers per item. Layering rules.
M5 Accessories: ears (cat, bunny), glasses, headwear, neck, waist, wrist, bag with anchors.
M6 Y2K / NewJeans style packs: remaining items from catalog.json, patterns (plaid, stripes, star, denim), Style tab with presets and "auto colour-block".
M7 State: Random, Reset, localStorage, JSON import/export, thumbnails cache.
M8 Polish + export: GLTFExporter (.glb), mobile layout, performance check, README.
After each milestone: build, screenshot, compare with /refs, tick STYLE.md checklist, commit, stop and report.
