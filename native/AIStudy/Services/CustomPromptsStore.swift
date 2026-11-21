import Foundation

enum PromptSlot: String, Codable, CaseIterable, Identifiable {
    case plan, chat, notebook, quiz, teach

    var id: String { rawValue }

    var label: String {
        switch self {
        case .plan: "備課"
        case .chat: "Chat"
        case .notebook: "筆記 AI"
        case .quiz: "測驗出題"
        case .teach: "講課風格（不含白板工具）"
        }
    }
}

struct CustomPrompts: Codable, Equatable {
    var plan: String = ""
    var chat: String = ""
    var notebook: String = ""
    var quiz: String = ""
    var teach: String = ""

    static let `default` = CustomPrompts()

    subscript(slot: PromptSlot) -> String {
        get {
            switch slot {
            case .plan: plan
            case .chat: chat
            case .notebook: notebook
            case .quiz: quiz
            case .teach: teach
            }
        }
        set {
            switch slot {
            case .plan: plan = newValue
            case .chat: chat = newValue
            case .notebook: notebook = newValue
            case .quiz: quiz = newValue
            case .teach: teach = newValue
            }
        }
    }
}

enum CustomPromptsStore {
    private static let key = "ai-study-custom-prompts-v1"

    static var prompts: CustomPrompts {
        get {
            guard let data = UserDefaults.standard.data(forKey: key),
                  let value = try? JSONDecoder().decode(CustomPrompts.self, from: data) else {
                return .default
            }
            return value
        }
        set {
            guard let data = try? JSONEncoder().encode(newValue) else { return }
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    static func appendExtra(_ base: String, slot: PromptSlot) -> String {
        let tail = prompts[slot].trimmingCharacters(in: .whitespacesAndNewlines)
        guard !tail.isEmpty else { return base }
        return "\(base)\n\n【\(slot.label)】\n\(tail)"
    }
}