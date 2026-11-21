import PencilKit
import UIKit

enum PageThumbnailRenderer {
    static func render(page: NotePage, targetWidth: CGFloat = 200) -> UIImage? {
        if let cached = page.thumbnailJPEGData, let image = UIImage(data: cached) {
            return image
        }
        let aspect: CGFloat = 1060 / 820
        let size = CGSize(width: targetWidth, height: targetWidth * aspect)
        let rect = CGRect(origin: .zero, size: size)

        let renderer = UIGraphicsImageRenderer(size: size)
        let image = renderer.image { ctx in
            UIColor(red: 0.99, green: 0.98, blue: 0.97, alpha: 1).setFill()
            UIRectFill(rect)
            if let data = page.backgroundImageData, let bg = UIImage(data: data) {
                bg.draw(in: rect)
            }
            if let data = page.pkDrawingData,
               let drawing = try? PKDrawing(data: data) {
                let stroke = drawing.image(from: rect, scale: 2)
                stroke.draw(in: rect)
            }
            PageOverlayRenderer.draw(overlays: page.overlays, in: rect, context: ctx.cgContext)
        }
        return image
    }

    static func refreshThumbnail(page: NotePage) {
        let width: CGFloat = 240
        guard let image = render(page: page, targetWidth: width) else { return }
        page.thumbnailJPEGData = image.jpegData(compressionQuality: 0.72)
    }
}