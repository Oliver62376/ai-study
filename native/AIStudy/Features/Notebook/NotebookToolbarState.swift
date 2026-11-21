import PencilKit
import SwiftUI

enum InkToolKind: String, CaseIterable {
    case pen
    case fountain
    case highlighter
    case eraser
    case shape
    case lasso
    case text
}

enum EraserStyle {
    case bitmap
    case stroke
}

@Observable
final class NotebookToolbarState {
    var inkKind: InkToolKind = .pen
    var inkColor: Color = .black
    var inkWidth: CGFloat = 4
    var eraserStyle: EraserStyle = .bitmap
    var eraserWidth: CGFloat = 12
    var showPenSizePanel = false
    var showEraserSizePanel = false
    var showShapePanel = false
    var shapeKind: ShapeKind = .rect
    var shapeStroke: CGFloat = 3
    var shapeFilled: Bool = false

    var allowsInkOnCanvas: Bool {
        switch inkKind {
        case .shape, .text: false
        default: true
        }
    }

    func pkTool() -> PKTool {
        switch inkKind {
        case .pen:
            return PKInkingTool(.pen, color: UIColor(inkColor), width: inkWidth)
        case .fountain:
            if #available(iOS 17.0, *) {
                return PKInkingTool(.fountainPen, color: UIColor(inkColor), width: inkWidth)
            }
            return PKInkingTool(.pen, color: UIColor(inkColor), width: inkWidth)
        case .highlighter:
            return PKInkingTool(.marker, color: UIColor(inkColor), width: inkWidth * 2.2)
        case .eraser:
            switch eraserStyle {
            case .bitmap:
                return bitmapEraser(width: eraserWidth)
            case .stroke:
                return strokeEraser(width: eraserWidth)
            }
        case .lasso:
            return PKLassoTool()
        case .shape, .text:
            return PKInkingTool(.pen, color: .clear, width: 1)
        }
    }

    private func bitmapEraser(width: CGFloat) -> PKTool {
        let w = max(4, width)
        if #available(iOS 17.0, *) {
            return PKEraserTool(.bitmap, width: w)
        }
        return PKEraserTool(.bitmap)
    }

    private func strokeEraser(width: CGFloat) -> PKTool {
        let w = max(4, width)
        if #available(iOS 17.0, *) {
            return PKEraserTool(.vector, width: w)
        }
        return PKEraserTool(.vector)
    }
}