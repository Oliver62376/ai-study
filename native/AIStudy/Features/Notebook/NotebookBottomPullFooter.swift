import SwiftUI

struct NotebookBottomPullFooter: View {
    var pullProgress: CGFloat
    var triggered: Bool

    private var normalized: CGFloat {
        min(1, max(0, pullProgress / 72))
    }

    var body: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle()
                    .stroke(Color.secondary.opacity(0.35), lineWidth: 3)
                    .frame(width: 28, height: 28)
                Circle()
                    .trim(from: 0, to: normalized)
                    .stroke(Color.accentColor, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .frame(width: 28, height: 28)
                if triggered {
                    Image(systemName: "plus")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Color.accentColor)
                }
            }
            Text(triggered ? "放開以新增下一頁" : "繼續上拉以新增頁面")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .opacity(normalized > 0.05 || triggered ? 1 : 0.35)
        .animation(.easeOut(duration: 0.15), value: normalized)
    }
}