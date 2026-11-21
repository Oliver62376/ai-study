import Foundation

/// Gemini Gateway — 固定 Bearer；使用者只填啟用碼（存於 keys.official）。
enum GatewayConfig {
    static let baseURL = "https://gemini-gateway.boboyuyu125.workers.dev/v1"
    static let activationHeader = "X-Activation-Code"

    /// 建置前於 Info.plist 填入 `OFFICIAL_GATEWAY_BEARER`，或在此填入固定 Token。
    private static let builtInBearer = "sk-proxy-XIkMNYU8u8ct6hPZQoexCVQTX4rK-Emq4ko5xdIV83M"

    static var bearer: String {
        if let value = Bundle.main.object(forInfoDictionaryKey: "OFFICIAL_GATEWAY_BEARER") as? String {
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty { return trimmed }
        }
        return builtInBearer
    }

    static func ready(activationCode: String) -> Bool {
        !bearer.isEmpty && !activationCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}