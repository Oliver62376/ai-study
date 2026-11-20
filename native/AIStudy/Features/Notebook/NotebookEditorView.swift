import PencilKit
import SwiftUI
import UIKit

struct NotebookEditorView: View {
    @Bindable var notebook: Notebook
    @Environment(\.modelContext) private var context
    @State private var drawing = PKDrawing()
    @State private var toolPicker = PKToolPicker()
    @State private var canvasView: PKCanvasView?

    private var sortedPages: [NotePage] {
        notebook.pages.sorted { $0.sortIndex < $1.sortIndex }
    }

    var body: some View {
        VStack(spacing: 0) {
            if let page = sortedPages.first {
                Text(page.title)
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(Color(.secondarySystemGroupedBackground))

                ZStack {
                    Color.white
                    if let data = page.backgroundImageData, let image = UIImage(data: data) {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFit()
                    }
                    PencilCanvasView(drawing: $drawing) { canvas in
                        canvasView = canvas
                        attachToolPicker(to: canvas)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .onAppear {
                    restoreDrawing(for: page)
                }
                .onChange(of: drawing) { _, newValue in
                    page.pkDrawingData = newValue.dataRepresentation()
                    page.updatedAt = .now
                    notebook.updatedAt = .now
                    try? context.save()
                }
            } else {
                ContentUnavailableView("沒有頁面", systemImage: "doc")
            }
        }
        .navigationTitle(notebook.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button("新增頁") { addPage() }
                Button("PDF") { }
                    .disabled(true)
            }
        }
    }

    private func restoreDrawing(for page: NotePage) {
        if let data = page.pkDrawingData,
           let restored = try? PKDrawing(data: data) {
            drawing = restored
        } else {
            drawing = PKDrawing()
        }
    }

    private func attachToolPicker(to canvas: PKCanvasView) {
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
        try? context.save()
        restoreDrawing(for: page)
    }
}