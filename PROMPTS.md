# PROMPTS.md — copy/paste prompts

## 0. Kickoff (first session)
```
Read AGENTS.md, STYLE.md, PLAN.md, catalog.json and every image in /refs.
Reply with: (1) your understanding of the visual style in <=15 bullets, (2) the file list for M0 and M1, (3) any ambiguity (max 3 questions).
Do NOT write code yet.
```

## 1. Start a milestone
```
Start milestone M<N> from PLAN.md only. List the files you will create/modify first.
When done: run build, run `npm run shots`, view the screenshots against /refs, tick the STYLE.md section 9 checklist, fix failures, commit, then report what passes and what does not. Stop and wait for "next".
```

## 2. Visual fix loop
```
Compare /shots/latest.png with /refs/<ref>.jpg. List the 5 largest differences (proportions, colours, shading, UI layout, face). Fix only those 5, rebuild, re-shoot, re-compare. Max 3 rounds.
```

## 3. Bug report
```
Bug: <what you see>. Console/terminal error: <paste exact>. Expected: <expected>. Find the root cause first, explain in 3 lines, then make the smallest fix. Do not refactor unrelated code.
```

## 4. Add items from catalog (M4-M6)
```
Implement these catalog items: <ids>. Follow STYLE.md section 5 (cropped/lowRise/pleats/patterns, layering, <= maxTris). Log triangle counts. Provide a debug page ?debug=items that shows all implemented items on a grid for screenshot review.
```

## 5. Hand-off to a stronger cloud model (optional, for hair/clothes geometry)
```
Write geometry builder functions for these catalog ids: <ids>. Signature: `build(THREE, params) => THREE.BufferGeometry` with vertex colours (aa gradient attribute 'color'), flat paper-plane style, <= maxTris, anchored per STYLE.md. Pure functions, no DOM. Add a unit test that checks triangle count.
```

## 6. Context refresh (when the agent drifts)
```
Re-read STYLE.md and AGENTS.md. List which hard rules your last change broke, if any, and fix them.
```
