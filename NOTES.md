# NOTES.md

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
