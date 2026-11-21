import SwiftUI
import WebKit

struct WebClassroomView: View {
    let seedTopic: String
    let context: String

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack(alignment: .topLeading) {
            WebClassroomWebView(seedTopic: seedTopic, fileText: context)
                .ignoresSafeArea(edges: .bottom)

            Button {
                dismiss()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.body.weight(.semibold))
                    .padding(12)
                    .liquidGlassBar(cornerRadius: 14)
            }
            .padding(.leading, 12)
            .padding(.top, 8)
            .accessibilityLabel("返回首頁")
        }
        .navigationBarHidden(true)
        .onAppear {
            LessonStore.upsert(
                title: seedTopic,
                topic: context.isEmpty ? seedTopic : context,
                mode: .board
            )
        }
    }
}

private struct WebClassroomWebView: UIViewRepresentable {
    let seedTopic: String
    let fileText: String

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.defaultWebpagePreferences.allowsContentJavaScript = true

        let prefsScript = WKUserScript(
            source: WebLocalStorageBridge.injectionScript(),
            injectionTime: .atDocumentStart,
            forMainFrame: true
        )
        config.userContentController.addUserScript(prefsScript)

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.navigationDelegate = context.coordinator
        context.coordinator.webView = webView
        context.coordinator.pendingBoot = (seedTopic, fileText)

        if let index = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "WebApp") {
            let folder = index.deletingLastPathComponent()
            webView.loadFileURL(index, allowingReadAccessTo: folder)
        } else {
            webView.loadHTMLString(missingBundleHTML, baseURL: nil)
        }

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        var webView: WKWebView?
        var pendingBoot: (String, String)?

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            guard let pendingBoot else { return }
            let boot = WebLocalStorageBridge.bootScript(topic: pendingBoot.0, fileText: pendingBoot.1)
            webView.evaluateJavaScript(boot) { _, error in
                if let error {
                    NSLog("Web classroom boot failed: \(error.localizedDescription)")
                }
            }
            self.pendingBoot = nil
        }
    }

    private var missingBundleHTML: String {
        """
        <html><body style="font: -apple-system-body; padding: 2rem; color: #333;">
        <h2>Web 白板未打包</h2>
        <p>此版本應內建 Web 教室。請重新安裝最新 IPA，或於開發端執行 <code>npm run build:native-web</code> 後再編譯。</p>
        </body></html>
        """
    }
}