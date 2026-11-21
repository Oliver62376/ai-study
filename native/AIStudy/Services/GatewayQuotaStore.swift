import Foundation

struct GatewayQuota: Codable, Equatable {
    var remaining_requests_minute: Int
    var remaining_requests_day: Int
    var remaining_tokens: Int
}

struct GatewayQuotaState: Codable {
    var quota: GatewayQuota
    var caps: GatewayQuotaCaps
    var updatedAt: TimeInterval
}

struct GatewayQuotaCaps: Codable {
    var requests_minute: Int?
    var requests_day: Int?
    var tokens_day: Int?
}

enum GatewayQuotaStore {
    private static let key = "ai-study-gateway-quota-v1"

    static func load() -> GatewayQuotaState? {
        guard let data = UserDefaults.standard.data(forKey: key),
              let state = try? JSONDecoder().decode(GatewayQuotaState.self, from: data) else {
            return nil
        }
        return state
    }

    static func apply(_ quota: GatewayQuota, usageTokens: Int = 0) {
        var caps = load()?.caps ?? GatewayQuotaCaps()
        if quota.remaining_requests_minute >= 0 {
            caps.requests_minute = max(caps.requests_minute ?? 0, quota.remaining_requests_minute + 1)
        }
        if quota.remaining_requests_day >= 0 {
            caps.requests_day = max(caps.requests_day ?? 0, quota.remaining_requests_day + 1)
        }
        if quota.remaining_tokens >= 0 {
            let bump = max(usageTokens, 1)
            caps.tokens_day = max(caps.tokens_day ?? 0, quota.remaining_tokens + bump)
        }
        let state = GatewayQuotaState(quota: quota, caps: caps, updatedAt: Date().timeIntervalSince1970)
        guard let data = try? JSONEncoder().encode(state) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}