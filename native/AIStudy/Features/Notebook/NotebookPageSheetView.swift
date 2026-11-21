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
    var allowsCanvasDrawing: Bool
    var isActive: Bool
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
                    allowsDrawing: allowsCanvasDrawing && isActive,
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
                    toolKind: toolKind,
                    draftShapeStart: $draftShapeStart,
                    draftShapeEnd: $draftShapeEnd,
                    onTapForText: onTapForText
                )
                .allowsHitTesting(toolKind == .shape || toolKind == .text)
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
        .onChange(of: toolKind) { _, _ in
            draftShapeStart = nil
            draftShapeEnd = nil
        }
    }

    private func loadDrawing() {
        if let data = page.pkDrawingData, let restored = try? PKDrawing(data: data) {
            drawing = restored
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
}