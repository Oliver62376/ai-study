import Foundation
import PDFKit
import UIKit
import Vision

enum UploadIngestService {
    struct Result {
        var text: String
        var log: [String]
    }

    static func ingest(urls: [URL], report: @escaping @MainActor (String) -> Void) async -> Result {
        let mode = AppPreferencesStore.preferences.uploadMode
        var logs: [String] = []
        var chunks: [String] = []

        for url in urls {
            let name = url.lastPathComponent
            await report("已加入：\(name)")
            logs.append("已加入 \(name)")

            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }

            let ext = url.pathExtension.lowercased()
            do {
                if ext == "pdf" {
                    await report("讀取 PDF「\(name)」…")
                    let piece = try await ingestPDF(url, mode: mode) { status in
                        Task { @MainActor in report(status) }
                    }
                    chunks.append(piece)
                    logs.append("完成 PDF \(name)")
                    await report("完成：\(name)")
                } else if ["jpg", "jpeg", "png", "heic", "webp"].contains(ext),
                          let image = UIImage(contentsOfFile: url.path) {
                    await report("讀取圖片「\(name)」…")
                    if mode == .vision {
                        chunks.append("【圖片·視覺】\(name)\n（已附加；請用支援視覺的模型提問。）")
                        await report("已標記視覺附件：\(name)")
                    } else {
                        await report("OCR「\(name)」…")
                        let text = try ocr(image)
                        chunks.append("【\(name)】\n\(clip(text))")
                        await report("OCR 完成：\(name)")
                    }
                } else {
                    await report("擷取文字「\(name)」…")
                    let text = try String(contentsOf: url, encoding: .utf8)
                    chunks.append("【\(name)】\n\(clip(text))")
                    await report("完成：\(name)")
                }
            } catch {
                let message = "無法處理 \(name)：\(error.localizedDescription)"
                logs.append(message)
                await report(message)
            }
        }

        return Result(text: chunks.joined(separator: "\n\n"), log: logs)
    }

    private static func ingestPDF(_ url: URL, mode: UploadMode, report: @escaping @MainActor (String) -> Void) async throws -> String {
        guard let doc = PDFDocument(url: url) else { throw NSError(domain: "upload", code: 1) }
        let title = url.deletingPathExtension().lastPathComponent
        let count = min(doc.pageCount, 16)
        var parts: [String] = []

        for index in 0 ..< count {
            guard let page = doc.page(at: index) else { continue }
            let builtIn = page.string?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

            if mode == .text, !builtIn.isEmpty {
                await report("PDF 第 \(index + 1) 頁：擷取文字層…")
                parts.append("第 \(index + 1) 頁：\(clip(builtIn))")
                continue
            }

            if mode == .vision, builtIn.isEmpty {
                await report("PDF 第 \(index + 1) 頁：標記為掃描圖…")
                parts.append("（第 \(index + 1) 頁以掃描圖處理，建議視覺模型）")
                continue
            }

            if !builtIn.isEmpty {
                parts.append("第 \(index + 1) 頁：\(clip(builtIn))")
                continue
            }

            await report("PDF 第 \(index + 1) 頁：OCR…")
            let image = page.thumbnail(of: CGSize(width: 1400, height: 1800), for: .mediaBox)
            let ocrText = try ocr(image)
            if !ocrText.isEmpty {
                parts.append("第 \(index + 1) 頁（OCR）：\(clip(ocrText))")
            }
        }

        guard !parts.isEmpty else {
            throw NSError(domain: "upload", code: 2, userInfo: [NSLocalizedDescriptionKey: "PDF 沒有讀到內容；請在設定改為 OCR 或視覺模式。"])
        }
        return "【PDF·\(title)】\n" + parts.joined(separator: "\n")
    }

    private static func ocr(_ image: UIImage) throws -> String {
        guard let cg = image.cgImage else { return "" }
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        request.recognitionLanguages = ["zh-Hant", "zh-Hans", "en-US"]
        let handler = VNImageRequestHandler(cgImage: cg, options: [:])
        try handler.perform([request])
        let lines = request.results?.compactMap { $0.topCandidates(1).first?.string } ?? []
        return lines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func clip(_ text: String, max: Int = 4000) -> String {
        if text.count <= max { return text }
        return String(text.prefix(max)) + "…"
    }
}