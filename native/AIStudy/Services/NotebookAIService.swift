import Foundation
import UIKit

enum NotebookAIError: LocalizedError {
    case notConfigured
    case badResponse

    var errorDescription: String? {
        switch self {
        case .notConfigured: "請先在設定填入 API 金鑰。"
        case .badResponse: "AI 回覆格式無法解析。"
        }
    }
}

enum NotebookAIService {
    static func ask(
        userMessage: String,
        mode: NotebookAiMode,
        pageTitle: String,
        history: [NbAiLine],
        pageImageJPEG: Data?
    ) async throws -> String {
        let settings = AISettingsStore.shared
        guard settings.isConnected else { throw NotebookAIError.notConfigured }

        let historyText = history.suffix(8).map { line in
            let who = line.role == "user" ? "學生" : "助教"
            return "\(who)：\(line.text)"
        }.joined(separator: "\n")

        let system = """
        \(mode.systemHint)
        用繁體中文、純文字段落回答（不要用 Markdown）。
        """

        let userContent: [[String: Any]] = {
            var parts: [[String: Any]] = [
                [
                    "type": "text",
                    "text": """
                    筆記頁：\(pageTitle)
                    \(historyText.isEmpty ? "" : "先前對話：\n\(historyText)\n")
                    學生問題：\(userMessage)
                    """,
                ],
            ]
            if let pageImageJPEG {
                let b64 = pageImageJPEG.base64EncodedString()
                parts.append([
                    "type": "image_url",
                    "image_url": ["url": "data:image/jpeg;base64,\(b64)"],
                ])
            }
            return parts
        }()

        let body: [String: Any] = [
            "model": settings.model,
            "messages": [
                ["role": "system", "content": system],
                ["role": "user", "content": userContent],
            ],
        ]

        let url = URL(string: settings.baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/chat/completions")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(settings.apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200 ..< 300).contains(http.statusCode) else {
            let snippet = String(data: data, encoding: .utf8) ?? ""
            throw NSError(domain: "NotebookAI", code: 1, userInfo: [NSLocalizedDescriptionKey: snippet.prefix(200).description])
        }

        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let choices = json["choices"] as? [[String: Any]],
              let first = choices.first,
              let message = first["message"] as? [String: Any],
              let content = message["content"] as? String else {
            throw NotebookAIError.badResponse
        }
        return content.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}