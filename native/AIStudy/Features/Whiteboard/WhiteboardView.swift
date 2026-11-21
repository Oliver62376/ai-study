import PencilKit
import SwiftUI

struct WhiteboardView: View {
    @State private var drawing = PKDrawing()
    @State private var tool = NotebookToolbarState()
    @State private var canvas: PKCanvasView?

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("白板")
                    .font(.title2.bold())
                Spacer()
                Button("清除") { drawing = PKDrawing() }
            }
            .padding()
            .liquidGlassBar(cornerRadius: 0)

            NotebookInkToolbar(
                state: tool,
                appearance: ToolbarAppearanceStore.shared,
                onUndo: { canvas?.undoManager?.undo() },
                onRedo: { canvas?.undoManager?.redo() },
                onPickImage: {},
                onAttachMaterial: {},
                onToolbarDoubleTap: {}
            )
            .padding(.vertical, 8)

            PencilCanvasView(
                drawing: $drawing,
                tool: tool.pkTool(),
                inkInteractionEnabled: tool.allowsInkOnCanvas,
                onCanvasReady: { canvas = $0 }
            )
            .background(Color(.systemBackground))
        }
        .navigationTitle("白板")
        .navigationBarTitleDisplayMode(.inline)
    }
}