import SwiftUI

/// 對齊 Web `.os-aurora`
struct HomeAuroraBackground: View {
    var body: some View {
        ZStack {
            Color(red: 245 / 255, green: 245 / 255, blue: 249 / 255)
            RadialGradient(
                colors: [Color(red: 147 / 255, green: 197 / 255, blue: 253 / 255).opacity(0.42), .clear],
                center: UnitPoint(x: 0.15, y: 0),
                startRadius: 0,
                endRadius: 480
            )
            RadialGradient(
                colors: [Color(red: 244 / 255, green: 114 / 255, blue: 182 / 255).opacity(0.26), .clear],
                center: UnitPoint(x: 0.88, y: 0.08),
                startRadius: 0,
                endRadius: 400
            )
            RadialGradient(
                colors: [Color(red: 167 / 255, green: 243 / 255, blue: 208 / 255).opacity(0.32), .clear],
                center: UnitPoint(x: 0.5, y: 1),
                startRadius: 0,
                endRadius: 380
            )
        }
        .ignoresSafeArea()
    }
}