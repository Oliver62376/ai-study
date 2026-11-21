import SwiftUI

struct PomodoroView: View {
    @Environment(\.dismiss) private var dismiss
    @Bindable private var clock = PomodoroClock.shared
    @State private var settings = PomodoroSettingsStore.settings

    var body: some View {
        NavigationStack {
            ZStack {
                HomeAuroraBackground()
                VStack(spacing: 28) {
                    Text(clock.phase.title)
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(phaseColor)
                    progressRing
                    Text(timeText)
                        .font(.system(size: 56, weight: .light, design: .rounded))
                        .monospacedDigit()
                    sessionRow
                    controlRow
                    settingsStrip
                }
                .padding(28)
            }
            .navigationTitle("番茄鐘")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("關閉") { dismiss() }
                }
            }
        }
        .onDisappear {
            PomodoroSettingsStore.settings = settings
        }
    }

    private var phaseColor: Color {
        switch clock.phase {
        case .focus: Color(red: 0.92, green: 0.28, blue: 0.25)
        case .shortBreak, .longBreak: Color(red: 0.2, green: 0.62, blue: 0.45)
        case .idle: Color.secondary
        }
    }

    private var timeText: String {
        let m = clock.remainingSeconds / 60
        let s = clock.remainingSeconds % 60
        return String(format: "%02d:%02d", m, s)
    }

    private var progressRing: some View {
        ZStack {
            Circle()
                .stroke(Color.primary.opacity(0.08), lineWidth: 14)
            Circle()
                .trim(from: 0, to: clock.progress)
                .stroke(phaseColor, style: StrokeStyle(lineWidth: 14, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.linear(duration: 0.25), value: clock.progress)
            Image(systemName: clock.phase == .focus ? "brain.head.profile" : "cup.and.saucer.fill")
                .font(.system(size: 44))
                .foregroundStyle(phaseColor.opacity(0.85))
        }
        .frame(width: 220, height: 220)
    }

    private var sessionRow: some View {
        HStack(spacing: 8) {
            Text("今日完成")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text("\(clock.sessionsToday)")
                .font(.title3.weight(.bold))
            Spacer()
            HStack(spacing: 6) {
                ForEach(0 ..< PomodoroSettingsStore.settings.roundsUntilLongBreak, id: \.self) { i in
                    Circle()
                        .fill(i < clock.focusStreakInCycle ? phaseColor : Color.primary.opacity(0.12))
                        .frame(width: 10, height: 10)
                }
            }
        }
        .frame(maxWidth: 360)
    }

    private var controlRow: some View {
        HStack(spacing: 16) {
            Button("重設") { clock.reset() }
                .buttonStyle(.bordered)
            Button(clock.isRunning ? "暫停" : "開始") {
                if clock.isRunning {
                    clock.pause()
                } else {
                    clock.start()
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(phaseColor)
            Button("跳過") { clock.skip() }
                .buttonStyle(.bordered)
                .disabled(clock.phase == .idle && !clock.isRunning)
        }
    }

    private var settingsStrip: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("計時設定")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
            HStack {
                Stepper("專注 \(settings.workMinutes) 分", value: $settings.workMinutes, in: 5 ... 90, step: 5)
            }
            HStack {
                Stepper("短休 \(settings.shortBreakMinutes) 分", value: $settings.shortBreakMinutes, in: 1 ... 30)
            }
            HStack {
                Stepper("長休 \(settings.longBreakMinutes) 分", value: $settings.longBreakMinutes, in: 5 ... 45, step: 5)
            }
            Toggle("休息後自動開始下一輪專注", isOn: $settings.autoStartFocus)
            Toggle("專注結束自動開始休息", isOn: $settings.autoStartBreaks)
        }
        .font(.subheadline)
        .padding(16)
        .liquidGlassBar(cornerRadius: 20)
        .frame(maxWidth: 420)
    }
}

struct PomodoroToolbarButton: View {
    @Bindable private var clock = PomodoroClock.shared
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: "timer")
                    .font(.body.weight(.semibold))
                if clock.isRunning || clock.phase != .idle {
                    Text(clock.compactLabel)
                        .font(.caption.weight(.semibold))
                        .monospacedDigit()
                }
            }
            .foregroundStyle(clock.phase == .focus && clock.isRunning ? Color(red: 0.92, green: 0.28, blue: 0.25) : .primary)
            .padding(.horizontal, clock.compactLabel.isEmpty ? 0 : 10)
            .frame(minWidth: 44, minHeight: 44)
            .liquidGlassBar(cornerRadius: 14)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("番茄鐘")
    }
}