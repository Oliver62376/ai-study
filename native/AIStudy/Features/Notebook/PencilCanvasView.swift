import PencilKit
import SwiftUI
import UIKit

enum StrokeStraightener {
    static let holdInterval: TimeInterval = 0.55
    static let moveThreshold: CGFloat = 8

    static func straightenLastStroke(in canvas: PKCanvasView) {
        var strokes = canvas.drawing.strokes
        guard let last = strokes.last else { return }
        let locations = sampleLocations(from: last)
        guard shouldSnapLine(points: locations) else { return }
        let start = locations.first!
        let end = locations.last!
        guard let straight = makeStraightStroke(from: start, to: end, template: last) else { return }
        strokes[strokes.count - 1] = straight
        canvas.drawing = PKDrawing(strokes: strokes)
    }

    private static func sampleLocations(from stroke: PKStroke) -> [CGPoint] {
        let samples = 32
        return (0 ..< samples).map { i in
            stroke.path.interpolatedPoint(at: CGFloat(i) / CGFloat(samples - 1)).location
        }
    }

    private static func shouldSnapLine(points: [CGPoint]) -> Bool {
        guard points.count >= 8, let start = points.first, let end = points.last else { return false }
        let chord = hypot(end.x - start.x, end.y - start.y)
        guard chord > 28 else { return false }
        var maxDev: CGFloat = 0
        for p in points {
            maxDev = max(maxDev, distancePointToSegment(p, start, end))
        }
        guard maxDev >= 2 else { return false }
        return maxDev <= min(28, chord * 0.18)
    }

    private static func distancePointToSegment(_ p: CGPoint, _ a: CGPoint, _ b: CGPoint) -> CGFloat {
        let abx = b.x - a.x, aby = b.y - a.y
        let len2 = abx * abx + aby * aby
        guard len2 > 0.01 else { return hypot(p.x - a.x, p.y - a.y) }
        var t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2
        t = min(1, max(0, t))
        let proj = CGPoint(x: a.x + t * abx, y: a.y + t * aby)
        return hypot(p.x - proj.x, p.y - proj.y)
    }

    private static func makeStraightStroke(from start: CGPoint, to end: CGPoint, template: PKStroke) -> PKStroke? {
        let templatePoint = template.path.interpolatedPoint(at: 0.5)
        let steps = 24
        var control: [PKStrokePoint] = []
        for i in 0 ... steps {
            let t = CGFloat(i) / CGFloat(steps)
            let loc = CGPoint(
                x: start.x + (end.x - start.x) * t,
                y: start.y + (end.y - start.y) * t
            )
            control.append(
                PKStrokePoint(
                    location: loc,
                    timeOffset: TimeInterval(i) * 0.01,
                    size: templatePoint.size,
                    opacity: templatePoint.opacity,
                    force: templatePoint.force,
                    azimuth: templatePoint.azimuth,
                    altitude: templatePoint.altitude
                )
            )
        }
        let path = PKStrokePath(controlPoints: control, creationDate: Date())
        return PKStroke(ink: template.ink, path: path, transform: template.transform, mask: template.mask)
    }
}

final class SnapPKCanvasView: PKCanvasView {
    var holdSnapEnabled = true
    private var dwellTimer: Timer?
    private var dwellAnchor = CGPoint.zero
    private var touchActive = false

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        touchActive = true
        super.touchesBegan(touches, with: event)
        guard holdSnapEnabled, let touch = touches.first, acceptsHoldSnap(touch) else { return }
        dwellAnchor = touch.location(in: self)
        scheduleDwell()
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesMoved(touches, with: event)
        guard holdSnapEnabled, dwellTimer != nil, let touch = touches.first else { return }
        let point = touch.location(in: self)
        if hypot(point.x - dwellAnchor.x, point.y - dwellAnchor.y) > StrokeStraightener.moveThreshold {
            dwellAnchor = point
            scheduleDwell()
        }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        cancelDwell()
        touchActive = false
        super.touchesEnded(touches, with: event)
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        cancelDwell()
        touchActive = false
        super.touchesCancelled(touches, with: event)
    }

    private func acceptsHoldSnap(_ touch: UITouch) -> Bool {
        if StylusPreferencesStore.preferences.pencilOnly {
            return touch.type == .pencil
        }
        return touch.type == .pencil || touch.type == .direct
    }

    private func scheduleDwell() {
        cancelDwell()
        let timer = Timer(timeInterval: StrokeStraightener.holdInterval, repeats: false) { [weak self] _ in
            self?.fireDwell()
        }
        RunLoop.main.add(timer, forMode: .common)
        dwellTimer = timer
    }

    private func cancelDwell() {
        dwellTimer?.invalidate()
        dwellTimer = nil
    }

    private func fireDwell() {
        cancelDwell()
        guard touchActive, holdSnapEnabled else { return }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        StrokeStraightener.straightenLastStroke(in: self)
    }
}

struct PencilCanvasView: UIViewRepresentable {
    @Binding var drawing: PKDrawing
    var tool: PKTool?
    var inkInteractionEnabled: Bool = true
    var holdSnapEnabled: Bool = true
    var onCanvasReady: ((PKCanvasView) -> Void)? = nil

    func makeUIView(context: Context) -> PKCanvasView {
        let view = SnapPKCanvasView()
        view.holdSnapEnabled = holdSnapEnabled
        view.drawingPolicy = StylusPreferencesStore.preferences.pencilOnly ? .pencilOnly : .anyInput
        view.backgroundColor = .clear
        view.isOpaque = false
        view.tool = tool ?? PKInkingTool(.pen, color: .black, width: 3)
        view.drawing = drawing
        view.isUserInteractionEnabled = inkInteractionEnabled
        view.delegate = context.coordinator
        DispatchQueue.main.async {
            onCanvasReady?(view)
        }
        return view
    }

    func updateUIView(_ uiView: PKCanvasView, context: Context) {
        if let snap = uiView as? SnapPKCanvasView {
            snap.holdSnapEnabled = holdSnapEnabled
        }
        // 勿從 binding 覆寫 drawing，否則會清空 undo 堆疊。
        uiView.drawingPolicy = StylusPreferencesStore.preferences.pencilOnly ? .pencilOnly : .anyInput
        if inkInteractionEnabled, let tool {
            uiView.tool = tool
        }
        uiView.isUserInteractionEnabled = inkInteractionEnabled
        uiView.alpha = 1
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(drawing: $drawing)
    }

    final class Coordinator: NSObject, PKCanvasViewDelegate {
        @Binding var drawing: PKDrawing

        init(drawing: Binding<PKDrawing>) {
            _drawing = drawing
        }

        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            drawing = canvasView.drawing
        }
    }
}