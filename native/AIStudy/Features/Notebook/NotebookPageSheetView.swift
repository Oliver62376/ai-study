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
    @Binding var editingTextId: UUID?
    var onSelect: () -> Void
    var onFocusCanvas: (PKCanvasView) -> Void
    var onTapForText: (CGPoint) -> Void

    @State private var drawing = PKDrawing()
    @State private var canvasView: PKCanvasView?
    @State private var draftShapeStart: CGPoint?
    @State private var draftShapeEnd: CGPoint?

    private var sheetWidth: CGFloat {
        min(UIScreen.main.bounds.width - 24, 760)
    }

    private var sheetHeight: CGFloat {
        sheetWidth * 1060 / 820
    }

    private var overlayHitTesting: Bool {
        switch toolKind {
        case .shape, .text:
            isActive
        default:
            selectedImageId != nil || editingTextId != nil
        }
    }

    var body: some View {
        VStack(spacing: 0) {
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
                    onCanvasReady: { canvas in
                        canvasView = canvas
                        if isActive {
                            onFocusCanvas(canvas)
                        }
                    }
                )
                PageOverlayView(
                    page: page,
                    sheetSize: CGSize(width: sheetWidth, height: sheetHeight),
                    shapeKind: shapeKind,
                    shapeColor: shapeColor,
                    shapeStroke: shapeStroke,
                    shapeFilled: shapeFilled,
                    toolKind: toolKind,
                    draftShapeStart: $draftShapeStart,
                    draftShapeEnd: $draftShapeEnd,
                    selectedImageId: $selectedImageId,
                    editingTextId: $editingTextId,
                    onTapForText: onTapForText,
                    onPersist: { persistOverlayOnly() }
                )
                .allowsHitTesting(overlayHitTesting)
            }
            .frame(width: sheetWidth, height: sheetHeight)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .overlay {
                RoundedRectangle(cornerRadius: 6)
                    .stroke(isActive ? Color.white.opacity(0.9) : Color.clear, lineWidth: 2)
            }
            .shadow(color: .black.opacity(0.18), radius: 16, y: 8)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 14)
        .onTapGesture { onSelect() }
        .onAppear { loadDrawing() }
        .onChange(of: drawing) { _, value in persist(drawing: value) }
        .onChange(of: isActive) { _, active in
            guard active, let canvasView else { return }
            onFocusCanvas(canvasView)
        }
        .onChange(of: toolKind) { _, new in
            draftShapeStart = nil
            draftShapeEnd = nil
            if new == .pen || new == .fountain || new == .highlighter || new == .eraser || new == .lasso {
                loadDrawing()
            }
        }
        .onChange(of: inkInteractionEnabled) { _, enabled in
            if enabled {
                loadDrawing()
            }
        }
    }

    private func loadDrawing() {
        if let data = page.pkDrawingData, let restored = try? PKDrawing(data: data) {
            drawing = restored
            canvasView?.drawing = restored
        } else {
            drawing = PKDrawing()
        }
    }

    private func persist(drawing: PKDrawing) {
        page.pkDrawingData = drawing.dataRepresentation()
        page.updatedAt = .now
        page.notebook?.updatedAt = .now
        PageThumbnailRenderer.refreshThumbnail(page: page)
        try? context.save()
    }

    private func persistOverlayOnly() {
        page.updatedAt = .now
        page.notebook?.updatedAt = .now
        PageThumbnailRenderer.refreshThumbnail(page: page)
        try? context.save()
    }
}