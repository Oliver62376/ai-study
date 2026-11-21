import Foundation

enum ProviderModelService {
    private static func chatLike(_ name: String) -> Bool {
        let lower = name.lowercased()
        if lower.contains("embed") || lower.contains("tts") || lower.contains("whisper") || lower.contains("dall-e") {
            return false
        }
        return true
    }

    private static func uniq(_ names: [String], fallback: String) -> [String] {
        var list = Array(Set(names)).sorted { $0.localizedCompare($1) == .orderedAscending }
        if list.isEmpty { return [fallback] }
        if !fallback.isEmpty, !list.contains(fallback) { list.insert(fallback, at: 0) }
        return list
    }

    static func listModels(for provider: ProviderId, store: ProviderSettingsStore = .shared) async -> [String] {
        let key = store.key(for: provider).trimmingCharacters(in: .whitespacesAndNewlines)
        let base = store.base(for: provider).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let fallback = store.model(for: provider)

        if provider.isLocal {
            guard !base.isEmpty else { return [fallback] }
            do {
                var request = URLRequest(url: URL(string: base + "/models")!)
                if !key.isEmpty { request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization") }
                let (data, resp) = try await URLSession.shared.data(for: request)
                guard let http = resp as? HTTPURLResponse, (200 ..< 300).contains(http.statusCode) else {
                    return [fallback]
                }
                let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
                let rows = json?["data"] as? [[String: Any]] ?? []
                let names = rows.compactMap { $0["id"] as? String }.filter { chatLike($0) }
                return uniq(names, fallback: fallback)
            } catch {
                return [fallback]
            }
        }

        if provider.isOfficial {
            let code = store.activationCode()
            guard GatewayConfig.ready(activationCode: code) else { return [fallback] }
            do {
                var request = URLRequest(url: URL(string: GatewayConfig.baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/models")!)
                request.setValue("Bearer \(GatewayConfig.bearer)", forHTTPHeaderField: "Authorization")
                request.setValue(code, forHTTPHeaderField: GatewayConfig.activationHeader)
                let (data, resp) = try await URLSession.shared.data(for: request)
                guard let http = resp as? HTTPURLResponse, (200 ..< 300).contains(http.statusCode) else {
                    return [fallback]
                }
                if let quota = ProviderAIService.parseGatewayQuota(headers: http.allHeaderFields, data: data) {
                    GatewayQuotaStore.apply(quota)
                }
                let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
                let rows = json?["data"] as? [[String: Any]] ?? []
                let names = rows.compactMap { $0["id"] as? String }.filter { chatLike($0) }
                return uniq(names, fallback: fallback)
            } catch {
                return [fallback]
            }
        }

        guard !key.isEmpty else { return [fallback] }

        switch provider {
        case .gemini:
            return await listGemini(key: key, fallback: fallback)
        case .claude:
            return await listClaude(key: key, fallback: fallback)
        default:
            return await listOpenAICompatible(base: base, key: key, fallback: fallback)
        }
    }

    private static func listOpenAICompatible(base: String, key: String, fallback: String) async -> [String] {
        guard !base.isEmpty else { return [fallback] }
        do {
            var request = URLRequest(url: URL(string: base + "/models")!)
            request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let (data, resp) = try await URLSession.shared.data(for: request)
            guard let http = resp as? HTTPURLResponse, (200 ..< 300).contains(http.statusCode) else {
                return [fallback]
            }
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            let rows = json?["data"] as? [[String: Any]] ?? []
            let names = rows.compactMap { $0["id"] as? String }.filter { chatLike($0) }
            return uniq(names, fallback: fallback)
        } catch {
            return [fallback]
        }
    }

    private static func listGemini(key: String, fallback: String) async -> [String] {
        let url = URL(string: "https://generativelanguage.googleapis.com/v1beta/models?key=\(key)")!
        do {
            let (data, resp) = try await URLSession.shared.data(from: url)
            guard let http = resp as? HTTPURLResponse, (200 ..< 300).contains(http.statusCode) else {
                return [fallback]
            }
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            let rows = json?["models"] as? [[String: Any]] ?? []
            let names = rows.compactMap { row -> String? in
                guard let raw = row["name"] as? String else { return nil }
                let name = raw.replacingOccurrences(of: "models/", with: "")
                let methods = row["supportedGenerationMethods"] as? [String]
                if let methods, !methods.isEmpty, !methods.contains("generateContent") { return nil }
                return chatLike(name) ? name : nil
            }
            return uniq(names, fallback: fallback)
        } catch {
            return [fallback]
        }
    }

    private static func listClaude(key: String, fallback: String) async -> [String] {
        var request = URLRequest(url: URL(string: "https://api.anthropic.com/v1/models")!)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(key, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        do {
            let (data, resp) = try await URLSession.shared.data(for: request)
            guard let http = resp as? HTTPURLResponse, (200 ..< 300).contains(http.statusCode) else {
                return [fallback]
            }
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            let rows = json?["data"] as? [[String: Any]] ?? []
            let names = rows.compactMap { $0["id"] as? String }.filter { chatLike($0) }
            return uniq(names, fallback: fallback)
        } catch {
            return [fallback]
        }
    }
}