import Foundation

enum LyricsService {
    nonisolated static func fetchLyrics(for track: LocalTrack) async throws -> LyricsFetchResult {
        let searchURLString = "https://lrclib.net/api/search"
        let userAgent = "Melodia-Lyrics/1.0 (+https://github.com)"
        let fallbackTitle = track.fileURL.deletingPathExtension().lastPathComponent
        let title = normalizeTrackQueryValue(track.title.isEmpty ? fallbackTitle : track.title)
        let artist = normalizeTrackQueryValue(track.artist)
        let album = normalizeTrackQueryValue(track.album)

        if title.isEmpty {
            return LyricsFetchResult(
                provider: "lrclib",
                status: .noMatch,
                lyrics: nil,
                language: nil,
                copyright: nil,
                trackID: nil,
                error: nil
            )
        }

        guard var components = URLComponents(string: searchURLString) else {
            throw NSError(
                domain: "MelodiaLyrics",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Invalid LRCLIB URL"]
            )
        }

        var queryItems = [URLQueryItem(name: "track_name", value: title)]
        if !artist.isEmpty {
            queryItems.append(URLQueryItem(name: "artist_name", value: artist))
        }
        if !album.isEmpty {
            queryItems.append(URLQueryItem(name: "album_name", value: album))
        }
        components.queryItems = queryItems

        guard let requestURL = components.url else {
            throw NSError(
                domain: "MelodiaLyrics",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "Failed to build LRCLIB request URL"]
            )
        }

        var request = URLRequest(url: requestURL)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(userAgent, forHTTPHeaderField: "User-Agent")

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NSError(
                domain: "MelodiaLyrics",
                code: 3,
                userInfo: [NSLocalizedDescriptionKey: "Invalid LRCLIB response"]
            )
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw NSError(
                domain: "MelodiaLyrics",
                code: 4,
                userInfo: [NSLocalizedDescriptionKey: "LRCLIB HTTP \(httpResponse.statusCode)"]
            )
        }

        let entries = try parseEntries(from: data)
        guard let match = pickBestMatch(entries: entries, title: title, artist: artist, album: album) else {
            return LyricsFetchResult(
                provider: "lrclib",
                status: .noMatch,
                lyrics: nil,
                language: nil,
                copyright: nil,
                trackID: nil,
                error: nil
            )
        }

        let plainLyrics = trimmedOrNil(match.plainLyrics)
        let syncedLyrics = trimmedOrNil(match.syncedLyrics)
        let lyricsText = plainLyrics ?? syncedLyrics
        guard let lyricsText else {
            return LyricsFetchResult(
                provider: "lrclib",
                status: .noLyrics,
                lyrics: nil,
                language: nil,
                copyright: nil,
                trackID: nil,
                error: nil
            )
        }

        return LyricsFetchResult(
            provider: "lrclib",
            status: .ok,
            lyrics: lyricsText,
            language: nil,
            copyright: nil,
            trackID: nil,
            error: nil
        )
    }

    private struct LrcLibEntry {
        let trackName: String
        let artistName: String
        let albumName: String
        let plainLyrics: String
        let syncedLyrics: String
    }

    private nonisolated static func parseEntries(from data: Data) throws -> [LrcLibEntry] {
        let jsonObject: Any
        do {
            jsonObject = try JSONSerialization.jsonObject(with: data)
        } catch {
            throw NSError(
                domain: "MelodiaLyrics",
                code: 5,
                userInfo: [NSLocalizedDescriptionKey: "LRCLIB returned a non-JSON response"]
            )
        }

        guard let entries = jsonObject as? [[String: Any]] else {
            return []
        }

        return entries.map { entry in
            LrcLibEntry(
                trackName: stringValue(entry["trackName"]),
                artistName: stringValue(entry["artistName"]),
                albumName: stringValue(entry["albumName"]),
                plainLyrics: stringValue(entry["plainLyrics"]),
                syncedLyrics: stringValue(entry["syncedLyrics"])
            )
        }
    }

    private nonisolated static func pickBestMatch(
        entries: [LrcLibEntry],
        title: String,
        artist: String,
        album: String
    ) -> LrcLibEntry? {
        var bestEntry: LrcLibEntry?
        var bestScore = Int.min

        for entry in entries {
            let score = scoreMatch(entry: entry, title: title, artist: artist, album: album)
            if score > bestScore {
                bestScore = score
                bestEntry = entry
            }
        }

        return bestEntry
    }

    private nonisolated static func scoreMatch(
        entry: LrcLibEntry,
        title: String,
        artist: String,
        album: String
    ) -> Int {
        var score = 0
        let normalizedTitle = normalizeLooseText(title)
        let normalizedArtist = normalizeLooseText(artist)
        let normalizedAlbum = normalizeLooseText(album)
        let entryTitle = normalizeLooseText(entry.trackName)
        let entryArtist = normalizeLooseText(entry.artistName)
        let entryAlbum = normalizeLooseText(entry.albumName)

        if !normalizedTitle.isEmpty && !entryTitle.isEmpty {
            if entryTitle == normalizedTitle {
                score += 6
            } else if entryTitle.contains(normalizedTitle) || normalizedTitle.contains(entryTitle) {
                score += 3
            }
        }

        if !normalizedArtist.isEmpty && !entryArtist.isEmpty {
            if entryArtist == normalizedArtist {
                score += 6
            } else if entryArtist.contains(normalizedArtist) || normalizedArtist.contains(entryArtist) {
                score += 3
            }
        }

        if !normalizedAlbum.isEmpty && !entryAlbum.isEmpty {
            if entryAlbum == normalizedAlbum {
                score += 3
            } else if entryAlbum.contains(normalizedAlbum) || normalizedAlbum.contains(entryAlbum) {
                score += 1
            }
        }

        if trimmedOrNil(entry.plainLyrics) != nil || trimmedOrNil(entry.syncedLyrics) != nil {
            score += 1
        }

        return score
    }

    private nonisolated static func normalizeTrackQueryValue(_ value: String?) -> String {
        let trimmed = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return ""
        }
        return trimmed.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }

    private nonisolated static func normalizeLooseText(_ value: String?) -> String {
        let source = (value ?? "").lowercased()
        guard !source.isEmpty else {
            return ""
        }

        var scalars: [UnicodeScalar] = []
        scalars.reserveCapacity(source.unicodeScalars.count)
        var lastWasSpace = false

        for scalar in source.unicodeScalars {
            let isAlphaNumeric =
                CharacterSet.letters.contains(scalar) ||
                CharacterSet.decimalDigits.contains(scalar)
            if isAlphaNumeric {
                scalars.append(scalar)
                lastWasSpace = false
            } else if !lastWasSpace {
                scalars.append(UnicodeScalar(32))
                lastWasSpace = true
            }
        }

        let normalized = String(String.UnicodeScalarView(scalars))
        return normalized.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private nonisolated static func trimmedOrNil(_ value: String?) -> String? {
        let trimmed = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private nonisolated static func stringValue(_ value: Any?) -> String {
        switch value {
        case let string as String:
            return string
        case let number as NSNumber:
            return number.stringValue
        default:
            return ""
        }
    }
}
