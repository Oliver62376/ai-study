import SwiftUI

struct RootView: View {
    @State private var tab: MainTab = .aiHome

    enum MainTab: Hashable {
        case aiHome
        case notebook
        case settings
    }

    var body: some View {
        TabView(selection: $tab) {
            HomeScreenView {
                tab = .notebook
            }
            .tabItem { Label("首頁", systemImage: "sparkles") }
            .tag(MainTab.aiHome)

            NotebookLibraryView()
                .tabItem { Label("筆記", systemImage: "book.closed.fill") }
                .tag(MainTab.notebook)

            NavigationStack {
                SettingsView()
            }
            .tabItem { Label("設定", systemImage: "gearshape.fill") }
            .tag(MainTab.settings)
        }
        .tint(NotebookTheme.header)
    }
}