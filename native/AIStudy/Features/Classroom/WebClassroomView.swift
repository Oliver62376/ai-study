import SwiftUI
import WebKit

struct WebClassroomView: View {
    let seedTopic: String
    let context: String
    let lessonId: String

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack(alignment: .topLeading) {
            WebClassroomWebView(seedTopic: seedTopic, fileText: context, lessonId: lessonId)
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
        .toolbar(.hidden, for: .tabBar)
        .onAppear {
            let snap = LessonStore.record(id: lessonId)?.snapshotJSON
            _ = LessonStore.register(
                id: lessonId,
                title: seedTopic,
                topic: context.isEmpty ? seedTopic : context,
                mode: .board,
                snapshotJSON: snap
            )
        }
    }
}

private struct WebClassroomWebView: UIViewRepresentable {
    let seedTopic: String
    let fileText: String
    let lessonId: String

    func makeCoordinator() -> Coordinator {
        Coordinator(seedTopic: seedTopic, fileText: fileText, lessonId: lessonId)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        if #available(iOS 10.0, *) {
            config.mediaTypesRequiringUserActionForPlayback = []
        }
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.setURLSchemeHandler(WebAppSchemeHandler(), forURLScheme: "aistudy")

        let speech = context.coordinator.speechBridge
        let lessons = context.coordinator.lessonBridge
        config.userContentController.add(speech, name: "aiStudyTTS")
        config.userContentController.add(speech, name: "aiStudyTTSStop")
        config.userContentController.add(lessons, name: "aiStudyLessonSave")
        config.userContentController.add(lessons, name: "aiStudyMemorySave")

        let snapshotJSON = LessonStore.record(id: lessonId)?.snapshotJSON
        var bootstrap = WebLocalStorageBridge.injectionScript()
        bootstrap += "\n"
        bootstrap += WebLocalStorageBridge.bootScript(
            topic: seedTopic,
            fileText: fileText,
            lessonId: lessonId,
            snapshotJSON: snapshotJSON
        )

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
        speech.webView = webView
        context.coordinator.webView = webView

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

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "aiStudyTTS")
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "aiStudyTTSStop")
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "aiStudyLessonSave")
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "aiStudyMemorySave")
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        let seedTopic: String
        let fileText: String
        let lessonId: String
        let speechBridge = WebSpeechBridge()
        let lessonBridge = WebLessonBridge()
        weak var webView: WKWebView?

        init(seedTopic: String, fileText: String, lessonId: String) {
            self.seedTopic = seedTopic
            self.fileText = fileText
            self.lessonId = lessonId
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