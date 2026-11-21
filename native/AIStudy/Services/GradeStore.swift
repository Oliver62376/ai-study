import Foundation

enum GradeId: String, CaseIterable, Identifiable, Codable {
    case unspecified, e1, e2, e3, e4, e5, e6
    case j1, j2, j3, h1, h2, h3, u1, u2, u3, u4, u5

    var id: String { rawValue }

    var label: String {
        switch self {
        case .unspecified: "不指定"
        case .e1: "國小一年級"
        case .e2: "國小二年級"
        case .e3: "國小三年級"
        case .e4: "國小四年級"
        case .e5: "國小五年級"
        case .e6: "國小六年級"
        case .j1: "國中一年級"
        case .j2: "國中二年級"
        case .j3: "國中三年級"
        case .h1: "高一"
        case .h2: "高二"
        case .h3: "高三"
        case .u1: "大一"
        case .u2: "大二"
        case .u3: "大三"
        case .u4: "大四"
        case .u5: "大學以上／研究所"
        }
    }

    static var defaultGrade: GradeId { .j2 }
}

enum GradeStore {
    private static let key = "ai-study-grade-v1"

    static var grade: GradeId {
        get {
            guard let raw = UserDefaults.standard.string(forKey: key),
                  let value = GradeId(rawValue: raw) else {
                return .defaultGrade
            }
            return value
        }
        set { UserDefaults.standard.set(newValue.rawValue, forKey: key) }
    }

    static var promptLabel: String {
        "【學生程度】\(grade.label)"
    }
}