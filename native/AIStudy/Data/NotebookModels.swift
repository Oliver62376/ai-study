import Foundation
import SwiftData

@Model
final class Notebook {
    var id: String
    var title: String
    var updatedAt: Date
    @Relationship(deleteRule: .cascade, inverse: \NotePage.notebook)
    var pages: [NotePage]

    init(id: String = UUID().uuidString, title: String, updatedAt: Date = .now, pages: [NotePage] = []) {
        self.id = id
        self.title = title
        self.updatedAt = updatedAt
        self.pages = pages
    }
}

@Model
final class NotePage {
    var id: String
    var title: String
    var sortIndex: Int
    var updatedAt: Date
    /// Serialized `PKDrawing` from PencilKit.
    var pkDrawingData: Data?
    var backgroundImageData: Data?
    var notebook: Notebook?

    init(
        id: String = UUID().uuidString,
        title: String,
        sortIndex: Int,
        updatedAt: Date = .now,
        pkDrawingData: Data? = nil,
        backgroundImageData: Data? = nil
    ) {
        self.id = id
        self.title = title
        self.sortIndex = sortIndex
        self.updatedAt = updatedAt
        self.pkDrawingData = pkDrawingData
        self.backgroundImageData = backgroundImageData
    }
}

extension Notebook {
    static func makeDefault(in context: ModelContext) -> Notebook {
        let page = NotePage(title: "第 1 頁", sortIndex: 0)
        let book = Notebook(title: "新筆記本", pages: [page])
        page.notebook = book
        context.insert(book)
        try? context.save()
        return book
    }
}