import Foundation
import SwiftUI

@Observable
final class NotebookInkPresetsStore {
    static let shared = NotebookInkPresetsStore()

    private static let defaultHexes = [
        "#1c1c1e", "#c41e1e", "#1b4fd8", "#17803d",
        "#6b3fa0", "#f4a100", "#e91e8c", "#0e8a8a", "#ffffff",
    ]

    private let key = "nb-ink-swatches-v1"
    private(set) var swatchHexes: [String]

    init() {
        if let data = UserDefaults.standard.data(forKey: key),
           let decoded = try? JSONDecoder().decode([String].self, from: data),
           decoded.count == Self.defaultHexes.count {
            swatchHexes = decoded
        } else {
            swatchHexes = Self.defaultHexes
        }
    }

    func color(at index: Int) -> Color {
        Color(hex: swatchHexes[index])
    }

    func setColor(_ color: Color, at index: Int) {
        guard swatchHexes.indices.contains(index) else { return }
        swatchHexes[index] = color.hexString
        if let data = try? JSONEncoder().encode(swatchHexes) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}