import Foundation

struct NativeLessonRecord: Identifiable, Codable, Hashable {
    var id: String
    var title: String
    var updatedAt: TimeInterval
    var topic: String
    var mode: HomeMode
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

    static func upsert(title: String, topic: String, mode: HomeMode) {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        var list = load()
        let id = list.first(where: { $0.title == trimmed })?.id ?? "L\(Int(Date().timeIntervalSince1970 * 1000))"
        let record = NativeLessonRecord(
            id: id,
            title: trimmed,
            updatedAt: Date().timeIntervalSince1970,
            topic: topic,
            mode: mode
        )
        list.removeAll { $0.id == id }
        list.insert(record, at: 0)
        if list.count > maxCount { list = Array(list.prefix(maxCount)) }
        save(list)
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