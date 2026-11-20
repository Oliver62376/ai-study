import SwiftData
import SwiftUI

@main
struct AIStudyApp: App {
    var sharedModelContainer: ModelContainer = {
        let schema = Schema([Notebook.self, NotePage.self])
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