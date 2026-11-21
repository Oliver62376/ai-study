import PencilKit
import SwiftUI

struct PencilCanvasView: UIViewRepresentable {
    @Binding var drawing: PKDrawing
    var tool: PKTool?
    var inkInteractionEnabled: Bool = true
    var onCanvasReady: ((PKCanvasView) -> Void)? = nil

    func makeUIView(context: Context) -> PKCanvasView {
        let view = PKCanvasView()
        view.drawingPolicy = StylusPreferencesStore.preferences.pencilOnly ? .pencilOnly : .anyInput
        view.backgroundColor = .clear
        view.isOpaque = false
        view.tool = tool ?? PKInkingTool(.pen, color: .black, width: 3)
        view.isUserInteractionEnabled = inkInteractionEnabled
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
        uiView.drawingPolicy = StylusPreferencesStore.preferences.pencilOnly ? .pencilOnly : .anyInput
        if inkInteractionEnabled, let tool {
            uiView.tool = tool
        }
        uiView.isUserInteractionEnabled = inkInteractionEnabled
        uiView.alpha = 1
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