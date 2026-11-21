import PencilKit
import PhotosUI
import SwiftData
import SwiftUI
import UIKit
import UniformTypeIdentifiers

struct NotebookEditorView: View {
    @Bindable var notebook: Notebook
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @State private var toolbar = NotebookToolbarState()
    @State private var appearance = ToolbarAppearanceStore.shared
    @State private var activePageId: String?
    @State private var toolPicker = PKToolPicker()
    @State private var activeCanvas: PKCanvasView?
    @State private var showPageManager = false
    @State private var showToolbarAppearance = false
    @State private var showSettings = false
    @State private var showNotebookAI = false
    @State private var sharePDF: URL?
    @State private var toastMessage = ""
    @State private var photoItem: PhotosPickerItem?
    @State private var showTextSheet = false
    @State private var textDraft = ""
    @State private var textPlacement: CGPoint = .zero
    @State private var importMaterial = false
    @State private var showPhotoPicker = false

    private var sortedPages: [NotePage] {
        notebook.pages.sorted { $0.sortIndex < $1.sortIndex }
    }

    private var activePage: NotePage? {
        guard let activePageId else { return sortedPages.first }
        return sortedPages.first { $0.id == activePageId }
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            VStack(spacing: 0) {
                headerBar
                NotebookInkToolbar(
                    state: toolbar,
                    appearance: appearance,
                    onUndo: { activeCanvas?.undoManager?.undo() },
                    onRedo: { activeCanvas?.undoManager?.redo() },
                    onPickImage: { showPhotoPicker = true },
                    onAttachMaterial: { importMaterial = true },
                    onToolbarDoubleTap: { showToolbarAppearance = true }
                )
                .padding(.vertical, 8)
                .background(NotebookTheme.canvasBackdrop)

                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(sortedPages, id: \.id) { page in
                            NotebookPageSheetView(
                                page: page,
                                inkTool: toolbar.pkTool(),
                                toolKind: toolbar.inkKind,
                                shapeKind: toolbar.shapeKind,
                                shapeColor: toolbar.inkColor,
                                shapeStroke: toolbar.shapeStroke,
                                allowsCanvasDrawing: toolbar.allowsInkOnCanvas,
                                isActive: activePageId == page.id,
                                onSelect: {
                                    activePageId = page.id
                                    toolbar.showPenSizePanel = false
                                    toolbar.showEraserSizePanel = false
                                    toolbar.showShapePanel = false
                                },
                                onFocusCanvas: { canvas in
                                    activeCanvas = canvas
                                    attachToolPicker(to: canvas)
                                },
                                onTapForText: { point in
                                    activePageId = page.id
                                    textPlacement = point
                                    textDraft = ""
                                    showTextSheet = true
                                }
                            )
                        }
                    }
                    .padding(.bottom, 40)
                }
                .background(NotebookTheme.canvasBackdrop)
                .onTapGesture {
                    toolbar.showPenSizePanel = false
                    toolbar.showEraserSizePanel = false
                    toolbar.showShapePanel = false
                }
            }

            InkToolFloatingPanels(state: toolbar)
                .padding(.top, 112)

            if showNotebookAI, let page = activePage {
                NotebookAIPanel(
                    notebookId: notebook.id,
                    pageTitle: page.title,
                    pageImageJPEG: page.thumbnailJPEGData,
                    onNeedSettings: { showSettings = true },
                    onClose: { showNotebookAI = false }
                )
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .photosPicker(isPresented: $showPhotoPicker, selection: $photoItem, matching: .images)
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task { await loadPhoto(item) }
        }
        .sheet(isPresented: $showPageManager) {
            PageManagerSheet(notebook: notebook)
        }
        .sheet(isPresented: $showToolbarAppearance) {
            ToolbarAppearanceSheet(appearance: appearance)
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
        .sheet(isPresented: $showTextSheet) {
            TextAnnotationSheet(text: $textDraft) {
                addTextAnnotation()
            }
        }
        .sheet(isPresented: Binding(get: { sharePDF != nil }, set: { if !$0 { sharePDF = nil } })) {
            if let sharePDF {
                ShareSheet(items: [sharePDF])
            }
        }
        .fileImporter(
            isPresented: $importMaterial,
            allowedContentTypes: [.plainText, .utf8PlainText, .pdf, .text],
            allowsMultipleSelection: false
        ) { result in
            attachMaterial(result)
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
        .onChange(of: toolbar.inkWidth) { _, _ in syncTool() }
        .onChange(of: toolbar.eraserWidth) { _, _ in syncTool() }
        .onChange(of: toolbar.inkColor) { _, _ in syncTool() }
        .onChange(of: toolbar.inkKind) { _, _ in syncTool() }
        .onChange(of: toolbar.eraserStyle) { _, _ in syncTool() }
        .onChange(of: toolbar.shapeKind) { _, _ in syncTool() }
        .onChange(of: toolbar.shapeStroke) { _, _ in syncTool() }
    }

    private func syncTool() {
        activeCanvas?.tool = toolbar.pkTool()
        activeCanvas?.isUserInteractionEnabled = toolbar.allowsInkOnCanvas
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

            Button {
                showNotebookAI.toggle()
            } label: {
                Image(systemName: "sparkles")
                    .font(.body.weight(.semibold))
            }
            .accessibilityLabel("筆記 AI")

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
        toolPicker.setVisible(false, forFirstResponder: canvas)
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

    private func loadPhoto(_ item: PhotosPickerItem) async {
        guard let page = activePage,
              let data = try? await item.loadTransferable(type: Data.self),
              let image = UIImage(data: data),
              let jpeg = image.jpegData(compressionQuality: 0.85) else { return }
        let sheetWidth = min(UIScreen.main.bounds.width - 24, 760)
        let w: Double = min(280, Double(sheetWidth) * 0.45)
        let h = Double(image.size.height / image.size.width) * w
        var overlays = page.overlays
        overlays.images.append(
            ImageSticker(
                x: Double(sheetWidth) * 0.25,
                y: 80,
                width: w,
                height: h,
                jpegBase64: jpeg.base64EncodedString()
            )
        )
        page.overlays = overlays
        page.updatedAt = .now
        try? context.save()
        photoItem = nil
        showPhotoPicker = false
    }

    private func addTextAnnotation() {
        guard let page = activePage else { return }
        let text = textDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        var overlays = page.overlays
        overlays.texts.append(
            TextAnnotation(
                x: Double(textPlacement.x),
                y: Double(textPlacement.y),
                width: 220,
                height: 120,
                text: text,
                colorHex: toolbar.inkColor.hexString,
                fontSize: 18
            )
        )
        page.overlays = overlays
        page.updatedAt = .now
        try? context.save()
    }

    private func attachMaterial(_ result: Result<[URL], Error>) {
        guard let page = activePage else { return }
        switch result {
        case let .success(urls):
            guard let url = urls.first else { return }
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            let name = url.lastPathComponent
            var body = ""
            if url.pathExtension.lowercased() == "pdf" {
                body = "（已附加 PDF 教材：\(name)）"
            } else {
                body = (try? String(contentsOf: url, encoding: .utf8)) ?? ""
                if body.count > 1200 { body = String(body.prefix(1200)) + "…" }
            }
            var overlays = page.overlays
            overlays.texts.append(
                TextAnnotation(
                    x: 24,
                    y: 24,
                    width: min(520, UIScreen.main.bounds.width - 80),
                    height: 160,
                    text: "【教材】\(name)\n\(body)",
                    colorHex: "#333333",
                    fontSize: 14
                )
            )
            page.overlays = overlays
            page.updatedAt = .now
            try? context.save()
            toastMessage = "已附加教材到本頁"
        case let .failure(error):
            toastMessage = error.localizedDescription
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