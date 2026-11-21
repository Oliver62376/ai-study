import PencilKit
import SwiftData
import SwiftUI
import UIKit

struct NotebookEditorView: View {
    @Bindable var notebook: Notebook
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @State private var toolbar = NotebookToolbarState()
    @State private var activePageId: String?
    @State private var toolPicker = PKToolPicker()
    @State private var activeCanvas: PKCanvasView?
    @State private var showPageManager = false
    @State private var sharePDF: URL?
    @State private var toastMessage = ""

    private var sortedPages: [NotePage] {
        notebook.pages.sorted { $0.sortIndex < $1.sortIndex }
    }

    var body: some View {
        VStack(spacing: 0) {
            headerBar
            NotebookInkToolbar(
                state: toolbar,
                onUndo: { activeCanvas?.undoManager?.undo() },
                onRedo: { activeCanvas?.undoManager?.redo() },
                onUnimplemented: { toastMessage = "\($0)（下一版）" }
            )
            .padding(.vertical, 8)
            .background(NotebookTheme.canvasBackdrop)

            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(sortedPages, id: \.id) { page in
                        NotebookPageSheetView(
                            page: page,
                            inkTool: toolbar.pkTool(),
                            isActive: activePageId == page.id,
                            onSelect: { activePageId = page.id },
                            onFocusCanvas: { canvas in
                                activeCanvas = canvas
                                attachToolPicker(to: canvas)
                            }
                        )
                    }
                }
                .padding(.bottom, 40)
            }
            .background(NotebookTheme.canvasBackdrop)
        }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showPageManager) {
            PageManagerSheet(notebook: notebook)
        }
        .sheet(isPresented: Binding(get: { sharePDF != nil }, set: { if !$0 { sharePDF = nil } })) {
            if let sharePDF {
                ShareSheet(items: [sharePDF])
            }
        }
        .alert("提示", isPresented: Binding(get: { !toastMessage.isEmpty }, set: { if !$0 { toastMessage = "" } })) {
            Button("好", role: .cancel) {}
        } message: {
            Text(toastMessage)
        }
        .onAppear {
            if activePageId == nil {
                activePageId = sortedPages.first?.id
            }
        }
        .onChange(of: toolbar.inkWidth) { _, _ in activeCanvas?.tool = toolbar.pkTool() }
        .onChange(of: toolbar.eraserWidth) { _, _ in activeCanvas?.tool = toolbar.pkTool() }
        .onChange(of: toolbar.inkColor) { _, _ in activeCanvas?.tool = toolbar.pkTool() }
        .onChange(of: toolbar.inkKind) { _, _ in activeCanvas?.tool = toolbar.pkTool() }
        .onChange(of: toolbar.eraserStyle) { _, _ in activeCanvas?.tool = toolbar.pkTool() }
    }

    private var headerBar: some View {
        HStack(spacing: 14) {
            Button {
                notebook.updatedAt = .now
                try? context.save()
                dismiss()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.headline.weight(.semibold))
            }

            TextField("筆記本名稱", text: $notebook.title)
                .font(.headline)
                .textFieldStyle(.plain)

            Spacer(minLength: 8)

            Button { showPageManager = true } label: {
                Image(systemName: NotebookIcons.pages.systemName)
                    .font(.body.weight(.semibold))
            }
            .accessibilityLabel(NotebookIcons.pages.label)

            Button { prepareExport() } label: {
                Image(systemName: NotebookIcons.share.systemName)
                    .font(.body.weight(.semibold))
            }
            .accessibilityLabel(NotebookIcons.share.label)

            Button { addPage() } label: {
                Image(systemName: "plus.rectangle.on.rectangle")
                    .font(.body.weight(.semibold))
            }
            .accessibilityLabel("新增頁")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(NotebookTheme.header)
        .foregroundStyle(.white)
    }

    private func attachToolPicker(to canvas: PKCanvasView) {
        canvas.tool = toolbar.pkTool()
        toolPicker.setVisible(true, forFirstResponder: canvas)
        toolPicker.addObserver(canvas)
        canvas.becomeFirstResponder()
    }

    private func addPage() {
        let index = (notebook.pages.map(\.sortIndex).max() ?? -1) + 1
        let page = NotePage(title: "第 \(index + 1) 頁", sortIndex: index)
        page.notebook = notebook
        notebook.pages.append(page)
        notebook.updatedAt = .now
        activePageId = page.id
        try? context.save()
    }

    private func prepareExport() {
        guard let data = NotebookPDFExport.pdfData(for: notebook) else { return }
        let safeTitle = notebook.title.replacingOccurrences(of: "/", with: "-")
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(safeTitle).pdf")
        try? data.write(to: url)
        sharePDF = url
    }
}

private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}