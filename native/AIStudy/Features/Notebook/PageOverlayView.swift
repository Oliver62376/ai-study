import SwiftUI

struct PageOverlayView: View {
    @Bindable var page: NotePage
    var sheetSize: CGSize
    var shapeKind: ShapeKind
    var shapeColor: Color
    var shapeStroke: CGFloat
    var shapeFilled: Bool
    var toolKind: InkToolKind
    @Binding var draftShapeStart: CGPoint?
    @Binding var draftShapeEnd: CGPoint?
    @Binding var selectedImageId: UUID?
    @Binding var selectedShapeIds: Set<UUID>
    @Binding var editingTextId: UUID?
    var onTapForText: (CGPoint) -> Void
    var onPersist: () -> Void

    var body: some View {
        let overlays = page.overlays
        ZStack {
            ForEach(overlays.shapes) { shape in
                vectorShapeView(shape, selected: selectedShapeIds.contains(shape.id))
                    .allowsHitTesting(false)
            }
            ForEach(Array(overlays.images.enumerated()), id: \.element.id) { index, sticker in
                TransformableImageSticker(
                    sticker: bindingForImage(at: index),
                    isSelected: selectedImageId == sticker.id,
                    onSelect: {
                        selectedImageId = sticker.id
                        selectedShapeIds = []
                        editingTextId = nil
                    },
                    onDeselect: {
                        if selectedImageId == sticker.id { selectedImageId = nil }
                    },
                    onChange: onPersist
                )
            }
            if toolKind == .shape, let a = draftShapeStart, let b = draftShapeEnd {
                draftPath(from: a, to: b)
                    .stroke(shapeColor, lineWidth: shapeStroke)
            }
            if toolKind == .shape {
                Color.clear
                    .contentShape(Rectangle())
                    .gesture(shapeGesture)
            }
            if toolKind == .text {
                Color.clear
                    .contentShape(Rectangle())
                    .gesture(textTapGesture(overlays: overlays))
            }
            ForEach(Array(overlays.texts.enumerated()), id: \.element.id) { index, block in
                TransformableTextBlock(
                    page: page,
                    index: index,
                    block: block,
                    toolKind: toolKind,
                    isEditing: editingTextId == block.id,
                    onBeginEdit: {
                        selectedImageId = nil
                        selectedShapeIds = []
                        editingTextId = block.id
                        clearPlaceholder(at: index)
                    },
                    onPersist: onPersist
                )
                .allowsHitTesting(toolKind == .text || editingTextId == block.id)
            }
            if toolKind == .text, overlays.texts.isEmpty, editingTextId == nil {
                Text("在這裡輸入文字")
                    .font(.title3)
                    .foregroundStyle(.secondary)
                    .allowsHitTesting(false)
            }
        }
        .frame(width: sheetSize.width, height: sheetSize.height)
    }

    private func shapeHitShape(_ shape: VectorShape) -> Path {
        let rect = boundingRect(for: shape)
        return Path(rect.insetBy(dx: -8, dy: -8))
    }

    private func boundingRect(for shape: VectorShape) -> CGRect {
        let a = CGPoint(x: shape.x1, y: shape.y1)
        let b = CGPoint(x: shape.x2, y: shape.y2)
        let pad: CGFloat = shape.kind == .line ? 16 : 8
        let minX = min(a.x, b.x) - pad
        let minY = min(a.y, b.y) - pad
        let maxX = max(a.x, b.x) + pad
        let maxY = max(a.y, b.y) + pad
        return CGRect(x: minX, y: minY, width: max(28, maxX - minX), height: max(28, maxY - minY))
    }

    private func textTapGesture(overlays: PageOverlays) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onEnded { value in
                guard toolKind == .text else { return }
                guard value.translation.width * value.translation.width + value.translation.height * value.translation.height < 144 else { return }
                let loc = value.location
                if overlays.texts.contains(where: { textRect($0).contains(loc) }) { return }
                onTapForText(loc)
            }
    }

    private func textRect(_ block: TextAnnotation) -> CGRect {
        CGRect(x: block.x, y: block.y, width: block.width, height: block.height)
    }

    private func bindingForImage(at index: Int) -> Binding<ImageSticker> {
        Binding(
            get: { page.overlays.images[index] },
            set: { newValue in
                var next = page.overlays
                guard index < next.images.count else { return }
                next.images[index] = newValue
                page.overlays = next
            }
        )
    }

    private func clearPlaceholder(at index: Int) {
        var next = page.overlays
        guard index < next.texts.count else { return }
        if next.texts[index].isPlaceholder {
            next.texts[index].text = ""
            next.texts[index].isPlaceholder = false
        }
        page.overlays = next
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
                filled: shapeFilled,
                x1: Double(start.x),
                y1: Double(start.y),
                x2: Double(end.x),
                y2: Double(end.y)
            )
        )
        page.overlays = next
        page.updatedAt = .now
        onPersist()
    }

    @ViewBuilder
    private func vectorShapeView(_ shape: VectorShape, selected: Bool) -> some View {
        let color = Color(hex: shape.colorHex)
        let path = shapePath(shape)
        ZStack {
            if shape.filled {
                path.fill(color)
            } else {
                path.stroke(color, lineWidth: shape.strokeWidth)
            }
            if selected {
                shapeHitShape(shape)
                    .stroke(Color.accentColor, style: StrokeStyle(lineWidth: 2, dash: [6, 4]))
            }
        }
    }

    private func shapePath(_ shape: VectorShape) -> Path {
        Path { path in
            let a = CGPoint(x: shape.x1, y: shape.y1)
            let b = CGPoint(x: shape.x2, y: shape.y2)
            let rect = CGRect(x: min(a.x, b.x), y: min(a.y, b.y), width: abs(b.x - a.x), height: abs(b.y - a.y))
            switch shape.kind {
            case .line:
                path.move(to: a)
                path.addLine(to: b)
            case .rect:
                path.addRect(rect)
            case .ellipse:
                path.addEllipse(in: rect)
            case .capsule:
                path.addRoundedRect(in: rect, cornerSize: CGSize(width: rect.height / 2, height: rect.height / 2))
            case .triangle:
                path.move(to: CGPoint(x: rect.midX, y: rect.minY))
                path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
                path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
                path.closeSubpath()
            case .diamond:
                path.move(to: CGPoint(x: rect.midX, y: rect.minY))
                path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
                path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
                path.addLine(to: CGPoint(x: rect.minX, y: rect.midY))
                path.closeSubpath()
            }
        }
    }

    private func draftPath(from start: CGPoint, to end: CGPoint) -> Path {
        shapePath(
            VectorShape(
                kind: shapeKind,
                colorHex: shapeColor.hexString,
                strokeWidth: Double(shapeStroke),
                filled: shapeFilled,
                x1: Double(start.x),
                y1: Double(start.y),
                x2: Double(end.x),
                y2: Double(end.y)
            )
        )
    }
}

enum TextAnnotationFont {
    static func font(for block: TextAnnotation) -> Font {
        var base: Font
        switch block.fontDesign {
        case .system:
            base = .system(size: block.fontSize)
        case .rounded:
            base = .system(size: block.fontSize, design: .rounded)
        case .serif:
            base = .system(size: block.fontSize, design: .serif)
        }
        if block.isBold { base = base.bold() }
        if block.isItalic { base = base.italic() }
        return base
    }
}

private struct TransformableTextBlock: View {
    @Bindable var page: NotePage
    let index: Int
    let block: TextAnnotation
    let toolKind: InkToolKind
    let isEditing: Bool
    var onBeginEdit: () -> Void
    var onPersist: () -> Void

    @GestureState private var magnify: CGFloat = 1
    @State private var dragOffset: CGSize = .zero

    private var width: CGFloat { max(80, CGFloat(block.width) * magnify) }
    private var height: CGFloat { max(44, CGFloat(block.height) * magnify) }

    var body: some View {
        Group {
            if isEditing {
                TextField(
                    "在這裡輸入文字",
                    text: textBinding,
                    axis: .vertical
                )
                .font(TextAnnotationFont.font(for: block))
                .foregroundStyle(Color(hex: block.colorHex))
                .textFieldStyle(.plain)
                .padding(8)
                .background(textBackground)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            } else {
                Text(block.isPlaceholder && block.text.isEmpty ? "在這裡輸入文字" : block.text)
                    .font(TextAnnotationFont.font(for: block))
                    .foregroundStyle(block.isPlaceholder ? Color.secondary : Color(hex: block.colorHex))
                    .frame(width: width, height: height, alignment: .topLeading)
                    .padding(8)
                    .background(textBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .onTapGesture(perform: onBeginEdit)
            }
        }
        .frame(width: width, height: height, alignment: .topLeading)
        .overlay {
            if toolKind == .text || isEditing {
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.accentColor.opacity(isEditing ? 0.9 : 0.35), lineWidth: isEditing ? 2 : 1)
            }
        }
        .position(
            x: block.x + CGFloat(block.width) / 2 + dragOffset.width,
            y: block.y + CGFloat(block.height) / 2 + dragOffset.height
        )
        .gesture(toolKind == .text || isEditing ? manipulation : nil)
    }

    @ViewBuilder
    private var textBackground: some View {
        if let hex = block.backgroundHex, !hex.isEmpty {
            Color(hex: hex).opacity(0.92)
        } else {
            Color.clear
        }
    }

    private var textBinding: Binding<String> {
        Binding(
            get: { page.overlays.texts[index].text },
            set: { newValue in
                var next = page.overlays
                guard index < next.texts.count else { return }
                next.texts[index].text = newValue
                next.texts[index].isPlaceholder = false
                page.overlays = next
                onPersist()
            }
        )
    }

    private var manipulation: some Gesture {
        SimultaneousGesture(
            DragGesture()
                .onChanged { dragOffset = $0.translation }
                .onEnded { value in
                    var next = page.overlays
                    guard index < next.texts.count else { return }
                    next.texts[index].x += Double(value.translation.width)
                    next.texts[index].y += Double(value.translation.height)
                    page.overlays = next
                    dragOffset = .zero
                    onPersist()
                },
            MagnificationGesture()
                .updating($magnify) { current, state, _ in state = current }
                .onEnded { scale in
                    var next = page.overlays
                    guard index < next.texts.count else { return }
                    let factor = max(0.35, scale)
                    next.texts[index].width = max(80, next.texts[index].width * factor)
                    next.texts[index].height = max(44, next.texts[index].height * factor)
                    next.texts[index].fontSize = min(48, max(12, next.texts[index].fontSize * Double(factor)))
                    page.overlays = next
                    onPersist()
                }
        )
    }
}

private struct TransformableImageSticker: View {
    @Binding var sticker: ImageSticker
    var isSelected: Bool
    var onSelect: () -> Void
    var onDeselect: () -> Void
    var onChange: () -> Void

    @GestureState private var magnifyBy: CGFloat = 1
    @GestureState private var twistBy: Angle = .zero
    @State private var dragOffset: CGSize = .zero
    @State private var isManipulating = false

    private var displayWidth: CGFloat { max(40, sticker.width * magnifyBy) }
    private var displayHeight: CGFloat { max(40, sticker.height * magnifyBy) }

    var body: some View {
        Group {
            if let data = Data(base64Encoded: sticker.jpegBase64),
               let ui = UIImage(data: data) {
                Image(uiImage: ui)
                    .resizable()
                    .scaledToFit()
                    .frame(width: displayWidth, height: displayHeight)
                    .rotationEffect(Angle(degrees: sticker.rotationDegrees) + twistBy)
                    .overlay {
                        if isSelected {
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(Color.accentColor, lineWidth: 2)
                        }
                    }
                    .position(
                        x: sticker.x + sticker.width / 2 + dragOffset.width,
                        y: sticker.y + sticker.height / 2 + dragOffset.height
                    )
                    .gesture(manipulationGesture)
                    .onTapGesture {
                        if isSelected, !isManipulating {
                            onDeselect()
                        } else {
                            onSelect()
                        }
                    }
            }
        }
    }

    private var manipulationGesture: some Gesture {
        SimultaneousGesture(
            DragGesture()
                .onChanged { value in
                    onSelect()
                    isManipulating = true
                    dragOffset = value.translation
                }
                .onEnded { value in
                    sticker.x += Double(value.translation.width)
                    sticker.y += Double(value.translation.height)
                    dragOffset = .zero
                    isManipulating = false
                    onChange()
                },
            SimultaneousGesture(
                MagnificationGesture()
                    .updating($magnifyBy) { current, state, _ in
                        onSelect()
                        isManipulating = true
                        state = current
                    }
                    .onEnded { scale in
                        let factor = max(0.2, scale)
                        sticker.width = max(40, sticker.width * factor)
                        sticker.height = max(40, sticker.height * factor)
                        isManipulating = false
                        onChange()
                    },
                RotationGesture()
                    .updating($twistBy) { current, state, _ in
                        onSelect()
                        isManipulating = true
                        state = current
                    }
                    .onEnded { angle in
                        sticker.rotationDegrees += angle.degrees
                        isManipulating = false
                        onChange()
                    }
            )
        )
    }
}