import SwiftUI

struct SettingsView: View {
    private var ai = AISettingsStore.shared

    @State private var apiKey = ""
    @State private var baseURL = ""
    @State private var model = ""

    var body: some View {
        Form {
            Section("AI（筆記面板）") {
                SecureField("API 金鑰", text: $apiKey)
                TextField("API Base URL", text: $baseURL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                TextField("模型名稱", text: $model)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                LabeledContent("狀態", value: ai.isConnected ? "已連線" : "未設定金鑰")
            }
            Section("Apple Pencil") {
                Text("雙擊工具列可換工具列底色；筆工具二次點擊可調粗細。")
                    .foregroundStyle(.secondary)
                    .font(.footnote)
            }
            Section("關於") {
                LabeledContent("版本", value: "0.2.4-beta")
                LabeledContent("平台", value: "iPadOS 17+")
            }
        }
        .navigationTitle("設定")
        .onAppear {
            apiKey = ai.apiKey
            baseURL = ai.baseURL
            model = ai.model
        }
        .onDisappear {
            ai.apiKey = apiKey
            ai.baseURL = baseURL
            ai.model = model
        }
    }
}