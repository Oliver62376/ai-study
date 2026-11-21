import SwiftUI

struct PageOverlayView: View {
    @Bindable var page: NotePage
    var sheetSize: CGSize
    var shapeKind: ShapeKind
    var shapeColor: Color
    var shapeStroke: CGFloat
    var toolKind: InkToolKind
    @Binding var draftShapeStart: CGPoint?
    @Binding var draftShapeEnd: CGPoint?
    var onTapForText: (CGPoint) -> Void

    var body: some View {
        let overlays = page.overlays
        ZStack {
            ForEach(overlays.shapes) { shape in
                shapePath(shape)
                    .stroke(Color(hex: shape.colorHex), lineWidth: shape.strokeWidth)
            }
            ForEach(overlays.images) { sticker in
                if let data = Data(base64Encoded: sticker.jpegBase64),
                   let ui = UIImage(data: data) {
                    Image(uiImage: ui)
                        .resizable()
                        .scaledToFit()
                        .frame(width: sticker.width, height: sticker.height)
                        .position(x: sticker.x + sticker.width / 2, y: sticker.y + sticker.height / 2)
                }
            }
            ForEach(overlays.texts) { block in
                Text(block.text)
                    .font(.system(size: block.fontSize))
                    .foregroundStyle(Color(hex: block.colorHex))
                    .frame(width: block.width, height: block.height, alignment: .topLeading)
                    .position(x: block.x + block.width / 2, y: block.y + block.height / 2)
            }
            if toolKind == .shape, let a = draftShapeStart, let b = draftShapeEnd {
                draftPath(from: a, to: b)
                    .stroke(shapeColor, lineWidth: shapeStroke)
            }
        }
        .frame(width: sheetSize.width, height: sheetSize.height)
        .contentShape(Rectangle())
        .gesture(shapeGesture)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onEnded { value in
                    guard toolKind == .text else { return }
                    onTapForText(value.location)
                }
        )
    }

    private var shapeGesture: some Gesture {
        DragGesture(minimumDistance: 2)
            .onChanged { value in
                guard toolKind == .shape else { return }
                if draftShapeStart == nil {
                    draftShapeStart = value.startLocation
                }
                draftShapeEnd = value.location
            }
            .onEnded { value in
                guard toolKind == .shape else { return }
                commitShape(from: value.startLocation, to: value.location)
                draftShapeStart = nil
                draftShapeEnd = nil
            }
    }

    private func commitShape(from start: CGPoint, to end: CGPoint) {
        var next = page.overlays
        next.shapes.append(
            VectorShape(
                kind: shapeKind,
                colorHex: shapeColor.hexString,
                strokeWidth: Double(shapeStroke),
                x1: Double(start.x),
                y1: Double(start.y),
                x2: Double(end.x),
                y2: Double(end.y)
            )
        )
        page.overlays = next
        page.updatedAt = .now
    }

    private func shapePath(_ shape: VectorShape) -> Path {
        Path { path in
            let a = CGPoint(x: shape.x1, y: shape.y1)
            let b = CGPoint(x: shape.x2, y: shape.y2)
            switch shape.kind {
            case .line:
                path.move(to: a)
                path.addLine(to: b)
            case .rect:
                path.addRect(CGRect(x: min(a.x, b.x), y: min(a.y, b.y), width: abs(b.x - a.x), height: abs(b.y - a.y)))
            case .ellipse:
                path.addEllipse(in: CGRect(x: min(a.x, b.x), y: min(a.y, b.y), width: abs(b.x - a.x), height: abs(b.y - a.y)))
            }
        }
    }

    private func draftPath(from start: CGPoint, to end: CGPoint) -> Path {
        Path { path in
            switch shapeKind {
            case .line:
                path.move(to: start)
                path.addLine(to: end)
            case .rect:
                path.addRect(CGRect(x: min(start.x, end.x), y: min(start.y, end.y), width: abs(end.x - start.x), height: abs(end.y - start.y)))
            case .ellipse:
                path.addEllipse(in: CGRect(x: min(start.x, end.x), y: min(start.y, end.y), width: abs(end.x - start.x), height: abs(end.y - start.y)))
            }
        }
    }
}