import Foundation
import PDFKit
import UIKit

enum PDFImportService {
    enum ImportError: LocalizedError {
        case unreadable
        case empty

        var errorDescription: String? {
            switch self {
            case .unreadable: return "無法讀取 PDF。"
            case .empty: return "PDF 沒有可匯入的頁面。"
            }
        }
    }

    static func pagesFromPDF(at url: URL, maxPages: Int = 32) throws -> (title: String, pages: [NotePage]) {
        guard let document = PDFDocument(url: url) else { throw ImportError.unreadable }
        let title = url.deletingPathExtension().lastPathComponent
        let count = min(document.pageCount, maxPages)
        guard count > 0 else { throw ImportError.empty }

        var pages: [NotePage] = []
        for index in 0..<count {
            guard let pdfPage = document.page(at: index) else { continue }
            let bounds = pdfPage.bounds(for: .mediaBox)
            let targetWidth: CGFloat = 1240
            let scale = targetWidth / max(bounds.width, 1)
            let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)
            let image = pdfPage.thumbnail(of: size, for: .mediaBox)
            let jpeg = image.jpegData(compressionQuality: 0.82)
            pages.append(
                NotePage(
                    title: "\(title) 第 \(index + 1) 頁",
                    sortIndex: index,
                    backgroundImageData: jpeg
                )
            )
        }
        guard !pages.isEmpty else { throw ImportError.empty }
        return (title, pages)
    }
}