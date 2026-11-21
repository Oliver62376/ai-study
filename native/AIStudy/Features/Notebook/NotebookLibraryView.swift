import SwiftData
import SwiftUI
import UniformTypeIdentifiers

struct NotebookLibraryView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \Notebook.updatedAt, order: .reverse) private var notebooks: [Notebook]

    @State private var importPDF = false
    @State private var importError = ""
    @State private var showError = false
    @State private var showSettings = false

    var body: some View {
        NavigationStack {
            Group {
                if notebooks.isEmpty {
                    emptyState
                } else {
                    ScrollView {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 168), spacing: 16)], spacing: 16) {
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
}