import SwiftUI

// MARK: - 液態玻璃
//
// • iPadOS 17–25：Material 模擬 Web 玻璃
// • iPadOS 26+（含你說的 iPadOS 27 世代）：執行時啟用系統 `glassEffect`
// • CI 已改用 macos-26 + Xcode 26 SDK 編譯

enum LiquidGlassTokens {
    static let fill = Color.white.opacity(0.58)
    static let stroke = Color.white.opacity(0.72)
    static let innerHighlight = Color.white.opacity(0.8)
    static let shadow = Color.black.opacity(0.08)
}

private struct SimulatedGlassBackground: View {
    var cornerRadius: CGFloat
    var elevated: Bool

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(.ultraThinMaterial)
            .background {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(LiquidGlassTokens.fill)
            }
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(LiquidGlassTokens.stroke, lineWidth: 0.5)
            }
            .overlay(alignment: .top) {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(LiquidGlassTokens.innerHighlight, lineWidth: 1)
                    .blur(radius: 0.3)
                    .mask(alignment: .top) {
                        LinearGradient(
                            colors: [.white, .clear],
                            startPoint: .top,
                            endPoint: .center
                        )
                    }
            }
            .shadow(
                color: LiquidGlassTokens.shadow,
                radius: elevated ? 36 : 18,
                y: elevated ? 10 : 6
            )
    }
}

private struct AdaptiveGlassBackground: View {
    var cornerRadius: CGFloat
    var elevated: Bool

    var body: some View {
        if #available(iOS 26.0, *) {
            let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            shape
                .fill(.clear)
                .glassEffect(.regular, in: shape)
        } else {
            SimulatedGlassBackground(cornerRadius: cornerRadius, elevated: elevated)
        }
    }
}

extension View {
    /// 工具列、小按鈕（對齊 Web `.glass-bar`）
    func liquidGlassBar(cornerRadius: CGFloat = 14) -> some View {
        background {
            AdaptiveGlassBackground(cornerRadius: cornerRadius, elevated: false)
        }
    }

    /// 首頁輸入框等大區塊（對齊 Web `.glass-composer`）
    func liquidGlassComposer(cornerRadius: CGFloat = 26) -> some View {
        background {
            AdaptiveGlassBackground(cornerRadius: cornerRadius, elevated: true)
        }
    }
}