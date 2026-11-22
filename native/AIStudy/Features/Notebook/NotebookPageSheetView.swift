import PencilKit
import SwiftData
import SwiftUI
import UIKit

struct NotebookPageSheetView: View {
    @Bindable var page: NotePage
    @Environment(\.modelContext) private var context
    var inkTool: PKTool
    var toolKind: InkToolKind
    var shapeKind: ShapeKind
    var shapeColor: Color
    var shapeStroke: CGFloat
    var shapeFilled: Bool
    var inkInteractionEnabled: Bool
    var isActive: Bool
    @Binding var selectedImageId: UUID?
    @Binding var selectedShapeIds: Set<UUID>
    @Binding var editingTextId: UUID?
    var onSelect: () -> Void
    var onFocusCanvas: (PKCanvasView) -> Void
    var onTapForText: (CGPoint) -> Void

    @State private var drawing = PKDrawing()
    @State private var canvasView: PKCanvasView?
    @State private var draftShapeStart: CGPoint?
    @State private var draftShapeEnd: CGPoint?
    @State private var persistTask: Task<Void, Never>?
    @State private var thumbnailTask: Task<Void, Never>?

    private var sheetWidth: CGFloat {
        min(UIScreen.main.bounds.width - 24, 760)
    }

    private var sheetHeight: CGFloat {
        sheetWidth * 1060 / 820
    }

    private var sheetSize: CGSize {
        CGSize(width: sheetWidth, height: sheetHeight)
    }

    private var pageContent: some View {
        ZStack {
            NotebookTheme.paper
            if let data = page.backgroundImageData, let image = UIImage(data: data) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            }
            PencilCanvasView(
                drawing: $drawing,
                tool: inkTool,
                inkInteractionEnabled: inkInteractionEnabled && isActive,
                holdSnapEnabled: isActive && toolKind != .lasso && toolKind != .eraser,
                onCanvasReady: { canvas in
                    canvasView = canvas
                    if isActive {
                        onFocusCanvas(canvas)
                    }
                }
            )
            PageOverlayView(
                page: page,
                sheetSize: sheetSize,
                shapeKind: shapeKind,
                shapeColor: shapeColor,
                shapeStroke: shapeStroke,
                shapeFilled: shapeFilled,
                toolKind: toolKind,
                draftShapeStart: $draftShapeStart,
                draftShapeEnd: $draftShapeEnd,
                selectedImageId: $selectedImageId,
                selectedShapeIds: $selectedShapeIds,
                editingTextId: $editingTextId,
                onTapForText: onTapForText,
                onPersist: { persistOverlayOnly() }
            )
            if toolKind == .lasso, isActive {
                ShapeLassoOverlay(shapes: page.overlays.shapes) { ids in
                    selectedShapeIds = Set(ids)
                    selectedImageId = nil
                } onClearSelection: {
                    selectedShapeIds = []
                }
                .frame(width: sheetWidth, height: sheetHeight)
            }
        }
        .frame(width: sheetWidth, height: sheetHeight)
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .overlay {
            RoundedRectangle(cornerRadius: 6)
                .stroke(isActive ? Color.white.opacity(0.9) : Color.clear, lineWidth: 2)
        }
        .shadow(color: .black.opacity(0.18), radius: 16, y: 8)
    }

    var body: some View {
        VStack(spacing: 0) {
            NotebookPageZoomView(contentSize: sheetSize, isActive: isActive, content: pageContent)
                .frame(width: sheetWidth, height: sheetHeight)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 14)
        .onTapGesture {
            selectedImageId = nil
            selectedShapeIds = []
            if toolKind != .text {
                editingTextId = nil
            }
            onSelect()
        }
        .onAppear { loadDrawing() }
        .onChange(of: page.id) { _, _ in loadDrawing() }
        .onDisappear {
            persistTask?.cancel()
            thumbnailTask?.cancel()
            flushPersist(drawing: drawing)
        }
        .onChange(of: drawing) { _, value in schedulePersist(drawing: value) }
        .onChange(of: isActive) { _, active in
            guard active, let canvasView else { return }
            onFocusCanvas(canvasView)
        }
        .onChange(of: toolKind) { _, new in
            draftShapeStart = nil
            draftShapeEnd = nil
            if new != .lasso { selectedShapeIds = [] }
        }
    }

    private func loadDrawing() {
        if let data = page.pkDrawingData, let restored = try? PKDrawing(data: data) {
            drawing = restored
            if let canvasView {
                let current = canvasView.drawing
                if current.strokes.count != restored.strokes.count
                    || current.dataRepresentation() != data {
                    canvasView.drawing = restored
                }
            }
        } else {
            drawing = PKDrawing()
            canvasView?.drawing = PKDrawing()
        }
    }

    private func schedulePersist(drawing: PKDrawing) {
        page.pkDrawingData = drawing.dataRepresentation()
        persistTask?.cancel()
        persistTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 450_000_000)
            guard !Task.isCancelled else { return }
            page.updatedAt = .now
            page.notebook?.updatedAt = .now
            try? context.save()
            scheduleThumbnail()
        }
    }

    private func flushPersist(drawing: PKDrawing) {
        page.pkDrawingData = drawing.dataRepresentation()
        page.updatedAt = .now
        page.notebook?.updatedAt = .now
        try? context.save()
        PageThumbnailRenderer.refreshThumbnail(page: page)
    }

    private func scheduleThumbnail() {
        thumbnailTask?.cancel()
        thumbnailTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 900_000_000)
            guard !Task.isCancelled else { return }
            PageThumbnailRenderer.refreshThumbnail(page: page)
        }
    }

    private func persistOverlayOnly() {
        page.updatedAt = .now
        page.notebook?.updatedAt = .now
        try? context.save()
        scheduleThumbnail()
    }
}