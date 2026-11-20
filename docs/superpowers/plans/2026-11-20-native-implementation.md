# AI Study 原生（SwiftUI + PencilKit）實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or executing-plans. Steps use checkbox syntax.

**Goal:** 以獨立 Xcode 專案 `native/AIStudy` 完整取代 Capacitor Web 版功能，手寫層使用 PencilKit。

**Architecture:** SwiftUI 殼 + SwiftData 持久化；每頁 `PKDrawing`；`AIService` 移植現有 `settings.ts` provider 邏輯；教室白板用 SwiftUI Canvas／自定義 Mark 模型對齊 `board.ts`。

**Tech Stack:** Swift 5.9+, SwiftUI, SwiftData, PencilKit, PDFKit, Speech, AVFoundation, URLSession, Keychain Services

## Global Constraints

- iPadOS **17.0+**，TARGETED_DEVICE_FAMILY = iPad
- 繁體中文 UI 為預設
- API 金鑰僅 Keychain，禁止寫進 repo
- 與 Web 並存至功能對等；`native/` 不依賴 WKWebView

---

## Epic 0 — 專案骨架（本 commit）

- [x] `native/AIStudy` Swift 入口、路由、PencilKit 代表視圖
- [ ] Mac 上 `xcodebuild` 通過、實機 Pencil 試寫
- [ ] CI workflow `ios-native.yml`

---

## Epic 1 — 筆記資料與 PencilKit 編輯器

**Files:** `NotebookModels.swift`, `NotebookStore.swift`, `NotebookEditorView.swift`, `PencilCanvasView.swift`, `PDFImportService.swift`

- [ ] SwiftData `Notebook`, `NotePage`（`pkDrawingData`, `backgroundImage`, `sortIndex`, `title`）
- [ ] 筆記庫 CRUD、搜尋、刪除確認
- [ ] 多頁垂直捲動（LazyVStack），每頁一個 `PKCanvasView`
- [ ] `PKToolPicker` + 自訂色票／筆寬（對齊 Web 工具列 UX）
- [ ] PDF 匯入建立筆記本（`PDFKit`）
- [ ] 匯出筆記本 PDF（背景 + drawing image）
- [ ] 頁面管理（新增／刪除／複製／排序）

**Test:** 實機 Apple Pencil 書寫無偏移；捲動時工具列固定。

---

## Epic 2 — 筆記 AI + 設定

**Files:** `AIService.swift`, `ProviderSettings.swift`, `KeychainStore.swift`, `NotebookAIPanel.swift`, `SettingsView.swift`

- [ ] 移植 `providerOptions` / `askProvider`（Grok, OpenAI, Gemini, Claude, DeepSeek, Groq, Mistral, LAN）
- [ ] 筆記 AI 可拖曳浮窗、per-notebook thread 持久化
- [ ] 附頁截圖 vision（`UIImage` → base64）
- [ ] 設定分頁：Provider、模型、自訂 prompt、筆設定

**Test:** Grok API 連線；對話字色對比正確。

---

## Epic 3 — 首頁、課程、檔案

**Files:** `HomeView.swift`, `LessonModels.swift`, `UploadOCRService.swift`

- [ ] 首頁入口（教室、筆記、Chat、設定）
- [ ] 課程列表 `lessons.ts` 對齊
- [ ] PDF/圖片上傳與 OCR（Vision framework 或雲端）

---

## Epic 4 — 教室白板

**Files:** `ClassroomView.swift`, `BoardModels.swift`, `BoardCanvasView.swift`, `ReplayEngine.swift`

- [ ] 白板 Mark/Laser 模型對齊 `board.ts`
- [ ] 上課狀態機對齊 `model.ts` reduce
- [ ] AI 講師輪詢、公式 KaTeX → 可選 WebView 片段或預渲染
- [ ] 白板 PDF 匯出／分享

---

## Epic 5 — Chat

**Files:** `ChatView.swift`, `ChatThreadStore.swift`

- [ ] Session key、純文字 formatting（無 Markdown 污染）
- [ ] 附圖多頁 vision

---

## Epic 6 — 測驗 + 語音

**Files:** `QuizView.swift`, `SpeechService.swift`

- [ ] 測驗流程對齊 `quiz`
- [ ] STT：`SFSpeechRecognizer`
- [ ] TTS：`AVSpeechSynthesizer` + 語音列表

---

## Epic 7 — 遷移與收尾

- [ ] Web JSON 匯出說明 + 原生匯入（筆跡以預覽圖層保留，PKDrawing 新寫）
- [ ] App Icon、隱私清單、麥克風/相機權限文案
- [ ] TestFlight；版本號對齊語意化 1.0.0 native
- [ ] 退役 Capacitor 主入口（或 App Store 只上架 native）

---

## Epic 8（選做）— iCloud

- [ ] SwiftData + CloudKit 同步筆記本

---

## 本機建置（Mac）

```bash
cd native
open AIStudy.xcodeproj
# 選 iPad 實機或模擬器 → Run
```

Windows 端僅能編輯 Swift 原始碼；編譯依賴 GitHub Actions 或你的 Mac。