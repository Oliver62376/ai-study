import Foundation

struct NativeLessonRecord: Identifiable, Codable, Hashable {
    var id: String
    var title: String
    var updatedAt: TimeInterval
    var topic: String
    var mode: HomeMode
    /// 首次備課完成後由 Web 教室回寫的 JSON（與 Web `Persist` 對齊）
    var snapshotJSON: String?
}

enum LessonStore {
    private static let key = "ai-study-lessons-v1"
    private static let maxCount = 24

    static func load() -> [NativeLessonRecord] {
        guard let data = UserDefaults.standard.data(forKey: key),
              let list = try? JSONDecoder().decode([NativeLessonRecord].self, from: data) else {
            return []
        }
        return list.sorted { $0.updatedAt > $1.updatedAt }
    }

    @discardableResult
    static func register(id: String, title: String, topic: String, mode: HomeMode, snapshotJSON: String? = nil) -> String {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return id }
        var list = load()
        let prior = list.first(where: { $0.id == id })
        let record = NativeLessonRecord(
            id: id,
            title: trimmed,
            updatedAt: Date().timeIntervalSince1970,
            topic: topic,
            mode: mode,
            snapshotJSON: snapshotJSON ?? prior?.snapshotJSON
        )
        list.removeAll { $0.id == id }
        list.insert(record, at: 0)
        if list.count > maxCount { list = Array(list.prefix(maxCount)) }
        save(list)
        return id
    }

    static func saveSnapshot(id: String, snapshotJSON: String) {
        var list = load()
        guard let idx = list.firstIndex(where: { $0.id == id }) else { return }
        list[idx].snapshotJSON = snapshotJSON
        list[idx].updatedAt = Date().timeIntervalSince1970
        if let data = snapshotJSON.data(using: .utf8),
           let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let course = root["course"] as? [String: Any],
           let courseTitle = course["title"] as? String,
           !courseTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            list[idx].title = courseTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        save(list)
    }

    static func record(id: String) -> NativeLessonRecord? {
        load().first(where: { $0.id == id })
    }

    static func delete(id: String) {
        var list = load()
        list.removeAll { $0.id == id }
        save(list)
    }

    private static func save(_ list: [NativeLessonRecord]) {
        guard let data = try? JSONEncoder().encode(list) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }
}