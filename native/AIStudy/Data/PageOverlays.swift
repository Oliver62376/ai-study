import Foundation

enum TextFontDesign: String, Codable, CaseIterable {
    case system, rounded, serif
}

struct TextAnnotation: Identifiable, Codable, Hashable {
    var id: UUID = UUID()
    var x: Double
    var y: Double
    var width: Double
    var height: Double
    var text: String
    var colorHex: String
    var fontSize: Double
    var isPlaceholder: Bool = false
    var fontDesign: TextFontDesign = .system
    var isBold: Bool = false
    var isItalic: Bool = false
    var backgroundHex: String?
}

struct ImageSticker: Identifiable, Codable, Hashable {
    var id: UUID = UUID()
    var x: Double
    var y: Double
    var width: Double
    var height: Double
    var rotationDegrees: Double = 0
    var jpegBase64: String
}

enum ShapeKind: String, Codable, CaseIterable, Identifiable {
    case line, rect, ellipse, triangle, diamond, capsule

    var id: String { rawValue }

    var label: String {
        switch self {
        case .line: "直線"
        case .rect: "矩形"
        case .ellipse: "圓形"
        case .triangle: "三角"
        case .diamond: "菱形"
        case .capsule: "膠囊"
        }
    }

    var systemImage: String {
        switch self {
        case .line: "line.diagonal"
        case .rect: "square"
        case .ellipse: "circle"
        case .triangle: "triangle"
        case .diamond: "diamond"
        case .capsule: "capsule.landscape"
        }
    }
}

struct VectorShape: Identifiable, Codable, Hashable {
    var id: UUID = UUID()
    var kind: ShapeKind
    var colorHex: String
    var strokeWidth: Double
    var filled: Bool = false
    var x1, y1, x2, y2: Double
}

struct PageOverlays: Codable, Hashable {
    var texts: [TextAnnotation] = []
    var images: [ImageSticker] = []
    var shapes: [VectorShape] = []

    static func decode(from data: Data?) -> PageOverlays {
        guard let data, let decoded = try? JSONDecoder().decode(PageOverlays.self, from: data) else {
            return PageOverlays()
        }
        return decoded
    }

    func encode() -> Data? {
        try? JSONEncoder().encode(self)
    }
}