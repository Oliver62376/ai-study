import SwiftUI

/// Goodnotes 風格：圖形二級浮動列（填色、形狀、線寬、顏色）
struct ShapeToolFloatingBar: View {
    @Bindable var state: NotebookToolbarState

    var body: some View {
        HStack(spacing: 10) {
            Toggle(isOn: $state.shapeFilled) {
                Image(systemName: "circle.lefthalf.filled")
            }
            .toggleStyle(.button)

            Divider().frame(height: 28)

            ForEach(ShapeKind.allCases) { kind in
                Button {
                    state.shapeKind = kind
                } label: {
                    Image(systemName: kind.systemImage)
                        .frame(width: 34, height: 34)
                        .background(state.shapeKind == kind ? NotebookTheme.header.opacity(0.2) : .clear)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
            }

            Divider().frame(height: 28)

            ToolWidthPopover(
                title: "線條",
                width: $state.shapeStroke,
                range: 1...16,
                previewColor: state.inkColor
            )
            .frame(width: 120)

            Circle()
                .fill(state.inkColor)
                .frame(width: 28, height: 28)
                .overlay { Circle().stroke(.secondary.opacity(0.4), lineWidth: 1) }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .liquidGlassBar(cornerRadius: 16)
    }
}