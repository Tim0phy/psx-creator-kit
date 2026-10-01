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
