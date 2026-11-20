import SwiftUI

/// 原生 App 以筆記為主；其餘模組陸續用 Swift 重寫。
struct RootView: View {
    var body: some View {
        TabView {
            NotebookLibraryView()
                .tabItem {
                    Label("筆記", systemImage: "book.fill")
                }

            SettingsView()
                .tabItem {
                    Label("設定", systemImage: "gearshape.fill")
                }
        }
        .tint(NotebookTheme.header)
    }
}