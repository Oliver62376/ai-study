import Foundation

enum ProviderAIError: LocalizedError {
    case notConfigured
    case badResponse(String)

    var errorDescription: String? {
        switch self {
        case .notConfigured: "請先在設定填入 API 金鑰。"
        case let .badResponse(msg): msg
        }
    }
}

enum ProviderAIService {
    static func ask(
        question: String,
        context: String = "",
        system: String? = nil,
        store: ProviderSettingsStore = .shared
    ) async throws -> String {
        let provider = store.activeProvider
        guard store.isConnected(for: provider) else { throw ProviderAIError.notConfigured }

        let model = store.model(for: provider)
        let key = store.key(for: provider)
        let base = store.base(for: provider).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let instruction = system ?? defaultChatSystem

        let userBody = context.isEmpty ? question : "\(question)\n\n\(context)"

        switch provider {
        case .gemini:
            return try await askGemini(model: model, key: key, system: instruction, user: userBody)
        case .claude:
            return try await askClaude(model: model, key: key, system: instruction, user: userBody)
        default:
            guard !base.isEmpty else { throw ProviderAIError.notConfigured }
            return try await askOpenAICompatible(base: base, key: key, model: model, system: instruction, user: userBody)
        }
    }

    private static var defaultChatSystem: String {
        "你是友善的學習助手。用繁體中文、清楚回答，避免 Markdown 與項目符號。"
    }

    private static func askOpenAICompatible(base: String, key: String, model: String, system: String, user: String) async throws -> String {
        let body: [String: Any] = [
            "model": model,
            "messages": [
                ["role": "system", "content": system],
                ["role": "user", "content": user],
            ],
        ]
        var request = URLRequest(url: URL(string: base + "/chat/completions")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if !key.isEmpty { request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization") }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, resp) = try await URLSession.shared.data(for: request)
        guard let http = resp as? HTTPURLResponse, (200 ..< 300).contains(http.statusCode) else {
            let snippet = String(data: data, encoding: .utf8) ?? ""
            throw ProviderAIError.badResponse(String(snippet.prefix(240)))
        }
        return try parseOpenAIChat(data)
    }

    private static func askGemini(model: String, key: String, system: String, user: String) async throws -> String {
        let url = URL(string: "https://generativelanguage.googleapis.com/v1beta/models/\(model.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? model):generateContent?key=\(key)")!
        let body: [String: Any] = [
            "systemInstruction": ["parts": [["text": system]]],
            "contents": [["role": "user", "parts": [["text": user]]]],
        ]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, resp) = try await URLSession.shared.data(for: request)
        guard let http = resp as? HTTPURLResponse, (200 ..< 300).contains(http.statusCode) else {
            throw ProviderAIError.badResponse("Gemini 回應錯誤")
        }
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let candidates = json?["candidates"] as? [[String: Any]] ?? []
        let parts = (candidates.first?["content"] as? [String: Any])?["parts"] as? [[String: Any]] ?? []
        let text = parts.compactMap { $0["text"] as? String }.joined().trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { throw ProviderAIError.badResponse("沒有回答") }
        return text
    }

    private static func askClaude(model: String, key: String, system: String, user: String) async throws -> String {
        let body: [String: Any] = [
            "model": model,
            "max_tokens": 1200,
            "system": system,
            "messages": [["role": "user", "content": user]],
        ]
        var request = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(key, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, resp) = try await URLSession.shared.data(for: request)
        guard let http = resp as? HTTPURLResponse, (200 ..< 300).contains(http.statusCode) else {
            throw ProviderAIError.badResponse("Claude 回應錯誤")
        }
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let content = json?["content"] as? [[String: Any]] ?? []
        let text = content.compactMap { $0["text"] as? String }.joined().trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { throw ProviderAIError.badResponse("沒有回答") }
        return text
    }

    private static func parseOpenAIChat(_ data: Data) throws -> String {
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let choices = json["choices"] as? [[String: Any]],
              let message = choices.first?["message"] as? [String: Any],
              let content = message["content"] as? String else {
            throw ProviderAIError.badResponse("無法解析回覆")
        }
        return content.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}