import SwiftUI

// MARK: - 液態玻璃
//
// • 現在（iPadOS 17–18）：用 Material 模擬 Web 的 `.glass-composer` / `.glass-bar`
// • 真·系統 Liquid Glass：需 iOS 26+ 執行，且專案以含 `glassEffect` 的 SDK 編譯（Xcode 26+）
//   目前 GitHub CI 仍為 Xcode 16 / iOS 18 SDK，故無法連結 `glassEffect()`。
//   CI 升級後只改此檔的 `glassBackground` 即可全 App 啟用。

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

extension View {
    /// 工具列、小按鈕（對齊 Web `.glass-bar`）
    func liquidGlassBar(cornerRadius: CGFloat = 14) -> some View {
        background {
            SimulatedGlassBackground(cornerRadius: cornerRadius, elevated: false)
        }
    }

    /// 首頁輸入框等大區塊（對齊 Web `.glass-composer`）
    func liquidGlassComposer(cornerRadius: CGFloat = 26) -> some View {
        background {
            SimulatedGlassBackground(cornerRadius: cornerRadius, elevated: true)
        }
    }
}