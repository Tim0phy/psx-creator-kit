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
