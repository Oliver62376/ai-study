import SwiftUI

struct ClassBoardView: View {
    let seedTopic: String
    let context: String

    @State private var planText = ""
    @State private var loading = false
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(seedTopic)
                    .font(.title2.bold())

                if loading {
                    ProgressView("AI 備課中…")
                } else if !planText.isEmpty {
                    Text(planText)
                        .font(.body)
                        .textSelection(.enabled)
                } else {
                    Text("按下方開始備課，或先進白板草稿。")
                        .foregroundStyle(.secondary)
                }

                HStack(spacing: 12) {
                    Button("AI 備課") { Task { await generatePlan() } }
                        .buttonStyle(.borderedProminent)
                        .disabled(loading)
                    NavigationLink {
                        WhiteboardView(seedTopic: seedTopic)
                    } label: {
                        Text("開啟白板")
                    }
                    .buttonStyle(.bordered)
                }
            }
            .padding(24)
            .frame(maxWidth: 720, alignment: .leading)
        }
        .navigationTitle("白板課程")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            LessonStore.upsert(title: seedTopic, topic: context.isEmpty ? seedTopic : context, mode: .board)
        }
    }

    private func generatePlan() async {
        loading = true
        defer { loading = false }
        let system = """
        你是白板老師。依學生程度與主題，列出 5 個教學步驟與板書重點。用繁體中文，不要用 Markdown。
        \(GradeStore.promptLabel)
        """
        do {
            planText = try await ProviderAIService.ask(
                question: seedTopic,
                context: context,
                system: system
            )
        } catch {
            planText = error.localizedDescription
        }
    }
}