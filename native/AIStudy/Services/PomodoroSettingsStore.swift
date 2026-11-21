import Foundation

struct PomodoroSettings: Codable, Equatable {
    var workMinutes: Int = 25
    var shortBreakMinutes: Int = 5
    var longBreakMinutes: Int = 15
    var roundsUntilLongBreak: Int = 4
    var autoStartBreaks: Bool = true
    var autoStartFocus: Bool = false

    static let `default` = PomodoroSettings()
}

enum PomodoroSettingsStore {
    private static let key = "ai-study-pomodoro-settings-v1"

    static var settings: PomodoroSettings {
        get {
            guard let data = UserDefaults.standard.data(forKey: key),
                  let value = try? JSONDecoder().decode(PomodoroSettings.self, from: data) else {
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