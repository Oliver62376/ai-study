import SwiftUI

struct RootView: View {
    @State private var tab: MainTab = .notebook

    enum MainTab: Hashable {
        case notebook
        case aiHome
        case settings
    }

    var body: some View {
        TabView(selection: $tab) {
            NotebookLibraryView()
                .tabItem { Label("筆記", systemImage: "book.closed.fill") }
                .tag(MainTab.notebook)

            NavigationStack {
                HomeDashboardView { section in
                    switch section {
                    case .notebook: tab = .notebook
                    case .settings: tab = .settings
                    case .whiteboard:
                        break
                    default:
                        break
                    }
                }
                .navigationDestination(for: AppSection.self) { section in
                    switch section {
                    case .whiteboard:
                        WhiteboardView()
                    case .classroom, .chat, .quiz:
                        FeaturePlaceholderView(title: sectionTitle(section))
                    default:
                        EmptyView()
                    }
                }
            }
            .tabItem { Label("AI 首頁", systemImage: "sparkles") }
            .tag(MainTab.aiHome)

            NavigationStack {
                SettingsView()
            }
            .tabItem { Label("設定", systemImage: "gearshape.fill") }
            .tag(MainTab.settings)
        }
        .tint(NotebookTheme.header)
    }

    private func sectionTitle(_ section: AppSection) -> String {
        switch section {
        case .classroom: "教室"
        case .chat: "對話"
        case .quiz: "測驗"
        default: ""
        }
    }
}

private struct FeaturePlaceholderView: View {
    let title: String

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: "hammer.fill")
        } description: {
            Text("Epic 2 會完整對齊 Web 版 \(title)。")
        }
    }
}