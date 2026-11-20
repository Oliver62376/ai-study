# AI Study 原生（SwiftUI + PencilKit）

**產品方向：** 不再在 WebView 上堆功能；筆記與後續模組 **全部用 Swift 重寫**。  
Capacitor 版僅維持修 bug，新功能只進 `native/`。

## 目前原生筆記（v0.2.0-beta）

- 全螢幕編輯：固定頂欄 + 工具列，僅紙張區捲動
- PencilKit（`.pencilOnly`：手指捲頁、Pencil 書寫）
- 多頁垂直連續捲動
- 從 PDF 建立筆記本、匯出 PDF、頁面管理
- 系統 `PKToolPicker` + 自訂色票／橡皮

## 安裝（Windows + iLoader）

```powershell
gh run list --workflow=ios-native.yml --limit 1
gh run download <RUN_ID> -n AI-Study-native-ipad-0.2.0-beta -D $env:USERPROFILE\Downloads
```

## 正式版命名

`native/RELEASE_CHANNEL` = `beta` → IPA 檔名帶 `-beta`；改為 `release` 即正式版檔名。