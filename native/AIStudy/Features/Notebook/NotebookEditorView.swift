import PencilKit
import SwiftData
import SwiftUI
import UIKit

/// 全螢幕筆記編輯：頂欄與工具列固定，僅頁面區可捲動（Goodnotes 式）。
struct NotebookEditorView: View {
    @Bindable var notebook: Notebook
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @State private var activePageId: String?
    @State private var inkColor = Color.black
    @State private var inkWidth: CGFloat = 4
    @State private var eraserOn = false
    @State private var toolPicker = PKToolPicker()
    @State private var showPageManager = false
    @State private var sharePDF: URL?

    private var sortedPages: [NotePage] {
        notebook.pages.sorted { $0.sortIndex < $1.sortIndex }
    }

    private var inkTool: PKTool {
        NotebookInkToolbar.pkTool(color: inkColor, width: inkWidth, eraser: eraserOn)
    }

    var body: some View {
        VStack(spacing: 0) {
            headerBar
            NotebookInkToolbar(inkColor: $inkColor, inkWidth: $inkWidth, eraserOn: $eraserOn)
                .padding(.horizontal, 8)
                .padding(.vertical, 8)
                .background(NotebookTheme.canvasBackdrop)

            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(sortedPages, id: \.id) { page in
                        NotebookPageSheetView(
                            page: page,
                            inkTool: inkTool,
                            isActive: activePageId == page.id,
                            onSelect: { activePageId = page.id },
                            onFocusCanvas: { attachToolPicker(to: $0) }
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
        .onAppear {
            if activePageId == nil {
                activePageId = sortedPages.first?.id
            }
        }
    }

    private var headerBar: some View {
        HStack(spacing: 12) {
            Button {
                notebook.updatedAt = .now
                try? context.save()
                dismiss()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.headline.weight(.semibold))
            }
            .buttonStyle(.plain)

            TextField("筆記本名稱", text: $notebook.title)
                .font(.headline)
                .textFieldStyle(.plain)
                .foregroundStyle(.white)

            Spacer(minLength: 8)

            Button("頁面") { showPageManager = true }
            Button("PDF") { prepareExport() }
            Button {
                addPage()
            } label: {
                Image(systemName: "plus.square.on.square")
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(NotebookTheme.header)
        .foregroundStyle(.white)
    }

    private func attachToolPicker(to canvas: PKCanvasView) {
        canvas.tool = inkTool
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