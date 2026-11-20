import SwiftUI

struct SettingsView: View {
    var body: some View {
        Form {
            Section("AI 供應商") {
                Text("Epic 2：Keychain 金鑰與多 Provider（對齊 Web settings.ts）")
                    .foregroundStyle(.secondary)
            }
            Section("Apple Pencil") {
                Text("Epic 1：筆按鈕、雙擊工具映射")
                    .foregroundStyle(.secondary)
            }
            Section("關於") {
                LabeledContent("版本", value: "0.1.0-native-skeleton")
                LabeledContent("平台", value: "iPadOS 17+")
            }
        }
        .navigationTitle("設定")
    }
}