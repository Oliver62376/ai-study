import Foundation

enum NotebookAiMode: String, CaseIterable, Identifiable {
    case explain, summarize, quiz, clean

    var id: String { rawValue }

    var title: String {
        switch self {
        case .explain: "解釋"
        case .summarize: "重點"
        case .quiz: "測驗"
        case .clean: "整理"
        }
    }

    var systemHint: String {
        switch self {
        case .explain: "你是家教。看這頁筆記（含手寫），解釋重點與推論步驟。"
        case .summarize: "整理這頁筆記成條列重點（5 點內），適合考前複習。"
        case .quiz: "依這頁筆記出 3 題小測驗（含答案與一句檢討）。"
        case .clean: "把筆記內容轉成乾淨的教科書式段落（保留公式與符號）。"
        }
    }
}

struct NbAiLine: Codable, Identifiable, Hashable {
    var id: String
    var role: String
    var text: String
    var at: TimeInterval
}

@Observable
final class AISettingsStore {
    static let shared = AISettingsStore()

    var apiKey: String {
        get { UserDefaults.standard.string(forKey: "ai.apiKey") ?? "" }
        set { UserDefaults.standard.set(newValue, forKey: "ai.apiKey") }
    }

    var baseURL: String {
        get { UserDefaults.standard.string(forKey: "ai.baseURL") ?? "https://api.x.ai/v1" }
        set { UserDefaults.standard.set(newValue, forKey: "ai.baseURL") }
    }

    var model: String {
        get { UserDefaults.standard.string(forKey: "ai.model") ?? "grok-2-vision-1212" }
        set { UserDefaults.standard.set(newValue, forKey: "ai.model") }
    }

    var isConnected: Bool {
        !apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    func threadKey(notebookId: String) -> String {
        "nbAi.thread.\(notebookId)"
    }

    func loadThread(notebookId: String) -> [NbAiLine] {
        guard let data = UserDefaults.standard.data(forKey: threadKey(notebookId: notebookId)),
              let lines = try? JSONDecoder().decode([NbAiLine].self, from: data) else {
            return []
        }
        return lines
    }

    func saveThread(notebookId: String, lines: [NbAiLine]) {
        guard let data = try? JSONEncoder().encode(lines) else { return }
        UserDefaults.standard.set(data, forKey: threadKey(notebookId: notebookId))
    }
}