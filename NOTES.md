# NOTES.md

## M7 後續修正（2026-10-05 用戶回報兩項）
- **角堆疊重疊**：我第一輪把 AUTO RANDOM RESET 搬成頂右直排（ref-hair 樣式），
  但右欄 colour panel 285px 直達右邊，purple/orange 按鈕壓住 SKIN TONE 藥丸
  （bounding-rect 相交驗證 stackVsRight=true），手機上仲疊住 nameBox。已還原
  mockup 式排列：RANDOM/RESET 回 #topBar（名稱框旁）、AUTO 回右上 absolute；
  §7 規定色（粉 AUTO / 紫 RANDOM / 橙 RESET）保留。
- **面部貼圖「不更新」**：pixel 級探針（auto-rotation 關閉、固定 yaw、真實
  UI 點擊）挑眼 1/12、嘴 2、skin 第 5 格全部即時重繪
  （renderEyes / mouthTex.needsUpdate / setSkin 路徑完好）；r6 全新 boot
  無法重現。屬 NOTES r4 已記載嘅「stale tab」陷阱（長開 tab 混住舊 module
  + 新 DOM）。加固：initNameSave / initJsonTransfer / renderSelection 對
  缺失 DOM id 做 null guard，stale 混載唔再令 boot 中斷。用戶側處理：完全
  關閉再重開 tab——標題顯示 `· r6` 先算新 build（HMR 之後 refresh 未必夠）。

## M7 状态系統 (2026-10-05)
- 保存格式按 STYLE.md §8 重寫：runtime state 維持 colors.main/secondary 物件
  （UI/建構器深度依賴），持久化一律經 `toSaveConfig()` → colors 變成按
  colorSlots 順序的**陣列**（colors[0]=main, colors[1]=secondary）、hair 帶
  {id,color}、pose 帶 {preset,custom}。`?`: §8 範例欠逗號且 top_jacket 其實
  屬 outer slot——照它是示意而非 schema。
- **額外欄位（documented deviation）**：save/config 內附加 body/blush/name
  三個 top-level 鍵（§8 沒有）：body 唔 persist 嘅話 reload 會丟失身型選擇
  （M8 已有嘅功能倒退），blush 同 name 係現有 UI 欄位。載入時不明鍵忽略。
- 驗證邊界統一：`applySaveConfig(state, saved)` 係 localStorage / JSON import
  共用入口，永不 throw，回傳 warnings：
  - 未知 item id → 該 slot 變 null（hair 例外：回 default hair_01，因為
    光頭睇落似壞檔而唔係選擇；明確 hair:null 仍然有效=無頭髮）
  - 跨 slot id（例： Shoes id 放入 bottom）→ none（catalogItem 連 slot 齊驗）
  - 顏色必須 #rgb/#rrggbb hex（isValidHex）；3位自動擴展；main 無效→#ffffff、
    secondary 無效→唔寫（recolor 派生深色）；named colour ("red") 拒絕
  - eyes/mouth 只收 1..12 / 1..6 整數；skin 同規則；body 只收 female/male
  - pose 經 sanitizePose；colors 淨係接 §8 陣列 + 舊版 runtime {main,...} map
    （pre-M7 已存在嘅 localStorage save 載入不斷裂）
- select保存（selection preservation）：ui.js pickCloth 帶埋前一個 item 嘅
  顏色（M5 修正保留）；M7 補上 category 切換/rebuild 無論邊條路徑都唔會掉色。
- RANDOM 補強：secondary colorSlot 都隨機上色（knit vest/watch/sock 手帶）、
  skin 由 catalog palettes.skin 隨機（之前只係唔郁）。RESET 照舊。
- CONFIRM / EXPORT / import 都經 toSaveConfig 校 sanitize 先寫出，psxcc.v1
  內容永遠係合法格式；import 之後 write-through localStorage（reload 保留）；
  parse 失敗 → INVALID toast + state 唔郁。
- dev-only inspector：?debug=state 先掛 #stateInspector（600ms poll，
  顯示 warnings + 當前 §8 config，COPY 複製）；一般 boot 零額外 DOM。
- 新模組拆分：state.js (266) / uiState.js (91) / uiDebug.js (39)；main.js
  只剩 wiring。舊 restoreInto/SAVE_KEYS 刪除（未驗證嘅 raw copy 路線）。
- Bug fix（history bug）：state.js applyUrlState 嘅 loop 從來唔包 hair，
  所以 ?hair=hair_XX 一直係死參數；hairShots/accShots 全部截咗 default 髮。
  M7 改 [ ...ALL_SLOTS, "hair"] + catalog 驗證 id。
- BUILD beacon r5 → r6。
- UI 與 /refs 對比後五項最大差異修正（STYLE §7）：
  ① 三個 top-right 按鈕獨立成堆疊 + spec 色（粉 AUTO/紫 RANDOM/橙 RESET，
    ref-hair.png 同款）；② grid 縮圖 + 右欄色板改圓角（round thumbnails）；
  ③ 分類列底部加木 capsule 底（兩張 ref 圖都有）；④ 粉色「current selection」
    直列（#leftSelection，active category 嘅已選項圓縮圖；手機隱藏）；
  ⑤ 左 panel 顏色跟分類變（CAT_COLORS，mockup 綠框 HAIR；只染 pill+grid
    兩張卡，唔染下面留白）。
- 測試：tests/m7State.mjs（Playwright，34 項全部 PASS、0 pageerror）—
  reload 持久化 / 非法 JSON / 未知 id / 缺欄位 / 色碼驗證 / 隨機+重置 /
  選擇保留 / export+import round-trip / inspector 出現與否 / 手機拖拽轉。
- GLB export 屬 M8，無依家實現。

## M3 修訂（2026-10-01 男生髮型修整）
- `capGeo` 加 `shortY` / `backY` 選項：男仔髮型（06/08/10）兩旁同後面可以獨立收短，
  並會切走 cap 嘅底面平板，避免懸浮裙邊。female 款不傳參數，行為不變。
- `cutHeight`：`swept` / `teeth` 現在只影響面窗（|cx| <= faceW），側面切線保持平直，
  清走側邊牙狀碎片。
- hair_04 穿窿（左上方）：原因係 `swept` 將切割線推到 `maxCut: 0.26`，切埋
  cap 前頂 bend band 嘅三角面，形成孤立破洞露出頭皮。規則：`maxCut` 必須
  <= capH * 0.25（第一行 row 線，h=0.72 時即 0.18）令切割唔會掂到 bend。
  設定 `maxCut: 0.18` 後窿消失，fringe 斜度保留。
- hair_06 重做成尖刺男仔髮型：12 條大小不一嘅皇冠刺向後/橫掃（參考用戶附件
  圖片：rooster 式向後上）。70 tris。
- hair_08 轉做剷青（buzz cut）：貼頭嘅 snug cap（capW 0.9 / capH 0.64 / capD 0.8），
  眉上髮線，兩旁後面統一 short，無長髮裙邊。43 tris。
- hair_10 轉做短髮斜陰：swept 斜 fringe（右高左低）加 zig-zag 瀏海尖端，
  兩旁 short、後面 nape 略長（backY -0.12）。69 tris。
- catalog.json label：hair_06 "spiky (m)"、hair_08 "buzz cut (m)"、
  hair_10 "side fringe (m)"。
- 新增 `tests/hairShots.mjs`：用 `?hair=hair_XX` 識別，逐個髮型截 front/angle/back
  三張圖入 /shots，方便核對。`src/main.js` 順手加咗個 debug URL 參數 seed。
- 取捨：全部三角面切割用 centroid 就咁切（paper 風格鋸齒邊自然），無做頂點插值。

## M3 第二輪修訂（同日）
- 用戶補充多角度參考圖，hair_06 再次重做：星爆式（star burst）— 鏡像鋸齒 V 劉海
  （teeth 0.1, teethW 0.3）、兩旁橫向 temple 刺、後腦同冠位放射狀短刺
  （新增 radialSpike helper：setFromUnitVectors 定向, base 沉入 cap）。67 tris。
- 06/08 修正鏡像劉海：teeth parity 改為 Math.round(abs(cx)*7)%2，左右對稱。
- 8/10 號左方突出三角：牙齒超出面窗（|cx|>faceW 0.34）造成 stray；
  新增 teethW 限制牙齒跨度，冇咗 stray。43/68 tris。
- hair_10 斜陰加強：swept 0.55、移除 teeth，fringe 由右高直斜到左低。
- 截圖覆核（crop 放大 3x）：06 三視圖呈星爆、08 正面劉海鏡像、10 斜 fringe
  正面/側面一致、無 left stray、back 剷短 — 全部過關。

## M3 第三輪修訂（hair_08）
- 藍圈 stray 三角：新增 faceW 0.28 + teethW 0.22，牙齒同面窗遠離邊界，
  側邊 boundary step 衛生面消失。
- 紅圈斜向反轉：加 swept -0.16（負值 = 熒幕左高右低），劉海由左上斜去右下。
- 截圖覆核 front/angle 過關，46 tris。

## M3 第四輪修訂（hair_10）
- 紅圈低位掃尾三角剷除：swept 0.55 -> 0.3 + faceW 0.3，斜陰右上->左下
  保持，但 fringe tip 收喺眼角之上，乾淨收尾。
- 後方漂浮紙片：刪走 addStrip（舊 nape tuft 懸浮喺 cap 後面）。
- crown 加高 capH 0.62，back nape 保留 backY -0.12。54 tris。

## M3 第五輪修訂（hair_10 按參考圖重做）
- 參考圖：貼頭 cap + 眉上單一斜 fringe（左上->右下，同 hair_08 同向），
  無牙、無低位掃尾。
- 直接用 capGeo：capW 0.92 / capH 0.62 / capD 0.82 貼頭，openY 0.1 貼眉，
  swept -0.22 由左上斜去右下；faceW 0.6 令切線橫跨整個 cap 前面，
  唔再有面窗 boundary step（紅圈 wedge 成因）。
- capGeo 加 capSegY 選項（hair_10 用 6）：fringe 切線階梯細咗。
- 無 addStrip / 無額外零件，全部由 cap 本身切出。66 tris。

## M4 final round
- Fixed `?hair=none` crash in applyHair (main.js): empty hair slot now removes
  the anchor child and returns instead of destructuring null.
- top_jacket: added two front lapel panels (0.16x0.52x0.06 at x +/-0.16 over
  the tee) so the open-front outer reads as a jacket instead of a sweater;
  46 -> 70 tris (max 150).
- Verified by isolating slots (?top=none / ?bottom=none&socks=none&shoes=none):
  the earlier red sliver between legs above the shoes is gone with current
  layering (top -> outer -> bottom -> socks -> shoes remount order).
- Tris screen-logged for every item (all under catalog maxTris); default outfit
  PSXCC.tris() ~397, pants+socks ~457. Body-only budget <=800 kept.
- Decisions (see M4 notes above): socks included despite no "base" tag
  (user asked for socks); only the stripes PatternTexture implemented; torso
  stays the white M1 "shirt" under tops on the base body for now.

## M4 fix: top/outer interpenetration
- Reported: top tee (1.06 envelope) and outer jacket (1.08) sat only ~2% apart
  -> clipping / z-fighting (flicker) when both slots worn.
- Fix: outer envelope widened to 1.14, outer sleeves 1.2 -> 1.26 (tops.js) so
  there is a clear gap around the top.
- Verified with 5 yaw angles (tests/m4zf.mjs, shots/m4_zf_*.png): open front
  shows the tee cleanly, no flicker/clipping from front/side/back.

## M4 fix: pant/top clipping + shorts/skirt readability (user feedback)
- Cause of top/bottom穿模: waistband 8-gon mouth (r 0.355 -> half-w 0.328) and
  skirt mouth (r 0.34 -> 0.314) were wider than the tee shell (half-w 0.297),
  and the hips block (0.66..0.6 wide, d 0.34) intersected the shell too.
- Fix (bottoms.js): waistband + skirt mouths r 0.32 (half-w 0.296, just inside
  the tee shell); hips block narrowed to 0.56..0.5 wide, depth 0.3.
- bot_short_skirt: hem 0.38 -> 0.46 above ground, flare 0.5 -> reads as a real
  waist-to-thigh short skirt instead of a dress; legs show below the hem.
- Verified pants/shorts/short skirt/long skirt at front + 45deg (tests/m4fix.mjs,
  shots/m4_fix_*.png): no clipping or flicker anywhere.

## 面部貼圖拆分（用戶要求：眼同嘴分開兩張貼圖）
- 舊做法：眼＋嘴＋腮紅＋皮膚底全部烘喺一張 128x128 canvas，貼喺頭前一塊
  0.5x0.44 平面上 → 平面烘焙嘅皮膚色同頭部材質嘅燈光/頂點色唔同步，成日色差。
- 新做法：面部改用兩塊透明 decal（eyes 層＝腮紅＋眼眉眼；mouth 層＝嘴），
  32x32 -> 128x128 nearest 放大，座標不變；頭部自己顯示原本 skin 材質，
  皮膚色從此由模型統一渲染，唔會再 mismatch。
- `psxRenderer.js` map shader 加 alpha 取樣＋`discard`（a<0.5 唔畫），
  decal 保持 opaque material，無透明排序問題。
- 兩塊 decal z 0.368 / 0.371 微錯開，避免 vertex snap 造成 coplanar 閃爍。
- 腮紅歸入 eyes 層（佢喺嘴層範圍外，UI 縮圖用 drawFace32 組合不受影響）。

## 面部 1.5 倍放大（用戶要求：眼嘴太細）
- 做法：唔改貼圖代碼，兩塊 decal plane 幾何由 0.5x0.44 放大至 0.75x0.66
  （同一張 texture 拉大 = 像素變大 1.5 倍，PSX 風格更 chunky）。
- 錨點計算：eyes plane 以眼行中心（texture row 12.5, v 0.6094）為錨，
  plane y = 0.0281 - (0.6094-0.5)*0.66 = -0.0441；mouth plane 以嘴中心
  （row 19.5, v 0.3906）為錨，plane y = -0.0681 + 0.0722 = +0.0041。
- 修正：放大後眉毛升入 hair_01 劉海區，eyes plane 額外下移 0.05
  （y -0.0941）令眉毛同劉海分開，眼略降變標準 chibi 位置。
- 驗證：正面/0.9rad 側面無浮板、眉毛可見、腮紅＋happy arc＋cat mouth
  無相互碰撞（shots/face_15x_*.png）。
- 嘴位再修（用戶第二輪）：眼放大下沉後嘴貼得太近眼；mouth plane y
  0.0041 -> -0.16（嘴中心由原位拉低 ~0.16，位於眼同下巴之間中段，
  shots/face_mouth_low.png 確認眼嘴有清晰空隙，嘴底仍在平面 flat 區內）。

## M3 第六輪修訂（女仔髮型清理）
- hair_01 / hair_09 後方懸浮紙板：刪走兩個 addStrip（z -0.45 嘅背板）,
  剩返 cap + tail / 裝飾。
- 女性 cap 底部穿模：capGeo 底面平板切割改為無條件執行（唔再綁 shortY），
  所有髮型 cap 都無底板，唔會插穿頭/身體。DoubleSide 裹面睇入去正常。
- hair_01: 44 tris / hair_09: 96 tris（上限 150內）。

### 2026-10-02 leg/shoe clipping + socks removed
- Socks slot removed entirely per user: catalog items/presets/slot, ui sections, main.js slot lists, socks builders in shoes.js.
- Leg-vs-shoe clipping root cause: leg box back face z=-0.17 coplanar with shoe body back face -> z-fighting (skin patches seen from back). Shoe body deepened 0.5->0.56, sole 0.46->0.52, cuff 0.34x0.38->0.4x0.44 with lip top 0.32 above pant hem 0.3 (hem tucks into cuff); cuffs overlap at centre.
- Pant hem slit Fix: taper 0.1 opened a centre slit between tubes (splay spreads them outward); r 0.42 + taper 0.05 + splay 0.03 keeps tubes overlapping -> no nub/zel line.
- Verified tests/m4fix4.mjs (front/side/backfoot x pants/shorts/bare). Committed as M4 fix.

### 2026-10-02 shorts de-cargo + slimmer shoes (wide-leg read)
- bot_shorts looked like cargo overalls: hips depth 0.4->0.36, belt 0.62x0.09x0.42 -> 0.58x0.08x0.38, tubes taper -0.05->0 (straight) so the short hem is the widest point only.
- Shoes slimmed back (user: cuff-lip wrap was ugly): body 0.4x0.2x0.56->0.38x0.2x0.52, sole 0.38->0.36w, cuff 0.44 deep->0.38 (z half 0.19, inside pant hem z half ~0.2) and top 0.29 below hem 0.3 -> long pants read as wide straight legs ending at the shoe, no lip band.
- All clear in front/side/backfoot zooms (tests/m4fix4.mjs).
- Shrink feet (0.20x0.13x0.32) and shoes (body 0.26x0.16x0.40, sole 0.24x0.07, cuff 0.32x0.08) per user feedback; overall shorts look confirmed OK in shots/m4_fix4_*.png.
- Fix leg poking out of slim shoe: shoe body widened to 0.34x0.16x0.46 (back -0.18 covers leg back -0.17, sides cover leg 0.142); cuff 0.34x0.08x0.38. Overall-shorts tubes lowered 0.05 (bottom 0.38 -> 0.33) per user request.
- Overall-shorts tubes raised 0.1 with same length (0.43..0.66). Shoe side-clip fix: body 0.36x0.16x0.47 (back -0.19, sides 0.18), sole 0.3x0.43, cuff 0.36x0.08x0.42 (inner edges +-0.01 keep a gap between cuffs); verified bare/shorts front+side+backfoot shots clean.

## M5 accessories (2026-10-02)
- Named anchors in character.js: anchor_head (0,1.48,0) = hairAnchor, anchor_neck
  (0,1.16,0), anchor_waist (0,0.7,0), anchor_wrist (0,0.59,0, rings tilted
  rz side*-0.2 to follow the A-pose arms), anchor_bag (0,1.0,0.05).
- All 17 catalog accessories built in src/parts/accessories.js; head-space
  builders (headwear/eyewear) use head-centre origin like hair.js, the rest use
  their anchor space. One main colour + secMat (x0.45 darker) for lenses/inner
  ears. Tris all <=132 (max 150), logged to shots/m5-tris.json.
- Head geometry facts that drove the fixes: head box 0.82x0.8x0.72 rounded to
  sphere r 0.44 spans y 1.08..1.88, torso top 1.18 -> NO visible neck; the
  head-torso seam is the only "neck" area. Hair cap top +0.43 above head
  centre, half-w 0.475, half-d 0.425; camera frame top ~2.26.
- Fix round: cap crown sy 0.55->0.8 y 0.26 (was a pancake perched on the hair);
  beanie crown/ring/pom lowered 0.06; bakerboy band 0.28 + crown 0.3;
  choker moved up to y +0.06 rel anchor (world 1.22) r 0.45 z 0.95 with the
  O-ring at z 0.42 — the band was fully buried inside the head/tee before.
- baguette bag reworked twice: chest roll -> under-arm tube (0.34,-0.24,0.28,
  rz -0.25) + flap + crossbody strap (0.03,-0.06,0.33, rz -0.94, h 0.82).
- tests/accShots.mjs: 17 items x front/angle/back via ?hair=hair_01&<slot>=<id>
  &c=%23e85a78 + desktop.png/mobile.png (?cat=accessories&waist=acc_belly_chain).
- main.js: ?c=<hex> debug colour applies to any URL-assigned slot; ui.js
  ?cat= opens a panel directly; no tag filter for accessory slots.

## M5 fix round 2 (same session, user feedback)
- Hats were buried in the hair (crown r 0.46-0.53 vs hair half-w 0.475, fring
  enclaves the rim): beanie/cap/bakerboy rebuilt with r 0.54-0.56 crowns +
  bands at y 0.30-0.36 so they read as worn OVER the hair; cap brim pushed
  out to z 0.6 (0.56 wide) past the fringe plane, button y 0.73; bakerboy
  crown flatter (sy 0.42) y 0.38, band 0.56/0.31, visor 0.46 at z 0.6.
- Sparkle clip bars+stars moved onto the hair top front (z 0.38-0.4,
  x +-0.34-0.38) — previously sunk into the side.
- acc_big_sunglasses deleted from catalog.json, preset_street and the shot
  script; its builder removed — eyewear now glasses + wraparound only.
- acc_wrap_sunglasses: band r 0.51 z-scale 0.94 (clears hair 0.475/0.425),
  visor r 0.53 arc +-43deg h 0.15, both centred y -0.04 (over the eye row).
  Minor cosmetic: the dark band shows through the hair's open fringe cut in
  the back view — PSX see-through slot, left as-is.
- Colour reset bug fixed in ui.js: picking a new item in a slot now carries
  over the slot's previous colours (prev[cs] ?? defaults) instead of always
  resetting main to #ffffff.
- tests/accShots.mjs now uses ?c=%23111d44 (navy) instead of the pink so
  accessory geometry is visible against the default white hair.

## M5 fix round 3 (user feedback)
- Per user: hat crowns must NOT exceed the hair cap outline (hair half-w
  0.475) and hats raised +0.05. beanie crown r 0.46 y 0.39, band 0.47 y 0.41,
  pom y 0.78; cap crown 0.46 y 0.35, brim 0.5x0.06x0.26 at z 0.55, button
  y 0.72; bakerboy crown 0.45 (sy 0.42) y 0.43, band 0.47 y 0.36, visor
  0.42x0.05x0.22 y 0.37 z 0.55. Hats now read as tucked caps on the hair.
- acc_sparkle_clip deleted (catalog.json + shot script + builder) — HEADWEAR
  is now 7 items: cat/bunny ears, beanie, cap, bakerboy, butterfly clip,
  z hairband. star()/starGeo() kept (pendant still uses them).

## M5 fix round 4 (user feedback)
- Hat crowns (beanie/cap/bakerboy) reduced to r 0.42 as requested.
- Headwear now fits dynamically per hairstyle: hair.js exports
  DEFAULT_FIT {r:.475, top:.43, front:.425}, HAT_FIT overrides for hair_06
  (top .38), hair_08 (r .45, top .39, front .4), hair_10 (r .46, top .38,
  front .41), and BARE_HEAD_FIT {r:.42, top:.41, front:.4} for no hair.
  All headwear builders take a `fit` param; main.js passes
  HAT_FIT[state.hair.id] ?? BARE_HEAD_FIT when rebuilding, so hats follow
  each hairstyle's cap shell on every applyAll rebuild (no floating in /
  clipping through the hair cap).
- Verified via FitCheck shots: hair_08 + hair_10 beanie snug, hair_06 cap
  correct, hair colour kept on item switch (ui.js carry-over round 2).

## M5 fix round 5 (user feedback: crown/brim separation on cap + bakerboy)
- acc_cap: brim previously floated in front of the crown (brim back edge
  z 0.435 vs crown front ~0.34) with no base band. Now: base band ring
  (r fit.r-0.015, h 0.13, y fit.top+0.05, sz 0.95) carries the crown, crown
  base raised to fit.top+0.1, brim back edge (fit.front+0.02 = 0.375) tucks
  under the band front (0.437); button raised to fit.top+0.42.
- acc_bakerboy: visor back edge moved in to fit.front-0.02 (0.405) so it
  overlaps the existing band front (0.437); visor y fit.top+0.05.
- Verified front + angle shots: crown/band/brim read as one connected cap.

## M5 fix round 6 (user feedback)
- Hat crowns (beanie/cap/bakerboy) reduced further to r 0.38
  (fit.r - 0.095 instead of fit.r - 0.055).
- Attached bits follow the smaller crowns: beanie pom y fit.top+0.27,
  cap button y fit.top+0.33.
- Front shots re-verified: crowns sit inside the hair cap outline.

## M5 fix round 7 (user feedback: neck/waist/wrist/bag)
- acc_pendant + acc_belly_chain 剷除（用戶要求）；waist slot 整個移除
  （catalog.json slots/items/preset_y2k、main.js ACC_SLOTS/state/SLOT_ANCHOR、
  character.js anchor_waist、ui.js WAIST section、accShots.mjs）。
  star()/starGeo()/ring() helpers 冇人用，一併刪走。
- acc_choker 位置修正：舊版 band y +0.06 r 0.45 蓋住下巴/衫領（睇落似衫
  嘅一部分）。新版 band r 0.40 (z x0.9) y -0.015（world 1.145），啱啱圍住
  頭底邊緣（head bottom rim y 1.11-1.13, x 0.355, z 0.334），下頜底下露出
  一圈；O-ring charm 掛喺 band 前面 (0, -0.06, 0.345)。80 tris。
- acc_friendship_bracelet 重做：舊版得一條幼圈加三粒懸浮方珠（完全睇唔出
  係咩）。新版每隻手腕一圈完整珠環：8 粒 octahedron 珠（r 0.05，
  main/darker 交替）+ 1 粒大 charm 珠（r 0.075）喺手腕正面，圍繞手腕關節
  （arm t 0.63，world (±0.485, 0.563)），環面垂直 A-pose 手臂軸線，位置喺
  任何袖口（sleeve ends t 0.5-0.6）之下所以長袖都遮唔到。144 tris <= 150。
- 兩款袋重做（新檔 src/parts/bags.js + 共用 helper src/parts/geo.js bx），
  舊版袋筒/帶互相分離。新結構：
  - acc_baguette_bag: trapezoid pouch（taperBox 0.44x0.24x0.16，top 0.46/
    bottom 0.36）喺右胸 (0.30, 0.75, 0.19) 頂邊掂到右臂底面 + flap 蓋頂 +
    zip + strap 入口 buckle；肩帶兩段相連（袋頂 (0.13,0.82) -> 胸前
    (-0.12,1.07) -> 左肩後 (-0.26,1.21)，末端沒入頭底 rim 後面 = 過肩效果）。
    72 tris。
  - acc_shoulder_bag: trapezoid satchel（0.3x0.22x0.16）掛右前髖
    (0.40, 0.66, 0.25) + flap + clasp；肩帶兩段（袋頂 (0.48,0.77) -> 胸前
    (0.40,1.03) -> 右肩後 (0.26,1.16)），末端一樣沒入頭 rim。60 tris。
  - 肩帶平面 z 0.20/0.21（胸前 0.16、tee 袖前 0.165、jacket 袖前 0.189 之前），
    末端冚入袋頂/頭 rim 入面，所有件永遠相連。
- 驗證：before/after shots（accessory 用螢光粉/綠獨立上色）front+angle
  逐件核對；再加 jacket+baguette、longsleeve+shoulder、longsleeve+bracelet
  三個 layering case 確認無穿模。accShots.mjs 更新後 m5-tris.json 全部 <=144。

## M5 fix round 8 (user feedback: choker 穿下巴 + 肩帶無後面)
- acc_choker 再降 0.05：band y -0.015 -> -0.065（world 1.095，band 頂邊
  1.145 剛好在頭底 rim 下），O-ring charm 同步 -0.11。正面唔再穿下巴。
- 肩帶補做後面，兩款袋嘅肩帶變成閉環：
  - strap() helper 改 3D（quaternion setFromUnitVectors 對齊任意方向）。
  - 後帶平面 world z -0.21（builder -0.26）：tee 背面 0.17 之外、jacket
    背面 0.182 之內（薄薄藏入 jacket，無 coplanar）。
  - baguette 後段：頸後 (-0.22,1.16) -> 背左 (-0.3,1.0) -> 橫過背部
    (0.3,0.8) -> 繞入袋身 (0.4,0.75,0.13)（經手臂後面沒入，末端喺袋內）。
    108 tris。
  - shoulder 後段：頸後 (0.2,1.17) -> 背右 (0.3,0.82) -> 繞入袋背
    (0.42,0.62,0.19)。84 tris。
  - 兩款末端都冚入袋體內，前面過肩位冚入頭底 rim 後面 — 前後四個角度
    睇都係連續肩帶，無懸浮端點。
- 已知取捨：長裙/長髮會遮住背帶（現實一致）；短袖時背帶喺背部可見。
- 驗證：front/back/angle shots（螢光粉獨立上色）逐款核對；build + accShots
  全過，tris baguette 108 / shoulder 84 / 其餘不變。

## M5 fix round 9 (user feedback: choker 側面似呼啦圈)
- 用戶：choker 淨係一個圓圍住身體，側面睇似呼啦圈，要緊貼身體模型。
- 成因：band（y 1.07–1.16）成 0.041 露喺頭底 rim（1.111–1.134）之下，
  而胸前 torso 前 z 0.16 vs band z 0.3465，側面前弧完全懸空，加埋 charm
  吊到中胸，整體就係一個浮住嘅圈。
- 修法（acc_choker）：band r 0.385->0.38、h 0.09->0.07、y -0.045->-0.04
  （world 1.12，span 1.085–1.155）：只有 0.026 露喺 rim 底下，其餘冚入頭底
  邊（rim x 0.373 / z 0.334 vs band 0.38 / 0.342，縫隙 0.007/0.008），
  正/背/側面都貼住頭底；charm 上移 (0,-0.1,0.35) -> (0,-0.085,0.355)
  （world 1.075，背面 0.339 離頭前面 0.334 0.005），頂部冚入 band 前弧，
  變成 chin 對下嘅小 O 環，唔再吊到中胸。80 tris 不變。
- 幾何限制筆記：chibi 無頸，頭 rim（x 0.373）遠闊過 torso 頂（0.28），
  任何細過頭 rim 嘅頸飾會被頭 overhang 完全遮住 — 所以 choker 半徑一定
  要大過頭 rim 先見到；「貼身」只能靠收細縫隙＋縮短 rim 底下懸空高度。
- 驗證：front/side/back/angle 螢光粉 shots — 側面只剩 chin 下 sliver +
  charm，無懸空弧；build + accShots 全過。

## M5 fix round 10 (user feedback: 橢圓環仍似呼啦圈，改方帶)
- 用戶：成效不佳；改用接近身體模型嘅四邊形，緊貼身體。
- 橢圓問題本質：頭底 rim 係圓角方形（平面 x 0.373 / z 0.334），橢圓環
  一定會喺平面位凸出／角位懸空，側面前弧離 torso 遠，點改半徑都係圈。
- acc_choker 改用 rounded-rect tube（新 helper roundedRectPath：Shape +
  quadraticCurve 角，外框 0.385x0.345 角切 0.04，內洞 0.35x0.31），
  ExtrudeGeometry depth 0.07 rotateX(-90deg)，y -0.075（world 1.085-1.155）。
  四個平面貼住頭底四邊（縫隙 ~0.007-0.011 均勻），角位 chamfer 對應頭
  圓角；任何角度睇都係一條貼頸橫帶，唔再係圈。charm 掛帶前 (0,-0.085,0.37)。
- 80 -> 128 tris（Extrude side walls + caps，max 150 內）。
- 驗證：front/side/back/angle 螢光粉 shots — 正/背係直橫帶，側面只見帶
  一節 + charm，無任何懸空弧；build + accShots 全過。

## M5 fix round 11 (user request: WRIST1 手錶)
- acc_friendship_bracelet 換成 acc_watch（WRIST1 = 一號 wrist 配件）：
  左手（畫面左邊，x -0.485）手錶，錶盤釘死白色，外殼（main）同手帶
  （secondary）由用戶自由換色。
- 幾何：rounded-rect 錶帶（外 0.37x0.33 tube / 內洞 0.3x0.26，跟 choker
  同工法）跟 A-pose 傾斜 rz -0.2，位於 sleeve ends (t 0.5-0.6) 之下；
  錶殼掛帶正面（0.16x0.15x0.05）+ 右邊 crown + 白錶盤 inset (0.115x0.105)
  + 一條深色指針。112 tris <= 150。
- 系統改動：createAccessory signature (id, colorHex, fit) -> (id, colors,
  fit)；colors.secondary 存在時 secMat 用用戶色（唔再 x0.45），否則保持
  舊 derived-dark 行為（glasses lens / cat inner ear 等不受影響）。
  main.js recolor() 同款邏輯；ui.js 本來就會按 colorSlots 畫
  MAIN/SECONDARY 兩個 picker（top_knit_vest 已有用），無需改。
- 舊 bracelet (144 tris) 刪除；catalog tags 改 base。左手決定：chibi
  對鏡實際係模型右腕，但畫面閱讀為「左手」，用 -x 側。
- 第一次嘗試錶殼放帶頂被tee遮住（crop 驗證）-> 移到帶正面才可見。
- 驗證：front/side/back/angle + longsleeve layering crops（螢光紅殼綠帶
  白面）全部確認錶面可讀；build + accShots 全過。

## M5 fix round 12 (user feedback x3)
- ①手帶唔跟殼色：新 secondaryFollow 機制。ui.js 揀新 item 時
  colors.secondaryFollow = colorSlots 包含 secondary；render color rows 時
  follow 中會同步 colors.secondary = colors.main；用戶手動揀 SECONDARY
  swatch 即 secondaryFollow = false 解鎖。main.js recolor 由 M6 session
  重寫做 colors.secondary ?? colors.main（同 follow 機制兼容，效果一致）。
- ②錶盤移側邊：原本掛帶正面（用家話應該掛側旁）。錶殼改為貼在錶帶
  外側平面（-x），白錶盤 + 兩支深色指針面向外，crown 移去 -z 邊。
- ③帶與殼對齊：所有部件收入單一 arm-tilted frame Group
  (position -0.485,-0.045,0 / rz -0.2)，帶/殼/盤/針共用同一座標，
  結構上唔可能再走位。
- 幾何：帶 (outer 0.185x0.165 / hole 0.15x0.13 / depth 0.075)、殼
  0.05x0.09x0.15 貼帶面、盤 0.014x0.07x0.12 inset、指針兩支。124 tris。
- 驗證：follow 模式（紅殼紅帶）、unlock（紅殼綠帶）、sync（藍殼藍帶）
  crop 全過；side view（yaw pi/2 外側向鏡）白盤深針清晰、殼帶貼合；
  front view 殼側望僅見邊緣 = 符合「掛側旁」。build + accShots 全過。
- 註：M6 session 並行改緊 main.js/ui.js（socks + Style tab，引用未追蹤
  socks.js/uiStyle.js），所以今次 commit 只含 accessories.js + NOTES.md；
  ui.js 嘅 secondaryFollow 改動留待 M6 一併提交。temp 腳本已刪。

## M6 完成（2026-10-03：Y2K/NewJeans 風格包）
- 新增 20 件 catalog 件：top_baby_tee / top_knit_vest / top_polo /
  top_offshoulder / top_jersey_crop / top_denim_shirt（tops.js TOP6）、
  outer_blazer（lapel crest + 領帶）/ outer_denim_jacket / outer_bomber
  （OUTER6，denim/shirt 共用 denim pattern）、bot_lowrise_jeans /
  bot_cargo_wide（前大腿口袋）/ bot_plaid_pleated / bot_tennis_skirt /
  bot_lowrise_mini / bot_metallic_pants（bottoms.js）、shoe_platform /
  shoe_mary_jane / shoe_knee_boots（shoes.js）、及(socks) sock_knee_stripe。
- patterns.js：plaid / stripe / denim / star / metallic / number_decal
  （pixel-bitmap drawDigitsDecal）六大程序貼圖，32x32 nearest；makeDecal
  出 crest/digits 貼花。catalog item 加 `pattern` 欄位，createTop/Bottom/
  Socks 收 patternName 建PatternTexture 材質；main.js recolor() 每次
  換色都 set(item.pattern, main, secondary)。
- 建構函式統一 (g, m, s, flags)；lower torso 改用 skinMat（crop top 露腰）。
- Style tab（uiStyle.js + catStyle 按鈕）：6 個 catalog preset
  （Preppy/Street/Denim/Sport/Y2K/Colour block）＋ AUTO COLOUR BLOCK。
  PRESET_COLORS 表放 curated 色；applyPreset 套 items+colors；
  applyColourBlock 一 hue 派生深淺，bottom 用 h+150 對比色（避免藍配深藍
  monochrome）。`?preset=<id>&hue=<n>` URL 參數供截圖。
- M6 修訂輪（截圖對照後 4 項大差異）：
  ① 桌面 STYLE panel preset 按鈕被右邊裁切 — presetBtn 56->54px、字
     7->6px、style panel grid padding 收窄。
  ② cargo 口袋移前大腿（x ±0.36, z 0.16）+ flap，側面先見到。
  ③ plaid pleated skirt 每塊 panel 給 UV 0..1，格紋先顯示出嚟。
  ④ blazer crest 移到 lapel 面 z 0.245；jersey digits 改 pixel bitmap。
- 最後修訂：bot_lowrise_mini 收窄（rBot 0.44->0.4）同縮短（hem
  waist-0.24->-0.16）同 tennis skirt 分離樣；drawMetallic 改雙 loop
  3px 亮帶 + 2px 暗帶每 12px 週期（0.5 白 / 0.28 黑）明顯 foiled look；
  colour-block 對比色（藍top+紅裙）。
- 驗證：build 過；m6Shots.mjs 逐件 front/angle + 6 preset desktop/mobile
  截圖全過無 pageerror；tris 398-504 <= 800 預算（m6Probe 已刪）。

## M6.5 身體選擇器（2026-10-04 male/female body）
- `BODY_PROFILES`（character.js）兩個 profile + `getBodyProfile()` / `bodyFit()`；
  `createCharacter(bodyType)`；`state.body`（state.js，?body= URL 參數），
  RANDOM 會隨機 body、RESET 回 female；main.js `rebuildCharacter()` 整個
  rig 重建 + 面部貼花/頭髮/衣物重掛；ui.js 新 BODY 分類（兩個圓縮圖）；
  index.html/style.css 新 `.catBody`（#f07890 軀幹 icon）；uiWidgets.js
  從 ui.js 機械式拆出。
- 語義修正：brief 寫「female shoulders 0.56 / hip 0.66」，但現行美術是
  軀幹下緣（髖）0.56 → 肩部外擴邊 0.66（tops.js 邊界註釋 + collar 鎖位
  可證），profile 以解剖學鍵名記美術真值。首輪 female 保持 pixel-identical
  （baseline pixel-diff 驗證：desktop/mobile 差異只落喺分類列）。
- 第二輪（用戶要求加大差異）：女仔改真沙漏 — 軀幹改 5 行曲線取樣
  `torsoW(t)`（hips 0.6 → waist 0.5 @ t 0.42 → shoulders 0.58），
  手臂 0.27→0.22、腿 0.34→0.28（手/袖按原比例 1.111/0.794 縮放）；
  男仔闊膊直身 — shoulders 0.66 / waist 0.6 / hips 0.62，手臂 0.3、
  腿 0.34。全部服裝殼層共用同一條曲線（shellGeo→torsoGeo），殼/身每行
  保持 enl% 邊距，無穿模；骨盆 block hipsTopW 0.5→0.48 避免同新幼腰
  coplanar。body tris ~224 <= 800。
- Bug fix 1：`rebuildCharacter` 誤將 character 物件（非 .root）傳入
  `disposeGroup` → `root.traverse` 拋例外 → 切 body 後 applyAll 中止、
  UI 全面失步（睇落似凍結+隨機跳頁）。
- Bug fix 2（M2.5 遺留 latent bug，用 clickthrough 實錘）：grid 按鈕在
  面板建立當下捕獲咗「當時的 refresh」= 上一個面板嘅 rebuild 函數 →
  揀眼/髮型/衫後會隨機重建出上一個面板（18↔12 顆按鈕跳動）。修法：
  所有 buildGrid 呼叫改傳 thunk `() => refresh()`，點選時先解析當前面板。
- 驗證：clickthrough 8 個分類 x 4 次點選全部留喺原面板、0 pageerror；
  female/male x default/jacket/vest+skirt/crop+jeans/shorts/bare 截圖
  無破模無 sliver。
- Bug fix 3（用戶報「上衣與褲類重疊位穿模破面」）：
  ① 幼褲管（0.34）嘅深度原本跟闊度（half-z 0.17），同 tee殼 hem 前後面
  （0.1696）只差 0.0004 → coplanar 級閃爍，tee hem 底角喺褲管面上切出
  斜向破面。加 profile `tubeD`（女 0.4 / 男 0.42 → fit.td），褲管深度
  標準化罩住 hem。
  ② 幼管中間唔再交疊，中縫露出正後方更深嘅 tee（紅直紋）→ 骨盆 block
  向下延伸至 y 0.29 填縫；`hipsDepth` 女仔 0.36（half-z 0.18 >
  shell hem +0.0104，同 M4 短褲「waist read continuously」同一設計）；
  另發現 `hipsMesh` 嘅 depth 預設係 hardcode 0.3 冇讀 profile，
  改為 `depth ?? p.hipsDepth`。
  驗證：tee x 五件褲類（front + 0.5rad angle）腰線全部連續、無紋無
  sliver；男仔（tw/td = 1）逐像素不變。

## M6.5 Pose system
- Joint hierarchy in character.js (RIG constants, pivots reproduce rest layout exactly; thigh/shin split with taper 0.897, +12 tris/leg). Root order YXZ, joints ZXY.
- Elbow bend axis: chose Z-fold (inward, in the shoulder coronal plane, el.rotation.z = -side*e) over X-fold: X-fold cannot bring the forearm inward, hands-on-hips became a T-pose. Z-fold reads akimbo/wave/peace/salute acceptably.
- Clothing->joint attachment via Object3D.attach() at REST with root.updateMatrixWorld(true) before it (stale-matrix bug found+fixed). Pieces tagged userData.clothPart by builders; pose.attachCloth tracks per-slot pieces so item rebuilds remove stale pieces from joints.
- Knee-split pieces nested: shin piece width x0.96 spans past the knee under the thigh piece extension -> no wedge gap when bent, no coplanar z-fight; shoe pairs split per-foot kneeL/R; knee boots' shaft split into thigh band + nested shin band.
- Skirt cones flare 'xz', pant/sock tubes flare 'x'; factor includes leg spread AND |forward| so bent thighs don't open a crotch slit.
- Foot auto-level: foot.rotation.x = (forward - knee) keeps soles flat (run/sit no longer dig into the floor plate).
- Sit preset uses internal preset-only 'drop' 0.12 (clamped 0..0.42, carried into custom seeds) so feet stay grounded while matching slider-legible angles.
- Collision guard: palm tip vs head box + torso core; shrink raise/forward/elbow x0.35.
- CONFIRM now saves the full config (name + pose) to psxcc.v1; JSON-file import/export deferred to M8 (needs a file picker, out of scope here).
- Debug: ?debug=poses cycles 9 presets x 4 outfits; window.PSXCC.pose API (list/preset/custom/debugNext...).

### M6.5 follow-up (user-reported): clothes stayed put when posing
- ROOT CAUSE: fit.js tagged sleeve containers clothPart:"shoulder" (no side
  letter) -> PART_JOINT lookup failed -> sleeves were NEVER re-parented onto
  the shoulder joints and stayed in root space while arms posed. Tags are now
  "shoulderL"/"shoulderR" (exact joint names like every other part tag).
- attachCloth: after attach(), sleeve containers zero their baked local rz
  (the old static A-pose tilt); the shoulder joint supplies side*0.2 itself,
  so rest pixels are unchanged and sleeves follow every pose/slider change.
- cargo side pockets now ride the thigh (tagged thighL/R wrap groups).
- Pose engine sync() dispatches onChange -> the open Pose panel re-syncs
  thumbs + slider readouts for ANY path (RANDOM/RESET/API), fixing stale
  0-degree slider displays.
- Verified in a live browser through the REAL UI path: preset thumb clicks
  (wave/run/sit) and slider drags (arm raise 120, leg fwd 60) move sleeves,
  pant tubes and boots with the limbs; rest regression shots unchanged.

### M6.5 follow-up 2 (user-reported): hands/feet still pierce in some poses
- Measured on the live rig (world/local probes through PSXCC): the old guard
  sampled ONLY the palm tip against a narrow torso core (|x|<0.26) that
  missed the elbow-120 hand stab (palm reached x 0.26, y -0.36) and had no
  leg guards at all (knee 90 stabbed the toe into the thigh tube; negative
  spread crossed the two feet into each other, sep -0.19).
- Guard upgraded (still analytic, no physics):
  - arms: palm tip AND forearm mid vs head box + torso volume (|x|<0.34,
    |z|<0.19, y -0.42..0.26 waist-local), shrink raise/forward/elbow x0.35.
  - legs: toe (0,0.03,+0.2) + heel (0,0.03,-0.2) in thigh-local box
    (|x|<0.22, |z|<0.19, y -0.30..0.03) -> knee *= 0.65 unfolds the foot.
  - feet: root-space separation |dx| < 0.36 (two ~0.42-wide shoes) while a
    spread is negative -> shrink spread x0.65 (both negative sides).
- All 9 catalog presets verified UNTOUCHED by the guard (live probe: rendered
  angles equal catalog values; palms >= 0.44 x, sits outside every box).
- Extreme customs verified clamped: elbow 120 -> hand rides beside the hip
  (x 0.33, y -0.45); knee 90 -> unfolds to ~59 deg, toe exits the tube;
  spread -10 -> converges to ~-1 deg, feet hug at rest-like separation.

### M6.5 follow-up 3 (user still saw broken sleeves): STALE VITE, not code
- Probed the user's long-running vite (localhost:5173, started BEFORE every
  fix): /src/pose.js source served was current (fetch), but the PAGE's module
  graph still held the PRE-FIX fit.js - live traverse showed sleeves tagged
  clothPart:"shoulder" (old tag) instead of "shoulderL/R" -> sleeves never
  attached, matching the report exactly. Their fs-watcher had silently lost
  track of fit.js (pose.js invalidations did arrive, fit.js did not).
- Restarted the dev server (new pid on 5173) and re-verified IN THEIR
  ENVIRONMENT: sleeve tags now shoulderL/R, containers are children of the
  shoulder joints, real-UI slider Raise 130 rotates the sleeve with the arm
  (rz -2.47), wave preset 2.78, extreme knee 90 renders clamped at 59.
- Lesson for future milestones: after editing part builders, restart the dev
  server rather than trusting HMR, and verify on the USER'S server (ours may
  differ in cache state).

### M6.5 follow-up 4 (user screenshot: knee pokes out of pants, foot pierces shoe)
Two real geometry gaps in knee-bend poses:
- KNEE WEDGE: pant/sock tube pieces overlapped only 0.05 around the knee cut,
  so at deep folds the outer side opened a wedge and the knee showed through.
  Fix: RIG.kneeOver 0.05 -> 0.09 (nested shin piece inside the thigh piece's
  extension covers folds to ~90 deg; no new tris). Also clamped the thigh
  piece's y0 to the garment's own hem (it previously bled up to 0.09 below
  the hem for tubes whose bottom sat between the knee and k-over).
- FOOT-THROUGH-SHOE: whole shoes hung on the SHIN (kneeL/R) while the skin
  foot auto-levels (foot.rx = fwd - knee, up to +/-92 deg in run toes) ->
  the skin foot rotated out of its shoe. Fix: every shoe's foot-fitting
  pieces (body, sole, toe cap, instep strap, buckle) now tag footL/footR and
  attach to the ANKLE joints; ankle cuffs and boot shafts stay on the shin.
  Because the foot joint counter-rotates the shin's net tilt, shoes land
  world-flat at run/sit and the toe-off pitch in walk reads correctly.
  Rest look unchanged (foot rest rotation is 0). PART_JOINT gained footL/R.
- Verified live on the user's 5173 (shorts+socks+sneakers sit/run), plus
  full shot suite + build. STYLE.md 10 updated with both rules.

### M6.5 follow-up 5: reconciled the parallel fix commits
The user committed 2fce593 (their own shoes-follow-foot-joints + skin joint
burying + ghost cleanup + polling vite watcher) while I was building the same
fix; my 2ee7b6c stacked on top blindly and regressed parts of it. Reconciled:
- KEPT theirs: vite.config.js polling watcher (usePolling 250ms - the E: drive
  does not deliver reliable fs-change events: the actual root cause of the
  stale-module episodes), kneeOver 0.12 + skin thigh/shin meshes reaching
  PAST the knee/ankle (no bare-skin gap at any fold), generic shoe
  foot-vs-shin auto-bucketing in createShoes (piece y >= 0.2 -> shin frame,
  else ankle frame; builders stay pristine), ghost-piece release on un-equip
  (applyCloth(null) -> attachCloth(slot, null)), resized footHits thigh box.
- KEPT mine where better: kneePieces hem clamp (thigh piece y0 never below
  the garment hem - with 0.12 overlap the unclamped version would bleed the
  pant hem 8cm down; verified hem exactly 0.300 world).
- Both verified live on 5173: rest pixel-identical to M1-M6, run preset shoe
  glued to the ankle pitch, knee-90 clamp, ghost cleanup, hem fidelity.
- LESSON for me: check git log BEFORE staging heavy edits; if a parallel
  commit lands, rebase my mental model instead of stacking.

### r4: user still reported knee-through-pants / foot-through-shoe
- Found a test-methodology error on MY side: my "sock" verification used
  acc_white_socks, an id that does NOT exist (the only sock item is
  sock_knee_stripe) -> those tests actually rendered BARE legs and proved
  nothing. Retested with the real item + the user's outfit: knitted sock
  tubes (0.38) nest at the knee (0.12 overlap) and fully cover the skin;
  shoe foot pieces ride the ankle joint. No skin shows at knee/ankle in
  sit/run close-ups with shorts/jeans + sock + sneakers/boots.
- The large pale mass in my earlier close-ups = the folded sit HANDS, not a
  bare knee (hand 0.23 forearm + fist at the lap).
- Added a build beacon: tab title now reads "PSX Character Creator . r4"
  and window.PSXCC.build = "r4". Use it to detect a stale tab (one that
  missed HMR / holds old modules): if the title lacks r4, CLOSE the tab
  entirely and reopen the URL - a refresh is not always enough after a
  watcher outage.
- Verified screenshots kept: shots/verify_r4_sock_knee.png,
  shots/verify_r4_knee_sit.png (pure skin leg close-up), verify_r4_run_boots.

### r5: run pose - knee/shin/foot piercing the pant leg (user screenshot, long pants)
Root causes found with close-up renders + a magenta skin dye test:
1. "Foot through shoe" was THREE stacked issues:
   - single-sided shoe material: looking into a pitched shoe showed the culled
     interior = the skin appeared to pierce the shoe -> shoes are DoubleSide now.
   - the skin shin burial (0.00, reaching deep inside the shoe) made the skin
     tube poke out of the tilted shoe collar at run toe-off -> skin shin back
     to 0.06..0.34, tapered 0.8 (always inside the shoe shell).
   - the sneaker collar was a short band (0.17..0.25) that opened when the shoe
     body pitched -> collar is now 0.10..0.26 (foot frame, wraps the body top);
     the whole sneaker/platform now rides the ankle joint as one rigid unit.
   - foot auto-level pitch capped at +-45 deg (was up to -92 in run).
2. Bare ankle band between pant hem and shoe: pant hems dropped 0.30 -> 0.18
   (all four pant bottoms): hem + skin live on the same shin frame so a pitched
   foot can never separate them; hem now tucks into the collar.
3. Boot shaft knee wedge: shin band 0.2..0.42 -> 0.2..0.46 (0.08 nest).
Deliberate silhouette change: sneakers/platforms read slightly chunkier at rest
(collar higher) - required so the ankle opening stays closed at any pitch.
BUILD bumped to r5 (tab title beacon) so a stale tab is detectable.

### Agent-side incident + verification note (after r5)
- Two parallel workstreams committed to this repo at the same time (user's r2..r5
  rounds and this agent's fixes). This agent's `git add -A` snapshot (commit
  6039524) accidentally OVERWROTE the r4/r5 leg-fix state and deleted
  vite.config.js. It was reverted (commit 7f095ca) so the tree again equals r5 +
  the revert; no r-round work was lost. Lesson: never `git add -A` when another
  session may be committing - stage explicit paths only.
- The restored r5 state was re-verified with the agent's magenta-skin probe
  (skin #ff00ff, arm meshes hidden, side view) on run legs / knee 90 / fwd 60 +
  knee 90 with denim shirt + long pants + sneakers: ZERO leg-region skin
  exposure in all three (only the intended neck shows). The r5 approach
  (foot-frame shoe body + knee-frame collar 0.10..0.26 wrapping the pitched
  body, DoubleSide shoes, skin shin buried past the knee, pant hems 0.18,
  ±45 deg foot pitch cap) is confirmed sound - no further changes needed.

## 磁碟狀態還原（IMPORTANT for future sessions）
- 開場時工作樹帶住未提交嘅過期修改（更舊嘅 M6 碼 + 刪走咗 vite.config.js），
  係平行 session collision 嘅殘骸（檔案 mtime 8:42 AM，但 HEAD 已喺 20:31）
  。已 `git checkout --` 還原到 HEAD（= r5 + revert fix3 狀態）再開始本輪
  修正。教訓：任何肉身改動前先核對 git status 同 HEAD 內容。

### M6.5 follow-up 6 (user-reported: run pose trunk pokes out of the pant
### tube + foot pierces shoe; check other poses)
以 vertex-level OBB 探針（tests/poseProbe.mjs，皮膚 mesh 每頂點對全部衣物
OBB 測距）逐個姿勢(9) x outfit(褲/短褲+靴/長裙/男仔) 掃描，歸位三個真實
成因並修好：
1. TRUNK ANCHOR OFF: torso mesh `torso.position.y = -0.30` 令成條 torso
   曲線下移 0.30（軀幹 span 0.28..0.88 vs 衣物殼 0.58..1.18）：同一世界行
   高度，軀幹 row 對唔準殼 row - 膊頭行 (0.58) 落喺 y 0.88，喺 tee hem 下
   成 0.3 誤差，所以骨盆 flare 的側角成為「從褲管穿出嘅長條」。修法：
   position 歸零，軀幹 row span 0.58..1.18 同殼逐行對齊（bare 外形曲線
   定義不變）。
2. TORSO SHELL RODE NOTHING at twist: tee/jacket 壳層係 root 子件，扭腰
   (waistTwist) 時唔跟 - 軀幹角 (hypot 0.33) 逆住固定殼牆穿出 12-50mm。
   修法：top/outer group tag `clothPart:"waist"`（main.js applyCloth），
   attach() 保留 rest 世界變換，rest 像素不變，扭腰後殼跟腰走。
3. PELVIS BLOCK 唔夠罩: hipsMesh 舊式平面斜邊 (hipsW 0.5 -> hipsTopW
   0.44) 留下頭先計到嘅 (x ±0.25..0.30) 軀幹 flank 帶，tube 一搖就露。
   修法：hipsMesh 改為按 torsoW 曲線 (+0.03 margin) 逐行塑形（y<=0.58
   hold 住 hips 寬），骨盆 block 從此係軀幹 silhouette 加 margin，任何
   tube swing 都罩住。female/male 都由 profile 導出。
- 連帶 shoe_knee_boots shaft 跟 kneePieces 統一 0.12 overlap（thigh band
  0.22..0.62，shin band 0.2..0.46 nest 0.384/0.4），修復 boot shaft 喺膝彎
  穿出嘅 wedge（原本只得 0.08 nest）。
- 審查結論（user 問嘅「其他姿勢會唔會有類似情況」）：
  - RUN/SIT/WALK 同 hands-on-hips（最大 twist）已由探針覆核：torso 行
    零暴露；剩餘只有 (a) 手臂/手掌裸露（設計正常，sleeve 去到肘位）；
    (b) 膝/踝 ring 角位 <=50mm（PSX canvas 上 <=2px，硬方盒關節物理極限，
    列為 known-limitation）；(c) 長裙 run 時下擺擺動露出小腿（單件裙 stat
    本性，non-follow 設計）。
  - foot-through-shoe 由 r5 已修（foot-frame shoe + knee-frame collar +
    DoubleSide + hem 0.18）；本輪無回歸。
- 工具：tests/poseAudit.mjs（全姿勢 x outfit f/s/c 截圖，隱 UI 抓 #view
  canvas）、tests/poseProbe.mjs（per-vertex OBB 暴露標尺 >12/>50/>150mm），
  作為以後衣著改動嘅 regression 檢查。

### M6.5 follow-up 7 (user-reported: shin slices through foot plate + sole
### because the foot stays ground-parallel while the shin bends)
- 成因：applyLeg 嘅 ankle auto-level「腳板保持水平」（(fwd−knee)±45° cap）喺
  小腿世界傾斜 θ 時，鞋/腳板軸同小腿軸錯開 θ：小腿末端方形 ring 嘅角位
  （±0.14）以 0.14·sin θ 掃過鞋腔外，walk θ≈34° 已掃穿 sole/collar
  （probe 見 28mm 暴露），run θ≈92° 穿得更多。coutner-rotation 幾多都
  改變唔到 shin ring 同鞋腔嘅交角（交角 = 小腿世界傾斜，同 foot pitch
  無關），所以「加 cap」及「鞋子 relocate」都唔會根治。
- 修法（用戶方向：腳板跟住小腿行）：`ft.rotation.x = 0` — 腳板、鞋身、
  collar 統一喺 shin frame 內同軸。任何膝彎角度 ring 都喺鞋腔內（腔
  0.47x0.36 > ring 0.28x0.28），零衣着穿模。Rest 完全不變（所有腿角
  係 0）。腳尖/腳跟指向上疆態（walk/run 自然步伐）。
- 探針覆核：全 9 姿勢 x 褲/短褲+靴/長裙/男仔，所有 w0.28/w0.34 (shin)
  暴露 cluster 消失（原本 walk/run/sit 各 9/36）。剩低手臂/手掌裸露
  （設計）同 sit 場景 head 底邊 sliver。
- 已知取捨：鞋底唔再永遠貼地 - 沿小腿傾斜（walk 前後腳 toe/heel 啱啱
  擦地或腳跟微浮，姿勢角度本來就用 follow 幾何調教；顧 camera 喺地上方
  拍攝，under-floor 部分被 opaque ground disc 遮住）。
- STYLE.md 10 更新 ankle 規則描述。

### M6.5 follow-up 8 (user-reported: 一啲姿勢鞋底出現穿模 - 唔知係腳板
### 抑或邊個模型)
- 成因：skin foot mesh 底面原本貼地（fm.position y 0.005, 底面 y=0.0），
  但鞋底 plate 底面只去到 0.01 (sneaker/boot) / 0.005 (MJ / platform)，
  腳板皮膚比鞋底板低 1~2.5cm。舊 ground-parallel foot 時 camera 睇唔到
  底部；follow-the-shin 之後鞋底會傾斜側面曝光，皮膚底面明顯喺鞋底外
  露（user 見到嘅「鞋底穿模」）。
- 修法：foot mesh 底面升高入 sole slab 內 - fm.position (0, 0.025, 0.06)，
  皮膚 span 0.02..0.15：sneaker/boot sole slab (0.01..0.08) 同 MJ/platform
  全部罩住皮膚底面；身體 top 0.15 仍低過所有鞋腔 top。任何小腿/鞋傾斜
  皮膚都唔會再喺鞋底外露。
- 連帶 Mary Jane：body 0.12->0.15 高 (span 0.015..0.165)、strap/buckle
  0.145->0.17（剛好 5mm 蓋過 instep 皮膚，唔再切腳背）。其他鞋款 cavity
  本來就罩得住 +0.025 版 foot，無需改。
- 探針收緊至 >5mm 門檻：foot mesh (h0.13) 暴露喺全姿勢 x 全outfit 歸零。
  剩低手臂/手掌/長裙下擺/頭底邊（known limitations）。
- bare state 取捨：皮膚底面而家喺 y~0.02，極近場先睇得出 2cm 鞋墊感；
  sole 板仍然係地面接觸面（0.01），rest 讀腳型無變。



