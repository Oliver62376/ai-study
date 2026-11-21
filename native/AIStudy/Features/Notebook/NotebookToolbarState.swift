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
                return PKEraserTool(.bitmap)
            case .stroke:
                return PKEraserTool(.vector)
            }
        default:
            return PKInkingTool(.pen, color: UIColor(inkColor), width: inkWidth)
        }
    }
}