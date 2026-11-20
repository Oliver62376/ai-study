# PROGRESS

最後更新：2026-11-20（P0–P3：Chat/Board 切換、GPT 檔案 chip、設定集中年級/上傳/OCR/語音/API、筆記本、我的課列表與刪除、備課先進白板、TTS 插件、視覺備課 prompt、板書筆色 variant ink。）

這份文件給下一個 AI Agent 交接用。開始新任務前先讀這裡，再讀 `docs/AI智慧教學工具-需求.md`。完成任務後更新本檔：補上這次做了什麼，保留仍然有效的舊紀錄，不要整份覆蓋成只剩最後一次操作。

## 現在到哪裡

產品是「AI 自主講課＋電子黑板」。需求在 `docs/AI智慧教學工具-需求.md`。課程不再寫死科目。首頁可以貼上教材或主題，也可以上傳 PDF、docx、pptx、txt、md。抽出來的文字進備課框，再由接上的模型回一份課（標題、教材段落、每一段要念的話和板書）。沒有課之前不能進白板。

對標的使用方式是 UriSenpai / Sancy：老師開口時白板上的線跟著出現，學生可以停下來問，問完從剛剛那裡接回去。打斷與測驗都把這份教材送給模型。備課時模型已經寫好每一段的口語，上課時直接念，不再把寫死講稿拿去改寫。

2026-11-19 晚 `npx tsc --noEmit` 與 `npm run build` 通過。開發伺服器是 `npm run dev`，在 `http://localhost:5173/`。手動路徑可加 `?fast=1`（縮短語音與板書間隔）與 `?fresh=1`（清掉 `ai-study-course-v1` 再開始）。沒有自動測試。瀏覽器已確認上傳 PDF、docx、pptx 會把文字填進備課框。

課堂一次只顯示一頁，右下角翻頁。字幕是目前這一句。回放從第一次發問才錄。全螢幕藏教材。白板固定白紙，換色已拿掉。螢光筆給老師和學生用，可以擦掉或清掉這一頁。測驗是另一面白板。PDF 改成等畫完再截畫面上的那一頁。現在的首頁仍是左側三顆按鈕加卡片，使用者不要這版。2026-11-20 使用者要求把首頁與 iPadOS 外殼的提示詞交給另一個 AI，做完再交回這個專案接上。年級預設國中二年級，主題開課例如「教我二元一次方程式」。在那份結果回來之前，不要改 `src/shell.tsx` 的首頁。

## 已完成

需求對照是「示範課裡有這條行為」，不是「一般教材都能這樣做」。

| 項目 | 現況 |
| --- | --- |
| 語音講課 | `speechSynthesis`，語言 `zh-TW`。沒有語音時改用計時器把該段講完。備課時模型已經寫好每一段口語，上課直接念。只有補充／打斷才再請模型改寫 |
| 學生打斷 | 底部單行輸入或麥克風。語音只即時轉文字，不存原聲。瀏覽器用 Web Speech，iPad 用 `@capacitor-community/speech-recognition` |
| 打斷後接回 | `model.ts` 的 job 佇列。補充講完會 `beginStep` 接回未完成的段 |
| 不主動出題 | 講課一路往下。測驗只在學生按「測驗」，或文字裡出現「測驗／考考／出題／練習」時開始 |
| 換頁 | 一次一頁，右下角翻頁。不是把每一頁接成一條往下捲。頁數由備課結果決定。新頁寫出來時才自動跟著切 |
| 邊講邊寫 | 一段裡的 reveal 仍一個一個出現（約 1.2–2.4 秒一筆；`?fast` 為 40ms）。講完不會把該段剩下的筆一次倒上板。波線用 SVG stroke 畫出來 |
| 電腦字體與公式 | 文字是一般字型。公式用 KaTeX，顏色跟白板墨色 |
| 引線註記 | 旁註在 `.notes`，`Leaders` 依 `data-note` 與 `data-anchor` 拉線 |
| 雷射筆 | 一個光點，對準 `data-anchor`，不寫進板書資料。不再為了雷射筆去 `scrollIntoView` |
| 波的圖、動畫、互動 | `WaveFigure`、`WaveAnim`、`WaveLab`。實驗在白板第 4 頁，只改振幅與頻率，不改已寫上的板書。位置跟著課程頁，不是畫面角落的固定槽 |
| 測驗與檢討 | 跟上課白板分開的另一面。可選容易／中等／難和題數。題目只由模型按這份教材出，沒有本地題庫。檢討寫在測驗白板，不寫回上課的板 |
| 進度保存 | `localStorage` 鍵 `ai-study-course-v1`。舊的 `ai-study-demo-v1` 不再讀。重開後從上次板書與段數接續。雷射筆不存 |
| 上課回放 | 預設不錄。學生第一次按送出的發問才把 `recording` 打開，並把當時板書存成 `replayBoard`。之後只追加這次問答與後來的板書。回放從 `replayBoard` 開始播已存的文字，不再請模型。還沒問過時「回放」是停用的 |
| 匯出 PDF | 逐頁切到畫面上的白板，等筆畫定下來再截那一頁，組成 PDF。不再用離屏的另一份版面。雷射筆和字幕不在截圖裡 |
| 全螢幕 | 「全螢幕」隱藏教材與分隔條，白板占滿。再按「顯示教材」回來 |
| 白板顏色 | 已刪。使用者說換色沒有用。白板固定 `#fbfaf7`，字不可選取 |
| 螢光筆 | 學生要先開「螢光筆」才畫，黃／綠／粉。橡皮擦點一筆刪一筆，「清除本頁」清掉這一頁的手畫和老師畫的標。老師的標是 `{page, anchor, color}`，畫在錨點上。補充時模型回 JSON：`say` 加 `highlights`。提示詞在 `src/prompt.ts` 的 `boardToolPrompt`。沒有依「振幅、波長」這類詞在本地畫標 |
| iPad 殼 | Capacitor。首頁、設定、課堂。教材欄可拖寬。GitHub Actions 可打未簽名的 iPad IPA。workflow 還沒實際跑成功 |
| 可選的雲端回答 | Grok（必備）、OpenAI、Gemini、Claude、DeepSeek、Groq、Mistral，以及「局域網」。局域網填 OpenAI 相容位址（預設 `http://127.0.0.1:11434/v1`），金鑰可空。Grok 仍是預設 |

課程存在 `localStorage` 鍵 `ai-study-course-v1` 的 `course`。舊的 `ai-study-demo-v1`（波的性質示範）不再讀。備課 JSON 的解析在 `src/prompt.ts` 的 `parseCourse`。

## 尚未完成

1. 檔案上傳已接上首頁備課。PDF 用 pdf.js，docx 用 mammoth，pptx 抽出投影片文字，txt／md 直接讀。舊版 .doc／.ppt 會請使用者另存。抽出的文字進「教材或主題」，備課仍走 `onPlan`。解析仍只收文字、公式、旁註。
2. 教學對象（年級、科目、程度）與教學語言的設定。設定頁只有 AI 供應商、金鑰與模型名稱。需求寫明這兩個設定的預設值尚未指定。
3. 簡單圖形元素做成 AI 可選的一套元件。現在的線、箭頭、括號、點是波圖元件裡寫死的，不是通用圖形。
4. 講稿與板書用語音時間戳對齊。現在是一段講稿配一組 `setTimeout`，不是說到某個詞才寫上對應區塊。
5. 超出教材只在學生明確要求時發生。內建規則只擋「量子、相對論、光電、雙狹縫」這幾個詞；其他問句會給一句泛用補充。雲端回答的系統提示有寫這條規則，但是否遵守取決於模型。
6. 簡答題。現在題型只有 `choice` 與 `fill`。
7. PDF 裡的文字與公式是頁面截圖，不是可選取的文字。
8. 螢光筆筆跡沒有跨次上課保存。重載就沒有。換色功能已依要求刪除，不要再加回去。
9. `?fresh=1` 清的是 `ai-study-course-v1`。
10. 未簽名 IPA。GitHub Actions 可產出 `AI-Study-ipad`。這份沒有簽章，要用 Sideloadly 加使用者的 Apple ID 安裝，不能直接點開。不要改 git config。不要只為了更新這份進度文件去 push `main`，否則 workflow 會再打一次 IPA。
11. 自動測試。瀏覽器手動看過翻頁、全螢幕、綠板、螢光筆、發問後才啟用回放。

## Bug 與已試過的處理

### PDF 和畫面上的白板不一樣（2026-11-19 再改）

- 現象：匯出檔和正在看的白板不是同一張圖。先前只把底色從 `#173728` 改成白板色，離屏那份仍是另一個寬度、動畫停在第一幀。
- 已試過：匯出時用 `flushSync` 切到每一頁，等 80ms，對畫面上的 `.sheet` 呼叫 `captureSheet`。`.is-export` 關掉畫線動畫再截。
- 結果：程式已改。沒有再下載一份新的 PDF 去蓋掉使用者拿來對照的檔案。

### PDF 整頁像加了黑色濾鏡（先前那次，不夠）

- 現象：匯出的白板 PDF 底是深色，字和線不像畫面上的白紙。
- 原因：`src/pdf.ts` 的 `toPng` 把 `backgroundColor` 寫死成舊綠板 `#173728`。另外 `.draw` 用 `stroke-dashoffset: 1` 做畫線動畫，離屏節點會從第一幀截，線是空的，只剩那層深色底。`.ink` 淡入也有同樣風險。
- 已試過：改成把目前白板底色傳進 `boardPdf`。匯出根節點加 `is-export`，關掉畫線與淡入，線的 `stroke-dashoffset` 設回 0。
- 結果：程式已改。`npx tsc --noEmit` 通過。沒有再按一次匯出，避免下載檔蓋掉使用者拿來報錯的那份 PDF。

### 換頁變成整板上下滑（已修）

- 現象：所有頁接成一條，靠捲動看前面的板書。使用者要的是白板右下角的翻頁。
- 已試過：可見區只掛目前這一頁。`pages` 設 `overflow: hidden`。右下角上一頁／下一頁。老師寫到新頁才改 `viewPage`。雷射筆不再 `scrollIntoView`。
- 結果：`?fast=1` 講完是 `4 / 4`。按上一頁會到第 3 頁的動畫，教材欄不會跟著捲成下一頁。頁內容比白板高時，捲的是這一頁自己（`.sheet { overflow: auto }`），不會捲進別頁。

### 逐字稿面板（已修）

- 現象：白板下有一大塊逐字稿，把歷史全部列出來。
- 已試過：拿掉 `.transcript`。目前這句用 `.yt-caption`（黑底白字、置中）放在白板和底部控制列之間。輸入只留一行「打斷、發問」。
- 結果：課堂上不再有逐字稿清單。字幕是 `state.caption`。

### `src/App.tsx` 送出按鈕型別錯誤（已不在目前檔案）

- 現象：更早一次 `npx tsc --noEmit` 在約第 413 行失敗。`onClick={onSend}`，而 `onSend` 的參數是答案文字，不是滑鼠事件。同一段上方曾有一組重複的底部輸入列。
- 已試過：後來的課堂改寫把那組舊輸入拿掉，送出是 `onClick={() => void onSend()}`。2026-11-19 晚重跑 `tsc` 通過。
- 結果：不要再依那次錯誤去補底部第二組輸入，也不要補 `showTranscript` / `setShowTranscript`。那些狀態已經不在檔案裡。

### 型別檢查一度同時報出多個錯誤（已不再出現）

- 現象：同一次檢查裡還出現過 `nodes` 重複宣告、`showTranscript` / `showMaterial` 未定義，以及 `job.note.anchor` 不是每種 Reveal 都有、SVG ref 型別不對。
- 已試過：註記先縮小到 `note.type === 'note'`，SVG ref 改成 `SVGSVGElement`，再跑 `tsc`。
- 結果：那些錯誤已不在目前檔案裡。

### 板書對比與控制壓到字上（先前已修，這次又調整）

- 現象：深色課堂的字色繼承到白板，標題看不見；絕對定位的翻頁和控制疊在板書上。
- 已試過：白板用自己的 `color` / `background`。控制改到白板外的上列與下列，不再蓋住筆畫。
- 結果：全螢幕綠板時，動畫頁的線是淺色、控制在白板外面。

## 技術決策

- 課程由模型依上傳或貼上的教材備課，不再寫死一堂課。需求檔不寫技術選型。
- 板書是追加的區塊清單（`Reveal`），不是手繪座標，也不是整頁 HTML。已出現的區塊不回頭改內容；重講是再指一次或再追加一則註記。
- 使用者畫的全螢幕示意是區域，不是像素規格。互動區跟著課程出現在白板上（現在是第 4 頁的實驗），不要做成永遠釘在左邊的框。
- 翻頁是工具，不是把整面白板做成可點的互動區。只有打開螢光筆時，白板才吃指標。
- 雷射筆是播放狀態，持久化時一律存成 `null`。
- 互動實驗的振幅、頻率留在 `WaveLab` 元件裡，不寫進 `reveals`。
- 學生原聲不進 state、不進 localStorage、不進回放。回放只重播文字、板書與雷射筆，老師的話在回放時再合成一次，不重新打模型。
- 回放從第一次發問才錄，是為了不要把開場到發問前的整段講稿再送去模型。發問前的板書放在 `replayBoard`。`retell` 會改掉最後一則已錄的老師句子，回放講的是已經生成的那句。
- API 金鑰只放在這台裝置的 `localStorage`（鍵 `ai-study-provider-v1`）。沒接上模型時不能備課，也不會播一堂假課。不要把金鑰寫進文件、commit 或 log。
- iPad 呼叫供應商時走 `CapacitorHttp`，避免瀏覽器跨網域限制。Capacitor 設定裡 `CapacitorHttp.enabled` 為 true。
- PDF 用 `html-to-image` 把每一頁轉成 PNG 再嵌入。這樣動畫與實驗的當下畫面能進檔。代價是 PDF 文字不能選取。底色必須跟白板走，不能再寫死 `#173728`。
- iOS 的 IPA workflow（`.github/workflows/ios-ipa.yml`）用 `CODE_SIGNING_ALLOWED=NO` 與 `TARGETED_DEVICE_FAMILY=2` 打未簽名 iPad 套件，上傳 artifact `AI-Study-ipad`。這個套件不能直接裝到沒有額外簽章流程的裝置。
- `?fast` 只為了縮短手動檢查時間，不是產品模式。
- 不要改 git config。使用者已要求打包 IPA，所以登入後可以 commit 並 push 以跑 Actions。在那之前不要自己發明作者信箱。

## 重要檔案

| 檔案 | 角色 |
| --- | --- |
| `docs/AI智慧教學工具-需求.md` | 已確定的產品需求。改行為前先對這份 |
| `PROGRESS.md` | 本交接文件 |
| `src/model.ts` | 課程狀態機、localStorage。`recording` 預設 false，`replayBoard` 在第一次 `ask` 時寫入。沒有寫死教材 |
| `src/App.tsx` | 首頁／設定／課堂、語音、翻頁、全螢幕、板色、螢光筆、匯出、回放 |
| `src/board.tsx` | 板書頁、波圖、動畫、實驗、引線、雷射筆、螢光筆、`boardColors` |
| `src/speech.ts` | 語音合成與語音轉文字 |
| `src/pdf.ts` | 白板轉 PDF。底色由呼叫端傳入 |
| `src/settings.ts` | 供應商、金鑰、局域網位址、雲端問答 |
| `src/files.ts` | 上傳的 PDF、docx、pptx、txt、md 轉成備課文字 |
| `src/prompt.ts` | 白板工具提示詞、備課 JSON、出題提示詞 |
| `src/quiz.tsx` | 另一面測驗白板 |
| `src/shell.tsx` | iPad 首頁與設定畫面。首頁有上傳檔案 |
| `src/styles.css` | 版面。`.is-export` 關掉匯出時的畫線動畫 |
| `capacitor.config.json` | App ID `com.aistudy.blackboard.demo`，webDir `dist` |
| `.github/workflows/ios-ipa.yml` | 未簽名 iPad IPA |
| `package.json` | `npm run dev` / `npm run build`。React 19、Vite 8、Capacitor 8、KaTeX、pdf-lib、pdfjs-dist、mammoth、jszip |

## 本地資料

- `ai-study-course-v1`：課程、板書、段數、字幕、測驗、回放事件、`recording`、`replayBoard`。
- `ai-study-provider-v1`：供應商與 API 金鑰。不要把這個鍵的內容寫進文件、commit 或 log。
- 白板顏色與螢光筆目前只在 React state，不在上面兩個鍵裡。
