import Foundation

struct LocalTrack: Identifiable, Hashable, Sendable {
    typealias ID = String

    let id: ID
    let fileURL: URL
    let filename: String
    let title: String
    let artist: String?
    let album: String?
    let duration: TimeInterval?
    let artworkData: Data?

    var searchableText: String {
        [title, artist, album, filename]
            .compactMap { $0?.lowercased() }
            .joined(separator: " ")
    }
}
