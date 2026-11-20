# AI Study — 全原生 SwiftUI + PencilKit 設計規格

**狀態：** 已確認 v1 = **完整對等現有 Web**（蛋頭 2026-11-20）  
**日期：** 2026-11-20  
**取代策略：** 新 App 為主；Capacitor/Web 版維護至功能對等後退役（或僅內測通道保留）

---

## 1. 目標與成功標準

| 項目 | 標準 |
|------|------|
| 手寫 | Apple Pencil 延遲與筆觸使用 **PencilKit 預設管線**，無 Web 座標偏移 |
| 筆記 | 多筆記本、多頁、PDF 當背景、匯出 PDF、本機持久化 |
| AI | 筆記頁上下文 + 可選頁面截圖，多 Provider（與現有 API 金鑰模型一致） |
| 平台 | **iPadOS 17+** 為一級目標（Stage Manager、全螢幕筆記） |
| 品質 | 60fps 捲動、工具列固定不跟著被捲走、AI 浮窗可拖曳 |

教室白板、上課重播、測驗、Chat、語音 TTS/STT **全部納入 v1 交付**；實作順序仍採依賴排序（筆記核心 → AI/設定 → 教室 → 測驗/語音）。

---

## 2. 現有 Web 功能對照（遷移矩陣）

| 模組 | Web 現況 | 原生策略 |
|------|----------|----------|
| 筆記庫 / 分頁 | `notebook-hub`, localStorage | SwiftData + `Notebook` / `NotePage` |
| 墨水 | 自製 SVG strokes | `PKDrawing` 每頁一份，序列化 `.data` |
| 模板 / 紙張 | CSS 背景 | `UIImage` / PDF 背景層 + 可選 `PKCanvasView` 上疊 |
| PDF 匯入 | pdf.js | `PDFKit` 逐頁 raster 或 vector 背景 |
| 文字框 / 貼圖 | DOM overlay | Phase 1b：`UITextView` / `Image` overlay；或 Phase 2 |
| 筆記 AI | `notebook-ai-panel` | SwiftUI 可拖曳 `Sheet` + `AIService`（async/await） |
| 設定 / Provider | `settings.ts` | Keychain + `Settings` scene |
| 教室 / 白板 / Chat | `App.tsx` | Phase 2（可選 `Canvas` + 自建或簡化） |
| 語音 | Capacitor plugins | `Speech` / `AVSpeechSynthesizer` |

**資料遷移：** Phase 1 不要求自動匯入 Web localStorage；Phase 1.5 可提供一次性 JSON 匯出／匯入工具（對齊 `notebook.ts` schema）。

---

## 3. 架構（建議）

```
native/AIStudy/
  AIStudyApp.swift          # @main
  AppModel.swift            # 路由、全域狀態
  Data/
    NotebookModels.swift    # SwiftData @Model
    NotebookStore.swift     # CRUD、縮圖
  Features/
    Library/                # 筆記庫、從 PDF 建立
    Editor/                 # PencilKit 編輯器 + 工具列
    AI/                     # 浮窗對話、thread 持久化
    Settings/               # Provider、Keychain
  Services/
    AIService.swift         # URLSession，對齊現有 provider 端點
    PDFImportService.swift
    ExportService.swift     # PKDrawing + 背景 → PDF
  UI/
    PencilCanvasView.swift  # UIViewRepresentable → PKCanvasView
    DraggableAIPanel.swift
```

### 3.1 PencilKit 整合要點

- 每個 `NotePage` 存 `pkDrawingData: Data?` 與 `backgroundPDFBookmark: Data?`（或 JPEG）
- `PKToolPicker` 由系統提供；自訂工具列用 `PKInkingTool` / `PKEraserTool` 映射現有「筆／螢光／橡皮」
- 多頁：**垂直 `ScrollView` + 每頁一個 `PKCanvasView`**，或單頁切換（Goodnotes 式連續捲動用 LazyVStack）
- 縮圖：對 `PKCanvasView.drawing.image(from:scale:)` 非同步產生

### 3.2 AI 服務

- 從 `settings.ts` / `askProvider` 邏輯移植為 Swift `enum AIProvider` + 各家的 request body
- Keychain 存 API keys；UserDefaults 存模型名、選用 provider
- Vision：頁面 `UIImage` base64 附在支援的 provider（OpenAI / Gemini / Claude / Grok）

### 3.3 與現有 repo 關係

- `native/` 獨立 Xcode 專案（**不**嵌在 Capacitor `ios/App` 內），避免 WKWebView 與新殼打架
- CI：新增 `.github/workflows/ios-native.yml`（xcodebuild，與現有 Capacitor IPA 並存）
- Bundle ID 建議：`com.aistudy.native` 或與現有一致並取代（需你決定 TestFlight）

---

## 4. 分階段交付

### Phase 1 — 筆記 MVP（2–3 週實作量）

- 筆記庫：新建、刪除、重新命名
- 從 PDF 建立筆記本（PDFKit）
- 編輯器：PencilKit、undo/redo、系統 tool picker + 精簡自訂列
- 多頁垂直捲動、頁面管理（新增／刪除／排序）
- 匯出目前筆記本 PDF
- 設定頁：Grok + 至少一個備用 provider
- 筆記 AI 浮窗（拖曳、對話持久化 per notebook）

### Phase 1.5

- JSON 匯入舊 Web 筆記（strokes 需 **遺失或** 轉成點陣預覽層，無法 1:1 轉 PKDrawing）
- 文字框 / 圖片貼上

### Phase 2

- 教室白板、上課、測驗、Chat、語音
- iCloud 同步（`NSPersistentCloudKitContainer` 或 SwiftData + CloudKit）

---

## 5. 曾考慮的替代方案

| 方案 | 優點 | 缺點 |
|------|------|------|
| **A. 全原生 SwiftUI（本規格）** | PencilKit 最佳、長期維護清晰 | 重做成本高 |
| B. 僅 Capacitor PencilKit 插件 | 保留 Web UI | 仍受 WebView 版面／手勢限制 |
| C. SwiftUI 殼 + WebView 雙棲 | 漸進遷移 | 兩套手寫、使用者困惑 |

**建議：** 方案 A；Web 版凍結在修 bug 層級直到 Phase 1 可測。

---

## 6. 風險

- **Windows 開發環境無法本機編譯 Swift**：需 Mac / CI / 你的 iPad 實機測
- **Web 墨水無法自動轉 PKDrawing**：遷移以 PDF/預覽圖為主
- **形狀工具 / 套索**：PencilKit 無內建套索；Phase 1 用系統工具，套索延後

---

## 7. 已確認

| 項目 | 決策 |
|------|------|
| v1 範圍 | **完整對等 Web** |
| Bundle ID | 待定（建議 `com.oliver62376.aistudy`，與 TestFlight 延續時可討論） |
| iCloud | v1 可選；預設本機 SwiftData，同步列為 Epic 8 |

實作計畫：`docs/superpowers/plans/2026-11-20-native-implementation.md`  
程式骨架：`native/AIStudy/`