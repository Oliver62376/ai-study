import PencilKit
import SwiftUI

struct NotebookInkToolbar: View {
    @Binding var inkColor: Color
    @Binding var inkWidth: CGFloat
    @Binding var eraserOn: Bool

    private let swatches: [Color] = [
        .black, .red, .blue, .green, .orange, .yellow, .pink, .cyan, .white,
    ]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                toolButton("筆", on: !eraserOn) { eraserOn = false }
                toolButton("橡皮", on: eraserOn) { eraserOn = true }

                Divider().frame(height: 28)

                ForEach(swatches.indices, id: \.self) { index in
                    let color = swatches[index]
                    Button {
                        inkColor = color
                        eraserOn = false
                    } label: {
                        Circle()
                            .fill(color)
                            .frame(width: 28, height: 28)
                            .overlay {
                                Circle().stroke(inkColor == color ? Color.accentColor : Color.gray.opacity(0.35), lineWidth: 2)
                            }
                    }
                    .buttonStyle(.plain)
                }

                HStack(spacing: 4) {
                    Text("粗細")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Stepper(value: $inkWidth, in: 1...24, step: 1) {
                        Text("\(Int(inkWidth))")
                            .font(.caption.monospacedDigit())
                            .frame(width: 24)
                    }
                    .labelsHidden()
                }
                .padding(.leading, 4)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
        }
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal, 12)
    }

    private func toolButton(_ title: String, on: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(on ? Color.accentColor : Color.gray.opacity(0.15))
                .foregroundStyle(on ? Color.white : Color.primary)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    static func pkTool(color: Color, width: CGFloat, eraser: Bool) -> PKTool {
        if eraser {
            return PKEraserTool(.bitmap)
        }
        let uiColor = UIColor(color)
        return PKInkingTool(.pen, color: uiColor, width: width)
    }
}