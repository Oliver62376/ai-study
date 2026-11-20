import SwiftData
import SwiftUI

struct PageManagerSheet: View {
    @Bindable var notebook: Notebook
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    private var sortedPages: [NotePage] {
        notebook.pages.sorted { $0.sortIndex < $1.sortIndex }
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(sortedPages) { page in
                    HStack {
                        Text(page.title)
                        Spacer()
                        Text(page.updatedAt.formatted(date: .omitted, time: .shortened))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .onDelete(perform: deletePages)
                .onMove(perform: movePages)
            }
            .navigationTitle("頁面管理")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("完成") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    EditButton()
                }
                ToolbarItem(placement: .bottomBar) {
                    Button("新增頁") { addPage() }
                }
            }
        }
    }

    private func deletePages(at offsets: IndexSet) {
        let pages = sortedPages
        guard pages.count > 1 else { return }
        for index in offsets {
            let page = pages[index]
            context.delete(page)
            notebook.pages.removeAll { $0.id == page.id }
        }
        reindex()
        notebook.updatedAt = .now
        try? context.save()
    }

    private func movePages(from source: IndexSet, to destination: Int) {
        var pages = sortedPages
        pages.move(fromOffsets: source, toOffset: destination)
        for (index, page) in pages.enumerated() {
            page.sortIndex = index
            page.title = "第 \(index + 1) 頁"
        }
        notebook.updatedAt = .now
        try? context.save()
    }

    private func addPage() {
        let index = (notebook.pages.map(\.sortIndex).max() ?? -1) + 1
        let page = NotePage(title: "第 \(index + 1) 頁", sortIndex: index)
        page.notebook = notebook
        notebook.pages.append(page)
        notebook.updatedAt = .now
        try? context.save()
    }

    private func reindex() {
        let pages = notebook.pages.sorted { $0.sortIndex < $1.sortIndex }
        for (index, page) in pages.enumerated() {
            page.sortIndex = index
        }
    }
}