# AI Study — 原生 iPad（SwiftUI + PencilKit）

Capacitor/Web 版的取代路線。請在 **Mac + Xcode 15+** 開啟：

```bash
open native/AIStudy.xcodeproj
```

- **Target:** iPadOS 17+
- **Bundle ID（預設）:** `com.oliver62376.aistudy.native`
- 規格：`docs/superpowers/specs/2026-11-20-native-swiftui-design.md`
- 計畫：`docs/superpowers/plans/2026-11-20-native-implementation.md`

目前骨架含：首頁路由、筆記庫占位、**PencilKit 單頁試寫**；其餘模組為導覽占位，按 Epic 1–7 補。

## 沒有 Mac 時怎麼辦

你**本來就不需要 Mac** 來編譯——跟現有 Web 版一樣，用 **GitHub Actions 當遠端 Mac**。

1. 在 Windows 用 Cursor 改 `native/AIStudy/**/*.swift`
2. `git push` 到 `main`（或 Actions → **Build Native iPad IPA** → Run workflow）
3. 下載產物：

```powershell
gh run list --workflow=ios-native.yml --limit 3
gh run download <RUN_ID> -n AI-Study-native-ipad-0.1.0-beta -D $env:USERPROFILE\Downloads
```

Workflow：`.github/workflows/ios-native.yml`（runner `macos-15` + `xcodebuild`）。

### 裝到 iPad（iLoader，與現有 Web IPA 相同）

CI 產出的是**未簽章 IPA**；**iLoader 安裝時會用你的 Apple ID 代簽**，所以跟現在 `AI-Study-ipad-*.ipa` 流程一樣，**不用 Mac、也不用付費開發者帳號**。

1. GitHub Actions 跑完 **Build Native iPad IPA**（或 push `native/` 變更）
2. PowerShell 下載到本機：

```powershell
gh run list --workflow=ios-native.yml --limit 3
gh run download <RUN_ID> -n AI-Study-native-ipad-0.1.0-beta -D $env:USERPROFILE\Downloads
```

正式版時會把 `native/RELEASE_CHANNEL` 改成 `release`，IPA 檔名就不帶 `-beta`。

3. iPad USB 接 Windows，iTunes（給 usbmuxd）已安裝
4. 打開 **iLoader** → 登入 Apple ID → 選裝置 → **Install IPA** → 選 `AI-Study-native-ipad-0.1.0-beta.ipa`
5. 首次開啟：設定 → 一般 → VPN 與裝置管理 → **信任**開發者
6. iOS 16+：**開發者模式**要開（與 SideStore 相同）
7. **免費帳號約 7 天過期**：用 SideStore 每週 refresh，或再用 iLoader 重裝

**注意：** 原生 App Bundle ID 是 `com.oliver62376.aistudy.native`，跟 Capacitor 版是**兩個 App**，會各佔一個 sideload 名額（SideStore 免費帳號同時約 3 個）。

若 iLoader 報證書/App ID 上限，在 iLoader 裡撤銷舊的開發憑證或卸載不用的 sideload App。

### 其他

- 偶爾借 Mac：只有要除錯 Pencil 手勢時才需要
- 雲端 Mac：長期全原生可考慮
- **Apple 不讓 Windows 本機編 iOS**；編輯碼可以在 Windows，編譯只能在 Mac/CI

有 Mac 時仍可 `open native/AIStudy.xcodeproj` 做本機除