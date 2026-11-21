import AVFoundation
import SwiftData
import SwiftUI

@main
struct AIStudyApp: App {
    init() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)
        } catch {
            NSLog("App audio session: \(error.localizedDescription)")
        }
    }
    var sharedModelContainer: ModelContainer = {
        let schema = Schema([Notebook.self, NotePage.self, NotebookFolder.self])
        let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        do {
            return try ModelContainer(for: schema, configurations: [config])
        } catch {
            fatalError("SwiftData init failed: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            RootView()
        }
        .modelContainer(sharedModelContainer)
    }
}