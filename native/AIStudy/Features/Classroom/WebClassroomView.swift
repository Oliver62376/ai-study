import SwiftUI
import WebKit

struct WebClassroomView: View {
    let seedTopic: String
    let context: String

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack(alignment: .topLeading) {
            WebClassroomWebView(seedTopic: seedTopic, fileText: context)
                .ignoresSafeArea()

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
        Coordinator(seedTopic: seedTopic, fileText: fileText)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.setURLSchemeHandler(WebAppSchemeHandler(), forURLScheme: "aistudy")

        var bootstrap = WebLocalStorageBridge.injectionScript()
        bootstrap += "\n"
        bootstrap += WebLocalStorageBridge.bootScript(topic: seedTopic, fileText: fileText)

        let prefsScript = WKUserScript(
            source: bootstrap,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        config.userContentController.addUserScript(prefsScript)

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = true
        webView.backgroundColor = .systemBackground
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.navigationDelegate = context.coordinator

        if Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "WebApp") != nil {
            if let start = URL(string: "aistudy://app/index.html") {
                webView.load(URLRequest(url: start))
            }
        } else {
            webView.loadHTMLString(missingBundleHTML, baseURL: nil)
        }

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        let seedTopic: String
        let fileText: String

        init(seedTopic: String, fileText: String) {
            self.seedTopic = seedTopic
            self.fileText = fileText
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            NSLog("Web classroom navigation error: \(error.localizedDescription)")
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            NSLog("Web classroom provisional error: \(error.localizedDescription)")
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            webView.evaluateJavaScript("document.getElementById('root')?.childElementCount ?? 0") { count, _ in
                if let n = count as? Int, n == 0 {
                    NSLog("Web classroom: #root still empty after load (topic=\(self.seedTopic))")
                }
            }
        }
    }

    private var missingBundleHTML: String {
        """
        <html><body style="font: -apple-system-body; padding: 2rem; color: #333;">
        <h2>Web 白板未打包</h2>
        <p>請重新安裝最新 IPA。</p>
        </body></html>
        """
    }
}