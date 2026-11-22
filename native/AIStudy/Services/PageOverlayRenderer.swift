import SwiftUI
import UIKit

enum PageOverlayRenderer {
    static func draw(overlays: PageOverlays, in rect: CGRect, context: CGContext) {
        let scaleX = rect.width / 820
        let scaleY = rect.height / 1060
        context.saveGState()
        context.concatenate(CGAffineTransform(scaleX: scaleX, y: scaleY))

        for shape in overlays.shapes {
            let color = UIColor(Color(hex: shape.colorHex))
            context.setStrokeColor(color.cgColor)
            context.setFillColor(color.cgColor)
            context.setLineWidth(CGFloat(shape.strokeWidth))
            let a = CGPoint(x: shape.x1, y: shape.y1)
            let b = CGPoint(x: shape.x2, y: shape.y2)
            let box = CGRect(
                x: min(a.x, b.x),
                y: min(a.y, b.y),
                width: abs(b.x - a.x),
                height: abs(b.y - a.y)
            )
            switch shape.kind {
            case .line:
                context.move(to: a)
                context.addLine(to: b)
                context.strokePath()
            case .rect:
                if shape.filled { context.fill(box) } else { context.stroke(box) }
            case .ellipse:
                if shape.filled { context.fillEllipse(in: box) } else { context.strokeEllipse(in: box) }
            case .triangle:
                context.beginPath()
                context.move(to: CGPoint(x: box.midX, y: box.minY))
                context.addLine(to: CGPoint(x: box.maxX, y: box.maxY))
                context.addLine(to: CGPoint(x: box.minX, y: box.maxY))
                context.closePath()
                if shape.filled { context.fillPath() } else { context.strokePath() }
            case .diamond:
                context.beginPath()
                context.move(to: CGPoint(x: box.midX, y: box.minY))
                context.addLine(to: CGPoint(x: box.maxX, y: box.midY))
                context.addLine(to: CGPoint(x: box.midX, y: box.maxY))
                context.addLine(to: CGPoint(x: box.minX, y: box.midY))
                context.closePath()
                if shape.filled { context.fillPath() } else { context.strokePath() }
            case .capsule:
                let path = UIBezierPath(roundedRect: box, cornerRadius: box.height / 2)
                if shape.filled { path.fill() } else { path.stroke() }
            }
        }

        for sticker in overlays.images {
            guard let data = Data(base64Encoded: sticker.jpegBase64),
                  let image = UIImage(data: data) else { continue }
            let frame = CGRect(x: sticker.x, y: sticker.y, width: sticker.width, height: sticker.height)
            context.saveGState()
            context.translateBy(x: frame.midX, y: frame.midY)
            context.rotate(by: CGFloat(sticker.rotationDegrees * .pi / 180))
            let draw = CGRect(
                x: -frame.width / 2,
                y: -frame.height / 2,
                width: frame.width,
                height: frame.height
            )
            image.draw(in: draw)
            context.restoreGState()
        }

        for block in overlays.texts {
            let text = block.isPlaceholder && block.text.isEmpty ? "在這裡輸入文字" : block.text
            var font = UIFont.systemFont(ofSize: CGFloat(block.fontSize))
            switch block.fontDesign {
            case .rounded:
                if let rounded = UIFont.systemFont(ofSize: CGFloat(block.fontSize), weight: block.isBold ? .bold : .regular)
                    .fontDescriptor.withDesign(.rounded) {
                    font = UIFont(descriptor: rounded, size: CGFloat(block.fontSize))
                }
            case .serif:
                if let serif = UIFont.systemFont(ofSize: CGFloat(block.fontSize)).fontDescriptor.withDesign(.serif) {
                    font = UIFont(descriptor: serif, size: CGFloat(block.fontSize))
                }
            case .system:
                font = UIFont.systemFont(ofSize: CGFloat(block.fontSize), weight: block.isBold ? .bold : .regular)
            }
            if block.isItalic, let italic = font.fontDescriptor.withSymbolicTraits(.traitItalic) {
                font = UIFont(descriptor: italic, size: font.pointSize)
            }
            let frame = CGRect(x: block.x, y: block.y, width: block.width, height: block.height)
            if let bgHex = block.backgroundHex {
                context.setFillColor(UIColor(Color(hex: bgHex)).withAlphaComponent(0.92).cgColor)
                context.fill(frame)
            }
            let attrs: [NSAttributedString.Key: Any] = [
                .font: font,
                .foregroundColor: UIColor(Color(hex: block.colorHex)),
            ]
            let inset = frame.insetBy(dx: 8, dy: 8)
            NSString(string: text).draw(with: inset, options: [.usesLineFragmentOrigin], attributes: attrs, context: nil)
        }

        context.restoreGState()
    }
}