import Foundation

enum HomeRoute: Hashable {
    case chat(seed: String, context: String)
    case board(seed: String, context: String)
}