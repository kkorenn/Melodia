import Foundation

enum LyricsStatus: String, Codable, Sendable {
    case ok
    case noMatch = "no_match"
    case noLyrics = "no_lyrics"
    case error
}

struct LyricsPayload: Codable, Equatable, Sendable {
    var songID: String
    var provider: String
    var status: LyricsStatus
    var lyrics: String?
    var language: String?
    var copyright: String?
    var trackID: Int?
    var fetchedAt: Int64
    var expiresAt: Int64
    var cached: Bool
    var error: String?

    enum CodingKeys: String, CodingKey {
        case songID = "songId"
        case provider
        case status
        case lyrics
        case language
        case copyright
        case trackID = "trackId"
        case fetchedAt
        case expiresAt
        case cached
        case error
    }

    func markedCached() -> LyricsPayload {
        var copy = self
        copy.cached = true
        return copy
    }
}

struct LyricsCacheEntry: Codable, Sendable {
    var payload: LyricsPayload
    var updatedAt: Int64
}

struct LyricsFetchResult: Sendable {
    var provider: String
    var status: LyricsStatus
    var lyrics: String?
    var language: String?
    var copyright: String?
    var trackID: Int?
    var error: String?
}
