import SwiftData
import SwiftUI

struct NotebookLibraryView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \Notebook.updatedAt, order: .reverse) private var notebooks: [Notebook]

    var body: some View {
        Group {
            if notebooks.isEmpty {
                ContentUnavailableView {
                    Label("尚無筆記本", systemImage: "book.closed")
                } actions: {
                    Button("建立筆記本") { createBook() }
                        .buttonStyle(.borderedProminent)
                }
            } else {
                List {
                    ForEach(notebooks) { book in
                        NavigationLink {
                            NotebookEditorView(notebook: book)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(book.title)
                                    .font(.headline)
                                Text("\(book.pages.count) 頁 · 更新 \(book.updatedAt.formatted(date: .abbreviated, time: .shortened))")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .onDelete(perform: deleteBooks)
                }
            }
        }
        .navigationTitle("筆記庫")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    createBook()
                } label: {
                    Image(systemName: "plus")
                }
            }
            ToolbarItem(placement: .topBarLeading) {
                Button("從 PDF 建立") { }
                    .disabled(true)
            }
        }
    }

    private func createBook() {
        _ = Notebook.makeDefault(in: context)
    }

    private func deleteBooks(at offsets: IndexSet) {
        for index in offsets {
            context.delete(notebooks[index])
        }
        try? context.save()
    }
}