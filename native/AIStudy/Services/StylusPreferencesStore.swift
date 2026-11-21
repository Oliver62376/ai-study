import Foundation

enum StylusAction: String, Codable, CaseIterable, Identifiable {
    case pen, fountain, highlighter, eraser, lasso, undo, redo, ai, toggleTool = "toggle_tool", none

    var id: String { rawValue }

    var label: String {
        switch self {
        case .pen: "原子筆"
        case .fountain: "鋼筆"
        case .highlighter: "螢光筆"
        case .eraser: "橡皮擦"
        case .lasso: "套索"
        case .undo: "復原"
        case .redo: "重做"
        case .ai: "筆記 AI"
        case .toggleTool: "切換上次的工具"
        case .none: "無"
        }
    }
}

struct StylusPreferences: Codable, Equatable {
    var palmRejection: Bool = true
    var palmRejectionMs: Int = 650
    var pencilOnly: Bool = false
    var pressure: Bool = true
    var barrelButton1: StylusAction = .eraser
    var barrelButton2: StylusAction = .toggleTool
    var doubleTap: StylusAction = .highlighter
    var eraserEnd: StylusAction = .eraser

    static let `default` = StylusPreferences()
}

enum StylusPreferencesStore {
    private static let key = "ai-study-stylus-v1"

    static var preferences: StylusPreferences {
        get {
            guard let data = UserDefaults.standard.data(forKey: key),
                  let value = try? JSONDecoder().decode(StylusPreferences.self, from: data) else {
                return .default
            }
            return value
        }
        set {
            guard let data = try? JSONEncoder().encode(newValue) else { return }
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}