import PDFKit
import PencilKit
import UIKit

enum NotebookPDFExport {
    static func pdfData(for notebook: Notebook) -> Data? {
        let sorted = notebook.pages.sorted { $0.sortIndex < $1.sortIndex }
        guard let first = sorted.first else { return nil }

        let pageRect = pageRect(for: first)
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)

        return renderer.pdfData { context in
            for page in sorted {
                let rect = pageRect(for: page)
                context.beginPage(withBounds: rect, pageInfo: [:])
                guard let cg = UIGraphicsGetCurrentContext() else { continue }

                UIColor(white: 0.98, alpha: 1).setFill()
                cg.fill(rect)

                if let data = page.backgroundImageData, let image = UIImage(data: data) {
                    image.draw(in: rect)
                }

                if let data = page.pkDrawingData,
                   let drawing = try? PKDrawing(data: data) {
                    let image = drawing.image(from: rect, scale: 2)
                    image.draw(in: rect)
                }
            }
        }
    }

    private static func pageRect(for page: NotePage) -> CGRect {
        if let data = page.backgroundImageData, let image = UIImage(data: data) {
            return CGRect(origin: .zero, size: image.size)
        }
        return CGRect(x: 0, y: 0, width: 820, height: 1060)
    }
}