import SwiftData
import SwiftUI
import UniformTypeIdentifiers

struct NotebookLibraryView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \Notebook.updatedAt, order: .reverse) private var notebooks: [Notebook]

    @State private var path = NavigationPath()
    @State private var importPDF = false
    @State private var importError = ""
    @State private var showError = false
    @State private var showSettings = false
    @State private var bookToDelete: Notebook?
    @State private var showDeleteConfirm = false

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if notebooks.isEmpty {
                    emptyState
                } else {
                    ScrollView {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 168), spacing: 16)], spacing: 16) {
                            ForEach(notebooks) { book in
                                Button {
                                    path.append(book.id)
                                } label: {
                                    notebookCard(book)
                                }
                                .buttonStyle(.plain)
                                .contextMenu {
                                    Button("刪除筆記本", systemImage: "trash", role: .destructive) {
                                        bookToDelete = book
                                        showDeleteConfirm = true
                                    }
                                }
                                .onLongPressGesture(minimumDuration: 0.5) {
                                    bookToDelete = book
                                    showDeleteConfirm = true
                                }
                            }
                        }
                        .padding(20)
                    }
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("我的筆記")
            .navigationDestination(for: String.self) { bookId in
                if let book = notebooks.first(where: { $0.id == bookId }) {
                    NotebookEditorView(notebook: book)
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("新筆記本", systemImage: "square.and.pencil") { createBook() }
                        Button("從 PDF 建立", systemImage: "doc.richtext") { importPDF = true }
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .symbolRenderingMode(.hierarchical)
                    }
                }
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showSettings = true
                    } label: {
                        Image(systemName: NotebookIcons.settings.systemName)
                    }
                    .accessibilityLabel(NotebookIcons.settings.label)
                }
            }
        }
        .sheet(isPresented: $showSettings) {
            NavigationStack {
                SettingsView()
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("完成") { showSettings = false }
                        }
                    }
            }
        }
        .fileImporter(isPresented: $importPDF, allowedContentTypes: [.pdf], allowsMultipleSelection: false) { result in
            handleImport(result)
        }
        .alert("匯入失敗", isPresented: $showError) {
            Button("好", role: .cancel) {}
        } message: {
            Text(importError)
        }
        .alert("刪除筆記本？", isPresented: $showDeleteConfirm) {
            Button("刪除", role: .destructive) {
                if let book = bookToDelete {
                    deleteBook(book)
                }
                bookToDelete = nil
            }
            Button("取消", role: .cancel) { bookToDelete = nil }
        } message: {
            if let book = bookToDelete {
                Text("「\(book.title)」及其 \(book.pages.count) 頁將永久刪除。")
            }
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
        let cover = book.pages.sorted { $0.sortIndex < $1.sortIndex }.first
        return VStack(alignment: .leading, spacing: 8) {
            Group {
                if let cover, let image = PageThumbnailRenderer.render(page: cover, targetWidth: 220) {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                } else {
                    NotebookTheme.paper
                        .overlay {
                            Image(systemName: "pencil.and.scribble")
                                .font(.title)
                                .foregroundStyle(NotebookTheme.header.opacity(0.35))
                        }
                }
            }
            .frame(height: 150)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .shadow(color: .black.opacity(0.1), radius: 6, y: 3)

            Text(book.title)
                .font(.headline)
                .lineLimit(2)
                .foregroundStyle(.primary)
            Text("\(book.pages.count) 頁 · \(book.updatedAt.formatted(date: .abbreviated, time: .omitted))")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private func createBook() {
        _ = Notebook.makeDefault(in: context)
    }

    private func deleteBook(_ book: Notebook) {
        context.delete(book)
        try? context.save()
    }

    private func handleImport(_ result: Result<[URL], Error>) {
        switch result {
        case let .success(urls):
            guard let url = urls.first else { return }
            do {
                let book = try Notebook.makeFromPDF(at: url, in: context)
                for page in book.pages {
                    PageThumbnailRenderer.refreshThumbnail(page: page)
                }
                try? context.save()
            } catch {
                importError = error.localizedDescription
                showError = true
            }
        case let .failure(error):
            importError = error.localizedDescription
            showError = true
        }
    }
}