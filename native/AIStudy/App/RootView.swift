import SwiftUI

enum AppSection: String, CaseIterable, Identifiable {
    case home
    case notebook
    case classroom
    case chat
    case quiz
    case settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: return "首頁"
        case .notebook: return "筆記"
        case .classroom: return "教室"
        case .chat: return "對話"
        case .quiz: return "測驗"
        case .settings: return "設定"
        }
    }

    var systemImage: String {
        switch self {
        case .home: return "house.fill"
        case .notebook: return "book.fill"
        case .classroom: return "chalkboard.fill"
        case .chat: return "bubble.left.and.bubble.right.fill"
        case .quiz: return "checkmark.circle.fill"
        case .settings: return "gearshape.fill"
        }
    }
}

struct RootView: View {
    @State private var section: AppSection = .home

    var body: some View {
        NavigationSplitView {
            List(AppSection.allCases, selection: $section) { item in
                Label(item.title, systemImage: item.systemImage)
                    .tag(item)
            }
            .navigationTitle("AI Study")
        } detail: {
            switch section {
            case .home:
                HomeDashboardView(onOpen: { section = $0 })
            case .notebook:
                NotebookLibraryView()
            case .classroom:
                ModulePlaceholderView(title: "教室白板", epic: "Epic 4", note: "白板、上課、AI 講師與重播")
            case .chat:
                ModulePlaceholderView(title: "對話", epic: "Epic 5", note: "多模態 Chat，對齊 chat-view")
            case .quiz:
                ModulePlaceholderView(title: "測驗", epic: "Epic 6", note: "課後小測與檢討")
            case .settings:
                SettingsView()
            }
        }
    }
}

struct ModulePlaceholderView: View {
    let title: String
    let epic: String
    let note: String

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: "hammer.fill")
        } description: {
            Text("\(epic) · \(note)")
        }
    }
}