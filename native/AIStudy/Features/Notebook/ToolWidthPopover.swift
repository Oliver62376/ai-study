import SwiftUI

struct ToolWidthPopover: View {
    let title: String
    @Binding var width: CGFloat
    let range: ClosedRange<CGFloat>
    let previewColor: Color
    var isEraser: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.subheadline.weight(.semibold))
            HStack {
                Spacer()
                ZStack {
                    Circle()
                        .fill(Color.gray.opacity(0.12))
                        .frame(width: 72, height: 72)
                    if isEraser {
                        Circle()
                            .fill(Color.white)
                            .frame(width: width * 2.2, height: width * 2.2)
                            .shadow(color: .black.opacity(0.1), radius: 1)
                    } else {
                        Circle()
                            .fill(previewColor)
                            .frame(width: max(4, width * 1.8), height: max(4, width * 1.8))
                    }
                }
                Spacer()
            }
            Slider(value: $width, in: range, step: 1)
            Text("\(Int(width)) pt")
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
        }
        .padding(14)
        .frame(width: 220)
    }
}