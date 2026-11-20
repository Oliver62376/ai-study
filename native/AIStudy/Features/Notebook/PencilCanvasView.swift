import PencilKit
import SwiftUI

struct PencilCanvasView: UIViewRepresentable {
    @Binding var drawing: PKDrawing
    var onCanvasReady: ((PKCanvasView) -> Void)? = nil

    func makeUIView(context: Context) -> PKCanvasView {
        let view = PKCanvasView()
        view.drawingPolicy = .anyInput
        view.backgroundColor = .clear
        view.isOpaque = false
        view.tool = PKInkingTool(.pen, color: .black, width: 3)
        view.delegate = context.coordinator
        DispatchQueue.main.async {
            view.becomeFirstResponder()
            onCanvasReady?(view)
        }
        return view
    }

    func updateUIView(_ uiView: PKCanvasView, context: Context) {
        if uiView.drawing != drawing {
            uiView.drawing = drawing
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