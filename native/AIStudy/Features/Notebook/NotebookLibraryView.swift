import SwiftData
import SwiftUI
import UniformTypeIdentifiers

enum LibraryScope: String, CaseIterable, Identifiable {
    case all = "全部"
    case trash = "回收桶"

    var id: String { rawValue }
}

struct NotebookLibraryView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \Notebook.updatedAt, order: .reverse) private var allNotebooks: [Notebook]
    @Query(sort: \NotebookFolder.sortIndex) private var folders: [NotebookFolder]

    @State private var path = NavigationPath()
    @State private var scope: LibraryScope = .all
    @State private var folderFilterId: String? = "ALL"
    @State private var importPDF = false
    @State private var importError = ""
    @State private var showError = false
    @State private var bookToTrash: Notebook?
    @State private var showTrashConfirm = false
    @State private var bookToRename: Notebook?
    @State private var renameTitle = ""
    @State private var showRename = false
    @State private var bookToMove: Notebook?
    @State private var showMoveFolder = false
    @State private var sharePDF: URL?
    @State private var showNewFolder = false
    @State private var newFolderName = ""
    @State private var actionBook: Notebook?

    private var visibleBooks: [Notebook] {
        let base = allNotebooks.filter { book in
            scope == .trash ? book.isTrashed : !book.isTrashed
        }
        guard scope == .all else { return base }
        if folderFilterId == "ALL" { return base }
        if let folderFilterId { return base.filter { $0.folderId == folderFilterId } }
        return base.filter { $0.folderId == nil }
    }

    var body: some View {
        NavigationStack(path: $path) {
            VStack(spacing: 0) {
                Picker("範圍", selection: $scope) {
                    ForEach(LibraryScope.allCases) { item in
                        Text(item.rawValue).tag(item)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 20)
                .padding(.top, 8)

                if scope == .all {
                    folderChips
                }

                Group {
                    if visibleBooks.isEmpty {
                        emptyState
                    } else {
                        ScrollView {
                            LazyVGrid(columns: [GridItem(.adaptive(minimum: 168), spacing: 16)], spacing: 16) {
                                ForEach(visibleBooks) { book in
                                    if scope == .trash {
                                        trashCard(book)
                                    } else {
                                        bookButton(book)
                                    }
                                }
                            }
                            .padding(20)
                        }
                    }
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle(scope == .trash ? "回收桶" : "我的筆記")
            .navigationDestination(for: String.self) { bookId in
                if let book = allNotebooks.first(where: { $0.id == bookId }) {
                    NotebookEditorView(notebook: book)
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("新筆記本", systemImage: "square.and.pencil") { createBook() }
                        Button("新資料夾", systemImage: "folder.badge.plus") { showNewFolder = true }
                        Button("從 PDF 建立", systemImage: "doc.richtext") { importPDF = true }
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .symbolRenderingMode(.hierarchical)
                    }
                }
            }
        }
        .onAppear {
            TrashRetentionStore.purgeExpired(in: context, notebooks: allNotebooks)
        }
        .fileImporter(isPresented: $importPDF, allowedContentTypes: [.pdf], allowsMultipleSelection: false) { result in
            handleImport(result)
        }
        .alert("匯入失敗", isPresented: $showError) {
            Button("好", role: .cancel) {}
        } message: {
            Text(importError)
        }
        .alert("移到回收桶？", isPresented: $showTrashConfirm) {
            Button("移到回收桶", role: .destructive) {
                if let book = bookToTrash { moveToTrash(book) }
                bookToTrash = nil
            }
            Button("取消", role: .cancel) { bookToTrash = nil }
        } message: {
            if let book = bookToTrash {
                Text("「\(book.title)」將在 \(TrashRetentionStore.retentionDays) 天後永久刪除。")
            }
        }
        .alert("重新命名", isPresented: $showRename) {
            TextField("筆記本名稱", text: $renameTitle)
            Button("儲存") { saveRename() }
            Button("取消", role: .cancel) {}
        }
        .alert("新資料夾", isPresented: $showNewFolder) {
            TextField("資料夾名稱", text: $newFolderName)
            Button("建立") { createFolder() }
            Button("取消", role: .cancel) {}
        }
        .sheet(isPresented: $showMoveFolder) {
            moveFolderSheet
        }
        .sheet(isPresented: Binding(get: { sharePDF != nil }, set: { if !$0 { sharePDF = nil } })) {
            if let sharePDF {
                ShareSheet(items: [sharePDF])
            }
        }
        .confirmationDialog(
            "筆記本選項",
            isPresented: Binding(get: { actionBook != nil }, set: { if !$0 { actionBook = nil } }),
            titleVisibility: .visible,
            presenting: actionBook
        ) { book in
            Button("分享 PDF") { exportShare(book) }
            Button("重新命名") {
                bookToRename = book
                renameTitle = book.title
                showRename = true
            }
            Button("移動到資料夾") {
                bookToMove = book
                showMoveFolder = true
            }
            Button("移到回收桶", role: .destructive) {
                bookToTrash = book
                showTrashConfirm = true
            }
            Button("取消", role: .cancel) {}
        } message: { book in
            Text(book.title)
        }
    }

    private var folderChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                chip("全部", active: folderFilterId == "ALL") { folderFilterId = "ALL" }
                chip("未分類", active: folderFilterId == nil) { folderFilterId = nil }
                ForEach(folders) { folder in
                    chip(folder.name, active: folderFilterId == folder.id) { folderFilterId = folder.id }
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
        }
    }

    private func chip(_ title: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(active ? NotebookTheme.header.opacity(0.2) : Color(.secondarySystemGroupedBackground))
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private func bookButton(_ book: Notebook) -> some View {
        Button {
            path.append(book.id)
        } label: {
            notebookCard(book)
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button("分享 PDF", systemImage: "square.and.arrow.up") { exportShare(book) }
            Button("重新命名", systemImage: "pencil") {
                bookToRename = book
                renameTitle = book.title
                showRename = true
            }
            Button("移動到資料夾", systemImage: "folder") {
                bookToMove = book
                showMoveFolder = true
            }
            Button("移到回收桶", systemImage: "trash", role: .destructive) {
                bookToTrash = book
                showTrashConfirm = true
            }
        }
        .onLongPressGesture(minimumDuration: 0.45) {
            actionBook = book
        }
    }

    private func trashCard(_ book: Notebook) -> some View {
        notebookCard(book)
            .contextMenu {
                Button("還原", systemImage: "arrow.uturn.backward") { restore(book) }
                Button("永久刪除", systemImage: "trash", role: .destructive) {
                    context.delete(book)
                    try? context.save()
                }
            }
    }

    private var moveFolderSheet: some View {
        NavigationStack {
            List {
                Button("未分類") {
                    bookToMove?.folderId = nil
                    try? context.save()
                    showMoveFolder = false
                }
                ForEach(folders) { folder in
                    Button(folder.name) {
                        bookToMove?.folderId = folder.id
                        try? context.save()
                        showMoveFolder = false
                    }
                }
            }
            .navigationTitle("移動到資料夾")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("關閉") { showMoveFolder = false }
                }
            }
        }
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label(scope == .trash ? "回收桶是空的" : "還沒有筆記本", systemImage: scope == .trash ? "trash" : "book.closed.fill")
        } description: {
            Text(scope == .trash ? "刪除的筆記會暫存在這裡。" : "用 Apple Pencil 書寫，或從 PDF 一鍵建立")
        } actions: {
            if scope != .trash {
                Button("新筆記本") { createBook() }
                    .buttonStyle(.borderedProminent)
                Button("從 PDF 建立") { importPDF = true }
            }
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
            if let deletedAt = book.deletedAt {
                Text("刪除於 \(deletedAt.formatted(date: .abbreviated, time: .omitted))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Text("\(book.pages.count) 頁 · \(book.updatedAt.formatted(date: .abbreviated, time: .omitted))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .liquidGlassBar(cornerRadius: 14)
    }

    private func createBook() {
        let folderId = folderFilterId == "ALL" ? nil : folderFilterId
        let book = Notebook.makeDefault(in: context)
        book.folderId = folderId
        try? context.save()
    }

    private func createFolder() {
        let name = newFolderName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        let sort = (folders.map(\.sortIndex).max() ?? -1) + 1
        context.insert(NotebookFolder(name: name, sortIndex: sort))
        try? context.save()
        newFolderName = ""
    }

    private func moveToTrash(_ book: Notebook) {
        book.deletedAt = .now
        try? context.save()
    }

    private func restore(_ book: Notebook) {
        book.deletedAt = nil
        try? context.save()
    }

    private func saveRename() {
        let title = renameTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty, let book = bookToRename else { return }
        book.title = title
        book.updatedAt = .now
        try? context.save()
    }

    private func exportShare(_ book: Notebook) {
        guard let data = NotebookPDFExport.pdfData(for: book) else { return }
        let safeTitle = book.title.replacingOccurrences(of: "/", with: "-")
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(safeTitle).pdf")
        try? data.write(to: url)
        sharePDF = url
    }

    private func handleImport(_ result: Result<[URL], Error>) {
        switch result {
        case let .success(urls):
            guard let url = urls.first else { return }
            do {
                let book = try Notebook.makeFromPDF(at: url, in: context)
                book.folderId = folderFilterId == "ALL" ? nil : folderFilterId
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

private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}