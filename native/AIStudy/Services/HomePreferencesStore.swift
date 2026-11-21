import Foundation

enum HomeMode: String, Codable {
    case board
    case chat
}

enum HomePreferencesStore {
    private static let key = "ai-study.homeMode"

    static var homeMode: HomeMode {
        get {
            guard let raw = UserDefaults.standard.string(forKey: key),
                  let mode = HomeMode(rawValue: raw) else {
                return .chat
            }
            return mode
        }
        set { UserDefaults.standard.set(newValue.rawValue, forKey: key) }
    }
}