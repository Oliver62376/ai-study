import Foundation

enum UploadMode: String, Codable, CaseIterable, Identifiable {
    case text
    case ocr
    case vision

    var id: String { rawValue }

    var label: String {
        switch self {
        case .text: "只擷取文字（PDF 內建文字層）"
        case .ocr: "無文字時逐頁轉圖並本機 OCR"
        case .vision: "圖片／掃描頁以圖送給支援視覺的模型"
        }
    }
}

enum NotebookPageNav: String, Codable, CaseIterable, Identifiable {
    case vertical
    case horizontal

    var id: String { rawValue }

    var label: String {
        switch self {
        case .vertical: "上下連續捲動（預設）"
        case .horizontal: "左右／按鈕換頁"
        }
    }
}

enum MaterialPanelMode: String, Codable, CaseIterable, Identifiable {
    case material, quiz, notebook

    var id: String { rawValue }

    var label: String {
        switch self {
        case .material: "教材"
        case .quiz: "測驗"
        case .notebook: "筆記"
        }
    }
}

struct AppPreferences: Codable, Equatable {
    var uploadMode: UploadMode = .text
    var ttsRate: Double = 0.82
    var ttsPitch: Double = 1
    var ttsVoice: String = ""
    var notebookPageNav: NotebookPageNav = .vertical
    var voiceAutoSend: Bool = false
    var laserEnabled: Bool = true
    var laserSizePx: Int = 18
    var pauseAfterSentenceMs: Int = 1500
    var pauseOnPageTurnMs: Int = 2000
    var materialPanel: MaterialPanelMode = .material

    static let `default` = AppPreferences()
}

enum AppPreferencesStore {
    private static let key = "ai-study-prefs-v1"

    static var preferences: AppPreferences {
        get {
            guard let data = UserDefaults.standard.data(forKey: key),
                  let value = try? JSONDecoder().decode(AppPreferences.self, from: data) else {
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