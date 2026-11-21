import Foundation
import Observation
import UserNotifications

enum PomodoroPhase: String, Codable, CaseIterable {
    case idle
    case focus
    case shortBreak
    case longBreak

    var title: String {
        switch self {
        case .idle: "就緒"
        case .focus: "專注"
        case .shortBreak: "短休息"
        case .longBreak: "長休息"
        }
    }
}

@Observable
@MainActor
final class PomodoroClock {
    static let shared = PomodoroClock()

    private(set) var phase: PomodoroPhase = .idle
    private(set) var isRunning = false
    private(set) var remainingSeconds = 0
    private(set) var sessionsToday = 0
    private(set) var focusStreakInCycle = 0

    private var deadline: Date?
    private var tickTimer: Timer?
    private let persistKey = "ai-study-pomodoro-state-v1"

    private init() {
        restore()
        syncFromWallClock()
    }

  var progress: Double {
        let total = totalSeconds(for: phase)
        guard total > 0 else { return 0 }
        return 1 - Double(remainingSeconds) / Double(total)
    }

    var compactLabel: String {
        guard phase != .idle || isRunning else { return "" }
        let m = remainingSeconds / 60
        let s = remainingSeconds % 60
        return String(format: "%d:%02d", m, s)
    }

    func totalSeconds(for phase: PomodoroPhase) -> Int {
        let cfg = PomodoroSettingsStore.settings
        switch phase {
        case .idle:
            return cfg.workMinutes * 60
        case .focus:
            return cfg.workMinutes * 60
        case .shortBreak:
            return cfg.shortBreakMinutes * 60
        case .longBreak:
            return cfg.longBreakMinutes * 60
        }
    }

    func start() {
        Task { await PomodoroNotifications.ensureAuthorization() }
        if phase == .idle {
            enter(phase: .focus, running: true)
        } else {
            resume()
        }
    }

    func pause() {
        guard isRunning else { return }
        isRunning = false
        if let deadline {
            remainingSeconds = max(0, Int(deadline.timeIntervalSinceNow.rounded(.down)))
        }
        self.deadline = nil
        stopTicking()
        PomodoroNotifications.cancelPending()
        persist()
    }

    func reset() {
        isRunning = false
        phase = .idle
        remainingSeconds = totalSeconds(for: .focus)
        deadline = nil
        stopTicking()
        PomodoroNotifications.cancelPending()
        persist()
    }

    func skip() {
        guard phase != .idle else { return }
        finishCurrentPhase()
    }

    func syncFromWallClock() {
        var safety = 0
        while safety < 8 {
            safety += 1
            guard isRunning, let deadline else { break }
            remainingSeconds = max(0, Int(deadline.timeIntervalSinceNow.rounded(.down)))
            if remainingSeconds > 0 { break }
            finishCurrentPhase()
        }
        persist()
    }

    private func resume() {
        guard !isRunning, phase != .idle else { return }
        if remainingSeconds <= 0 { remainingSeconds = totalSeconds(for: phase) }
        isRunning = true
        deadline = Date().addingTimeInterval(TimeInterval(remainingSeconds))
        scheduleNotification()
        startTicking()
        persist()
    }

    private func enter(phase: PomodoroPhase, running: Bool) {
        self.phase = phase
        remainingSeconds = totalSeconds(for: phase)
        isRunning = running
        if running {
            deadline = Date().addingTimeInterval(TimeInterval(remainingSeconds))
            scheduleNotification()
            startTicking()
        } else {
            deadline = nil
            stopTicking()
        }
        persist()
    }

    private func finishCurrentPhase() {
        let cfg = PomodoroSettingsStore.settings
        switch phase {
        case .focus:
            sessionsToday += 1
            focusStreakInCycle += 1
            let longNext = focusStreakInCycle >= max(1, cfg.roundsUntilLongBreak)
            if longNext {
                focusStreakInCycle = 0
                if cfg.autoStartBreaks {
                    enter(phase: .longBreak, running: true)
                } else {
                    enter(phase: .longBreak, running: false)
                }
            } else if cfg.autoStartBreaks {
                enter(phase: .shortBreak, running: true)
            } else {
                enter(phase: .shortBreak, running: false)
            }
        case .shortBreak, .longBreak:
            if cfg.autoStartFocus {
                enter(phase: .focus, running: true)
            } else {
                enter(phase: .focus, running: false)
            }
        case .idle:
            reset()
        }
    }

    private func startTicking() {
        stopTicking()
        tickTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.syncFromWallClock()
            }
        }
    }

    private func stopTicking() {
        tickTimer?.invalidate()
        tickTimer = nil
    }

    private func scheduleNotification() {
        guard isRunning, let deadline, phase != .idle else { return }
        PomodoroNotifications.schedule(
            at: deadline,
            title: phase == .focus ? "專注時間結束" : "休息結束",
            body: phase == .focus ? "休息一下，喝口水吧。" : "回到專注，繼續學習。"
        )
    }

    private struct Persisted: Codable {
        var phase: PomodoroPhase
        var isRunning: Bool
        var remainingSeconds: Int
        var deadline: Date?
        var sessionsToday: Int
        var focusStreakInCycle: Int
        var dayStamp: String
    }

    private static func dayStamp(_ date: Date = .now) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    private func persist() {
        let payload = Persisted(
            phase: phase,
            isRunning: isRunning,
            remainingSeconds: remainingSeconds,
            deadline: deadline,
            sessionsToday: sessionsToday,
            focusStreakInCycle: focusStreakInCycle,
            dayStamp: Self.dayStamp()
        )
        guard let data = try? JSONEncoder().encode(payload) else { return }
        UserDefaults.standard.set(data, forKey: persistKey)
    }

    private func restore() {
        guard let data = UserDefaults.standard.data(forKey: persistKey),
              let saved = try? JSONDecoder().decode(Persisted.self, from: data) else {
            remainingSeconds = totalSeconds(for: .focus)
            return
        }
        phase = saved.phase
        isRunning = saved.isRunning
        remainingSeconds = saved.remainingSeconds
        deadline = saved.deadline
        focusStreakInCycle = saved.focusStreakInCycle
        if saved.dayStamp == Self.dayStamp() {
            sessionsToday = saved.sessionsToday
        } else {
            sessionsToday = 0
        }
    }
}

enum PomodoroNotifications {
    private static let id = "ai-study-pomodoro-phase-end"

    static func ensureAuthorization() async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        if settings.authorizationStatus == .notDetermined {
            _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
        }
    }

    static func schedule(at date: Date, title: String, body: String) {
        cancelPending()
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let interval = max(1, date.timeIntervalSinceNow)
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
        let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request)
    }

    static func cancelPending() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [id])
    }
}