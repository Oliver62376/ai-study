import SwiftData
import SwiftUI
import UniformTypeIdentifiers

struct NotebookLibraryView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \Notebook.updatedAt, order: .reverse) private var notebooks: [Notebook]

    @State private var importPDF = false
    @State private var importError = ""
    @State private var showError = false

    var body: some View {
        NavigationStack {
            Group {
                if notebooks.isEmpty {
                    emptyState
                } else {
                    ScrollView {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 220), spacing: 16)], spacing: 16) {
                            ForEach(notebooks) { book in
                                NavigationLink {
                                    NotebookEditorView(notebook: book)
                                } label: {
                                    notebookCard(book)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(20)
                    }
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("我的筆記")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("新筆記本") { createBook() }
                        Button("從 PDF 建立") { importPDF = true }
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .symbolRenderingMode(.hierarchical)
                    }
                }
            }
        }
        .fileImporter(isPresented: $importPDF, allowedContentTypes: [.pdf], allowsMultipleSelection: false) { result in
            switch result {
            case let .success(urls):
                guard let url = urls.first else { return }
                do {
                    _ = try Notebook.makeFromPDF(at: url, in: context)
                } catch {
                    importError = error.localizedDescription
                    showError = true
                }
            case let .failure(error):
                importError = error.localizedDescription
                showError = true
            }
        }
        .alert("匯入失敗", isPresented: $showError) {
            Button("好", role: .cancel) {}
        } message: {
            Text(importError)
        }
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("還沒有筆記本", systemImage: "book.closed.fill")
        } description: {
            Text("用 Apple Pencil 書寫，或從 PDF 一鍵建立")
        } actions: {
            Button("新筆記本") { createBook() }
                .buttonStyle(.borderedProminent)
            Button("從 PDF 建立") { importPDF = true }
        }
    }

    private func notebookCard(_ book: Notebook) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            RoundedRectangle(cornerRadius: 8)
                .fill(NotebookTheme.paper)
                .frame(height: 140)
                .overlay {
                    Image(systemName: "pencil.and.scribble")
                        .font(.largeTitle)
                        .foregroundStyle(NotebookTheme.header.opacity(0.5))
                }
                .shadow(color: .black.opacity(0.08), radius: 6, y: 3)
            Text(book.title)
                .font(.headline)
                .lineLimit(2)
                .foregroundStyle(.primary)
            Text("\(book.pages.count) 頁 · \(book.updatedAt.formatted(date: .abbreviated, time: .omitted))")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private func createBook() {
        _ = Notebook.makeDefault(in: context)
    }
}