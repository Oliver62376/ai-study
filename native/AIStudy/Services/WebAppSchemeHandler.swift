import Foundation
import UniformTypeIdentifiers
import WebKit

/// WKWebView 無法可靠以 file:// 載入 Vite 的 ES module；改由自訂 scheme 從 Bundle 讀檔。
final class WebAppSchemeHandler: NSObject, WKURLSchemeHandler {
    private let root = "WebApp"

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }
        var path = url.path
        if path.isEmpty || path == "/" {
            path = "/index.html"
        }
        guard let fileURL = resolve(relativePath: path),
              let data = try? Data(contentsOf: fileURL) else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        let mime = mimeType(for: fileURL)
        let response = URLResponse(
            url: url,
            mimeType: mime,
            expectedContentLength: data.count,
            textEncodingName: mime.hasPrefix("text") ? "utf-8" : nil
        )
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private func resolve(relativePath path: String) -> URL? {
        let trimmed = path.hasPrefix("/") ? String(path.dropFirst()) : path
        if trimmed == "index.html" || trimmed.isEmpty {
            return Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: root)
        }
        let parts = trimmed.split(separator: "/").map(String.init)
        guard !parts.isEmpty else { return nil }
        if parts.count == 1 {
            return Bundle.main.url(forResource: parts[0], withExtension: nil, subdirectory: root)
        }
        let fileName = parts.last!
        let subdir = ([root] + parts.dropLast()).joined(separator: "/")
        return Bundle.main.url(forResource: fileName, withExtension: nil, subdirectory: subdir)
    }

    private func mimeType(for url: URL) -> String {
        let ext = url.pathExtension.lowercased()
        switch ext {
        case "html", "htm": return "text/html"
        case "js", "mjs": return "application/javascript"
        case "css": return "text/css"
        case "json": return "application/json"
        case "woff2": return "font/woff2"
        case "woff": return "font/woff"
        case "ttf": return "font/ttf"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        default:
            if let type = UTType(filenameExtension: ext),
               let mime = type.preferredMIMEType {
                return mime
            }
            return "application/octet-stream"
        }
    }
}