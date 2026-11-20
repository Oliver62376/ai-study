import PencilKit
import SwiftUI

struct PencilCanvasView: UIViewRepresentable {
    @Binding var drawing: PKDrawing
    var tool: PKTool?
    var onCanvasReady: ((PKCanvasView) -> Void)? = nil

    func makeUIView(context: Context) -> PKCanvasView {
        let view = PKCanvasView()
        view.drawingPolicy = .pencilOnly
        view.backgroundColor = .clear
        view.isOpaque = false
        view.tool = tool ?? PKInkingTool(.pen, color: .black, width: 3)
        view.delegate = context.coordinator
        DispatchQueue.main.async {
            onCanvasReady?(view)
        }
        return view
    }

    func updateUIView(_ uiView: PKCanvasView, context: Context) {
        if uiView.drawing.dataRepresentation() != drawing.dataRepresentation() {
            uiView.drawing = drawing
        }
        if let tool {
            uiView.tool = tool
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(drawing: $drawing)
    }

    final class Coordinator: NSObject, PKCanvasViewDelegate {
        @Binding var drawing: PKDrawing

        init(drawing: Binding<PKDrawing>) {
            _drawing = drawing
        }

        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            drawing = canvasView.drawing
        }
    }
}