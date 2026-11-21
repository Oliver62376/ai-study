import SwiftUI

struct HomeDashboardView: View {
    var onOpen: (AppSection) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("AI 智慧教學")
                    .font(.largeTitle.bold())
                Text("原生 iPad 版 — PencilKit 手寫，功能將完整對等 Web App。")
                    .foregroundStyle(.secondary)

                LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: 12)], spacing: 12) {
                    dashButton("筆記", icon: "book.fill", section: .notebook)
                    NavigationLink(value: AppSection.whiteboard) {
                        tileLabel("白板", icon: "rectangle.and.pencil.and.ellipsis")
                    }
                    .buttonStyle(.plain)
                    dashButton("教室", icon: "chalkboard.fill", section: .classroom)
                    NavigationLink(value: AppSection.chat) {
                        tileLabel("對話", icon: "bubble.left.fill")
                    }
                    .buttonStyle(.plain)
                    dashButton("測驗", icon: "checkmark.circle.fill", section: .quiz)
                }
            }
            .padding(24)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color(.systemGroupedBackground))
    }

    private func dashButton(_ title: String, icon: String, section: AppSection) -> some View {
        Button {
            onOpen(section)
        } label: {
            tileLabel(title, icon: icon)
        }
        .buttonStyle(.plain)
    }

    private func tileLabel(_ title: String, icon: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
            Text(title)
                .font(.headline)
        }
        .frame(maxWidth: .infinity, minHeight: 100)
        .liquidGlassBar(cornerRadius: 16)
    }
}