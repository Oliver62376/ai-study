import Foundation
import SwiftData

enum TrashRetentionStore {
    private static let key = "trash.retentionDays"

    static var retentionDays: Int {
        get {
            let v = UserDefaults.standard.integer(forKey: key)
            return v > 0 ? v : 30
        }
        set { UserDefaults.standard.set(max(1, newValue), forKey: key) }
    }

    static func purgeExpired(in context: ModelContext, notebooks: [Notebook]) {
        let cutoff = Date().addingTimeInterval(-Double(retentionDays) * 86400)
        for book in notebooks where book.deletedAt != nil {
            guard let deletedAt = book.deletedAt, deletedAt < cutoff else { continue }
            context.delete(book)
        }
        try? context.save()
    }
}