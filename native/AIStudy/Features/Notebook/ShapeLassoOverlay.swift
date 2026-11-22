import SwiftUI
import UIKit

/// 套索模式下：手指拖曳框選向量圖形；Apple Pencil 事件穿透給 PencilKit 套索。
struct ShapeLassoOverlay: UIViewRepresentable {
    let shapes: [VectorShape]
    var onSelectIds: ([UUID]) -> Void
    var onClearSelection: () -> Void

    func makeUIView(context: Context) -> ShapeLassoUIView {
        let view = ShapeLassoUIView()
        view.onCommit = { ids in
            if ids.isEmpty {
                onClearSelection()
            } else {
                onSelectIds(ids)
            }
        }
        return view
    }

    func updateUIView(_ uiView: ShapeLassoUIView, context: Context) {
        uiView.shapes = shapes
    }
}

final class ShapeLassoUIView: UIView {
    var shapes: [VectorShape] = []
    var onCommit: (([UUID]) -> Void)?

    private var anchor: CGPoint?
    private var current: CGPoint?
    private let feedback = UIImpactFeedbackGenerator(style: .light)

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isMultipleTouchEnabled = false
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard let touches = event?.allTouches else { return nil }
        if touches.contains(where: { $0.type == .pencil }) {
            return nil
        }
        return self.point(inside: point, with: event) ? self : nil
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        anchor = touch.location(in: self)
        current = anchor
        setNeedsDisplay()
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        current = touch.location(in: self)
        setNeedsDisplay()
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        defer {
            anchor = nil
            current = nil
            setNeedsDisplay()
        }
        guard let a = anchor, let b = current ?? anchor else { return }
        let rect = rectNormalized(a, b)
        if rect.width < 12, rect.height < 12 {
            if let hit = shapes.first(where: { rectFor($0).contains(a) }) {
                onCommit?([hit.id])
                feedback.impactOccurred()
            }
            return
        }
        let ids = shapes.filter { rectFor($0).intersects(rect) }.map(\.id)
        if !ids.isEmpty {
            feedback.impactOccurred()
        }
        onCommit?(ids)
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        anchor = nil
        current = nil
        setNeedsDisplay()
    }

    override func draw(_ rect: CGRect) {
        guard let a = anchor, let b = current else { return }
        let box = rectNormalized(a, b)
        guard let ctx = UIGraphicsGetCurrentContext() else { return }
        ctx.setStrokeColor(UIColor.systemBlue.withAlphaComponent(0.85).cgColor)
        ctx.setLineWidth(1.5)
        ctx.setLineDash(phase: 0, lengths: [5, 4])
        ctx.stroke(box)
        ctx.setFillColor(UIColor.systemBlue.withAlphaComponent(0.08).cgColor)
        ctx.fill(box)
    }

    private func rectNormalized(_ a: CGPoint, _ b: CGPoint) -> CGRect {
        CGRect(x: min(a.x, b.x), y: min(a.y, b.y), width: abs(b.x - a.x), height: abs(b.y - a.y))
    }

    private func rectFor(_ shape: VectorShape) -> CGRect {
        let pad: CGFloat = shape.kind == .line ? 18 : 10
        let a = CGPoint(x: shape.x1, y: shape.y1)
        let b = CGPoint(x: shape.x2, y: shape.y2)
        return CGRect(
            x: min(a.x, b.x) - pad,
            y: min(a.y, b.y) - pad,
            width: max(28, abs(b.x - a.x) + pad * 2),
            height: max(28, abs(b.y - a.y) + pad * 2)
        )
    }
}