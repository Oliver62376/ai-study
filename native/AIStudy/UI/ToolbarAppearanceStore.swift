import SwiftUI
import UIKit

@Observable
final class ToolbarAppearanceStore {
    static let shared = ToolbarAppearanceStore()

    var toolbarBackground: Color {
        didSet { persist() }
    }

    private let key = "nb-toolbar-bg-hex"

    private init() {
        if let hex = UserDefaults.standard.string(forKey: key), !hex.isEmpty {
            toolbarBackground = Color(hex: hex)
        } else {
            toolbarBackground = Color.white.opacity(0.97)
        }
    }

    func persist() {
        UserDefaults.standard.set(toolbarBackground.hexString, forKey: key)
    }
}

extension Color {
    var hexString: String {
        let ui = UIColor(self)
        var r: CGFloat = 0
        var g: CGFloat = 0
        var b: CGFloat = 0
        var a: CGFloat = 0
        ui.getRed(&r, green: &g, blue: &b, alpha: &a)
        return String(format: "#%02X%02X%02X", Int(r * 255), Int(g * 255), Int(b * 255))
    }
}