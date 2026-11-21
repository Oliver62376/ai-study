import SwiftData
import SwiftUI

struct PageManagerSheet: View {
    @Bindable var notebook: Notebook
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var editMode: EditMode = .active

    private var sortedPages: [NotePage] {
        notebook.pages.sorted { $0.sortIndex < $1.sortIndex }
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(sortedPages, id: \.id) { page in
                    HStack(spacing: 12) {
                        pageThumb(page)
                            .frame(width: 54, height: 70)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                            .overlay {
                                RoundedRectangle(cornerRadius: 6)
                                    .stroke(Color.gray.opacity(0.25), lineWidth: 0.5)
                            }
                        VStack(alignment: .leading, spacing: 4) {
                            Text(page.title)
                                .font(.headline)
                            Text(page.updatedAt.formatted(date: .abbreviated, time: .shortened))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }
                .onDelete(perform: deletePages)
                .onMove(perform: movePages)
            }
            .environment(\.editMode, $editMode)
            .navigationTitle("頁面")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { dismiss() }
                }
                ToolbarItem(placement: .topBarLeading) {
                    EditButton()
                }
                ToolbarItem(placement: .bottomBar) {
                    Button {
                        addPage()
                    } label: {
                        Label("新增頁", systemImage: "plus")
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func pageThumb(_ page: NotePage) -> some View {
        if let image = PageThumbnailRenderer.render(page: page, targetWidth: 108) {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
        } else {
            NotebookTheme.paper
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
            if !page.title.contains("第") || page.title.hasSuffix("頁") {
                page.title = "第 \(index + 1) 頁"
            }
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