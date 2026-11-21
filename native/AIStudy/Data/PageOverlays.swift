import Foundation

struct TextAnnotation: Identifiable, Codable, Hashable {
    var id: UUID = UUID()
    var x: Double
    var y: Double
    var width: Double
    var height: Double
    var text: String
    var colorHex: String
    var fontSize: Double
}

struct ImageSticker: Identifiable, Codable, Hashable {
    var id: UUID = UUID()
    var x: Double
    var y: Double
    var width: Double
    var height: Double
    var jpegBase64: String
}

enum ShapeKind: String, Codable, CaseIterable {
    case line, rect, ellipse
}

struct VectorShape: Identifiable, Codable, Hashable {
    var id: UUID = UUID()
    var kind: ShapeKind
    var colorHex: String
    var strokeWidth: Double
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