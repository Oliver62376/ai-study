# Gemini Gateway

位址：`https://gemini-gateway.boboyuyu125.workers.dev/v1`

App 內「官方 API」供應商使用此端點；使用者只填 **啟用碼**，固定 Bearer 由建置設定注入：

- Web：`VITE_OFFICIAL_GATEWAY_TOKEN`（見根目錄 `.env.example`）
- iOS：`Info.plist` → `OFFICIAL_GATEWAY_BEARER`

每次請求標頭：

- `Authorization: Bearer <固定 token>`
- `X-Activation-Code: <啟用碼>`

用量見回應 `gateway_quota` 或標頭 `X-Remaining-*`。詳見桌面說明檔 `gemini-gateway-請求格式.md`。