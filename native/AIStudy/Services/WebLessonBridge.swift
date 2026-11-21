import WebKit

/// Web 教室把板書／課程快照寫回原生「我的課」，避免重開時再次備課。
final class WebLessonBridge: NSObject, WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        switch message.name {
        case "aiStudyLessonSave":
            guard let body = message.body as? [String: Any],
                  let id = body["id"] as? String,
                  let snapshot = body["snapshot"] as? String,
                  !snapshot.isEmpty else { return }
            LessonStore.saveSnapshot(id: id, snapshotJSON: snapshot)
        case "aiStudyMemorySave":
            guard let body = message.body as? [String: Any],
                  let json = body["json"] as? String else { return }
            UserDefaults.standard.set(json, forKey: "ai-study-memory-v1")
        default:
            break
        }
    }
}