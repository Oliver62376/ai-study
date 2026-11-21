import SwiftUI

struct LessonsRailView: View {
    var lessons: [NativeLessonRecord]
    var onOpen: (NativeLessonRecord) -> Void
    var onDelete: (NativeLessonRecord) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("我的課")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 12)

            if lessons.isEmpty {
                Text("開課後會出現在這裡")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 12)
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(lessons) { lesson in
                            lessonChip(lesson)
                        }
                    }
                    .padding(.horizontal, 8)
                }
            }
        }
        .frame(width: 220)
        .padding(.vertical, 12)
        .liquidGlassBar(cornerRadius: 16)
    }

    private func lessonChip(_ lesson: NativeLessonRecord) -> some View {
        HStack(spacing: 6) {
            Button {
                onOpen(lesson)
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    Text(lesson.title)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    Text(lesson.mode == .chat ? "Chat" : "白板")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(10)
                .liquidGlassBar(cornerRadius: 12)
            }
            .buttonStyle(.plain)

            Button(role: .destructive) {
                onDelete(lesson)
            } label: {
                Image(systemName: "trash")
                    .font(.caption)
            }
            .buttonStyle(.plain)
        }
    }
}