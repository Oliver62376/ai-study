import SwiftUI

enum NotebookIcons {
    case pen, fountain, highlighter, eraser, shapes, lasso, text
    case undo, redo, image, materials, pages, share, settings

    var assetName: String? {
        switch self {
        case .pen: return "nb-pen"
        case .fountain: return "nb-fountain"
        case .highlighter: return "nb-highlighter"
        case .eraser: return "nb-eraser"
        case .shapes: return "nb-shapes"
        case .lasso: return "nb-lasso"
        default: return nil
        }
    }

    var systemName: String {
        switch self {
        case .text: return "textformat"
        case .undo: return "arrow.uturn.backward"
        case .redo: return "arrow.uturn.forward"
        case .image: return "photo.on.rectangle"
        case .materials: return "doc.richtext"
        case .pages: return "square.stack.3d.up"
        case .share: return "square.and.arrow.up"
        case .settings: return "gearshape"
        default: return "questionmark"
        }
    }

    var label: String {
        switch self {
        case .pen: return "筆"
        case .fountain: return "鋼筆"
        case .highlighter: return "螢光"
        case .eraser: return "橡皮"
        case .shapes: return "圖形"
        case .lasso: return "套索"
        case .text: return "文字"
        case .undo: return "復原"
        case .redo: return "重做"
        case .image: return "圖片"
        case .materials: return "教材"
        case .pages: return "頁面"
        case .share: return "分享"
        case .settings: return "設定"
        }
    }
}

struct NotebookGlyph: View {
    let icon: NotebookIcons
    var size: CGFloat = 22

    var body: some View {
        if let asset = icon.assetName {
            Image(asset)
                .renderingMode(.template)
                .resizable()
                .scaledToFit()
                .frame(width: size, height: size)
        } else {
            Image(systemName: icon.systemName)
                .font(.system(size: size - 2, weight: .medium))
        }
    }
}

struct NotebookIconTool: View {
    let icon: NotebookIcons
    var active = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                NotebookGlyph(icon: icon)
                    .frame(width: 36, height: 28)
                Text(icon.label)
                    .font(.system(size: 11, weight: .semibold))
            }
            .foregroundStyle(active ? Color.white : Color.primary)
            .padding(.horizontal, 6)
            .padding(.vertical, 6)
            .background(active ? NotebookTheme.header : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }
}