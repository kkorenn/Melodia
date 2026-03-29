import Foundation

private extension KeyedDecodingContainer {
    func decodeFlexibleIntIfPresent(forKey key: Key) throws -> Int? {
        if let value = try decodeIfPresent(Int.self, forKey: key) {
            return value
        }

        if let value = try decodeIfPresent(Double.self, forKey: key) {
            return Int(value)
        }

        if let value = try decodeIfPresent(String.self, forKey: key) {
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            if let asInt = Int(trimmed) {
                return asInt
            }
            if let asDouble = Double(trimmed) {
                return Int(asDouble)
            }
        }

        return nil
    }

    func decodeFlexibleDoubleIfPresent(forKey key: Key) throws -> Double? {
        if let value = try decodeIfPresent(Double.self, forKey: key) {
            return value
        }

        if let value = try decodeIfPresent(Int.self, forKey: key) {
            return Double(value)
        }

        if let value = try decodeIfPresent(String.self, forKey: key) {
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            return Double(trimmed)
        }

        return nil
    }
}

struct Song: Decodable, Identifiable, Hashable {
    let id: Int
    let path: String?
    let filename: String?
    let title: String?
    let artist: String?
    let album: String?
    let albumArtist: String?
    let trackNumber: Int?
    let duration: Double?
    let playCount: Int?
    let lastPlayed: Double?
    let hasArt: Int?

    private enum CodingKeys: String, CodingKey {
        case id
        case path
        case filename
        case title
        case artist
        case album
        case albumArtist
        case trackNumber
        case duration
        case playCount
        case lastPlayed
        case hasArt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = (try container.decodeFlexibleIntIfPresent(forKey: .id)) ?? 0
        path = try container.decodeIfPresent(String.self, forKey: .path)
        filename = try container.decodeIfPresent(String.self, forKey: .filename)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        artist = try container.decodeIfPresent(String.self, forKey: .artist)
        album = try container.decodeIfPresent(String.self, forKey: .album)
        albumArtist = try container.decodeIfPresent(String.self, forKey: .albumArtist)
        trackNumber = try container.decodeFlexibleIntIfPresent(forKey: .trackNumber)
        duration = try container.decodeFlexibleDoubleIfPresent(forKey: .duration)
        playCount = try container.decodeFlexibleIntIfPresent(forKey: .playCount)
        lastPlayed = try container.decodeFlexibleDoubleIfPresent(forKey: .lastPlayed)
        hasArt = try container.decodeFlexibleIntIfPresent(forKey: .hasArt)
    }

    var displayTitle: String {
        let candidate = title?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let candidate, !candidate.isEmpty {
            return candidate
        }

        let fallback = filename?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let fallback, !fallback.isEmpty {
            return fallback
        }

        return "Unknown Track"
    }

    var displayArtist: String {
        let candidate = artist?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let candidate, !candidate.isEmpty {
            return candidate
        }
        return "Unknown Artist"
    }

    var displayAlbum: String {
        let candidate = album?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let candidate, !candidate.isEmpty {
            return candidate
        }
        return "Unknown Album"
    }

    var hasArtwork: Bool {
        (hasArt ?? 0) > 0
    }

    var durationText: String {
        MelodiaFormat.trackDuration(duration)
    }
}

struct LibraryStats: Decodable, Equatable {
    let totalSongs: Int
    let totalArtists: Int
    let totalAlbums: Int
    let totalDuration: Double

    private enum CodingKeys: String, CodingKey {
        case totalSongs
        case totalArtists
        case totalAlbums
        case totalDuration
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        totalSongs = (try container.decodeFlexibleIntIfPresent(forKey: .totalSongs)) ?? 0
        totalArtists = (try container.decodeFlexibleIntIfPresent(forKey: .totalArtists)) ?? 0
        totalAlbums = (try container.decodeFlexibleIntIfPresent(forKey: .totalAlbums)) ?? 0
        totalDuration = (try container.decodeFlexibleDoubleIfPresent(forKey: .totalDuration)) ?? 0
    }
}

struct ArtistSearchHit: Decodable, Hashable, Identifiable {
    let artist: String
    let songCount: Int
    let artSongId: Int?

    private enum CodingKeys: String, CodingKey {
        case artist
        case songCount
        case artSongId
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        artist = (try container.decodeIfPresent(String.self, forKey: .artist)) ?? "Unknown Artist"
        songCount = (try container.decodeFlexibleIntIfPresent(forKey: .songCount)) ?? 0
        artSongId = try container.decodeFlexibleIntIfPresent(forKey: .artSongId)
    }

    var id: String {
        artist
    }
}

struct AlbumSearchHit: Decodable, Hashable, Identifiable {
    let album: String
    let albumArtist: String
    let songCount: Int
    let artSongId: Int?

    private enum CodingKeys: String, CodingKey {
        case album
        case albumArtist
        case songCount
        case artSongId
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        album = (try container.decodeIfPresent(String.self, forKey: .album)) ?? "Unknown Album"
        albumArtist = (try container.decodeIfPresent(String.self, forKey: .albumArtist)) ?? "Unknown Artist"
        songCount = (try container.decodeFlexibleIntIfPresent(forKey: .songCount)) ?? 0
        artSongId = try container.decodeFlexibleIntIfPresent(forKey: .artSongId)
    }

    var id: String {
        "\(album)|\(albumArtist)"
    }
}

struct SearchPayload: Decodable, Equatable {
    let query: String
    let songs: [Song]
    let artists: [ArtistSearchHit]
    let albums: [AlbumSearchHit]

    private enum CodingKeys: String, CodingKey {
        case query
        case songs
        case artists
        case albums
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        query = (try container.decodeIfPresent(String.self, forKey: .query)) ?? ""
        songs = (try container.decodeIfPresent([Song].self, forKey: .songs)) ?? []
        artists = (try container.decodeIfPresent([ArtistSearchHit].self, forKey: .artists)) ?? []
        albums = (try container.decodeIfPresent([AlbumSearchHit].self, forKey: .albums)) ?? []
    }

    static let empty = SearchPayload(
        query: "",
        songs: [],
        artists: [],
        albums: []
    )

    init(query: String, songs: [Song], artists: [ArtistSearchHit], albums: [AlbumSearchHit]) {
        self.query = query
        self.songs = songs
        self.artists = artists
        self.albums = albums
    }
}

struct SongsResponse: Decodable {
    let rows: [Song]
    let offset: Int?
    let limit: Int?
    let total: Int?
    let hasMore: Bool?
}

struct PlaylistSummary: Decodable, Hashable, Identifiable {
    let id: Int
    let name: String
    let createdAt: Double?
    let updatedAt: Double?
    let songCount: Int
    let hasCustomArt: Bool
    let fallbackArtSongId: Int?

    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case createdAt
        case updatedAt
        case songCount
        case hasCustomArt
        case fallbackArtSongId
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = (try container.decodeFlexibleIntIfPresent(forKey: .id)) ?? 0
        name = (try container.decodeIfPresent(String.self, forKey: .name)) ?? "Untitled Playlist"
        createdAt = try container.decodeFlexibleDoubleIfPresent(forKey: .createdAt)
        updatedAt = try container.decodeFlexibleDoubleIfPresent(forKey: .updatedAt)
        songCount = (try container.decodeFlexibleIntIfPresent(forKey: .songCount)) ?? 0
        hasCustomArt = ((try container.decodeFlexibleIntIfPresent(forKey: .hasCustomArt)) ?? 0) > 0
        fallbackArtSongId = try container.decodeFlexibleIntIfPresent(forKey: .fallbackArtSongId)
    }
}

struct PlaylistsResponse: Decodable {
    let rows: [PlaylistSummary]
}

struct PlaylistSongsResponse: Decodable {
    let rows: [Song]
}
