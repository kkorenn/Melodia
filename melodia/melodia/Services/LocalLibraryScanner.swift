import AVFoundation
import CoreMedia
import Foundation

enum LocalLibraryScanner {
    nonisolated private static let supportedExtensions: Set<String> = [
        "mp3",
        "m4a",
        "aac",
        "wav",
        "aif",
        "aiff",
        "caf",
        "flac"
    ]

    nonisolated static func scan(directory: URL, fileManager: FileManager = .default) throws -> [LocalTrack] {
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)

        guard let enumerator = fileManager.enumerator(
            at: directory,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles, .skipsPackageDescendants]
        ) else {
            return []
        }

        var tracks: [LocalTrack] = []

        for case let fileURL as URL in enumerator {
            let values = try fileURL.resourceValues(forKeys: [.isRegularFileKey])
            guard values.isRegularFile == true else {
                continue
            }

            let fileExtension = fileURL.pathExtension.lowercased()
            guard supportedExtensions.contains(fileExtension) else {
                continue
            }

            tracks.append(buildTrack(for: fileURL))
        }

        return sort(tracks)
    }

    nonisolated static func scan(directories: [URL], fileManager: FileManager = .default) throws -> [LocalTrack] {
        var tracksByID: [LocalTrack.ID: LocalTrack] = [:]
        for directory in directories {
            let scannedTracks = try scan(directory: directory, fileManager: fileManager)
            for track in scannedTracks {
                tracksByID[track.id] = track
            }
        }
        return sort(Array(tracksByID.values))
    }

    nonisolated private static func buildTrack(for fileURL: URL) -> LocalTrack {
        let asset = AVURLAsset(url: fileURL)
        let metadata = asset.commonMetadata

        let fallbackTitle = fileURL.deletingPathExtension().lastPathComponent
        let title = metadataValue(for: .commonKeyTitle, in: metadata) ?? fallbackTitle
        let artist = metadataValue(for: .commonKeyArtist, in: metadata)
        let album = metadataValue(for: .commonKeyAlbumName, in: metadata)
        let artworkData = metadataArtwork(in: metadata)

        let rawDuration = CMTimeGetSeconds(asset.duration)
        let duration = rawDuration.isFinite && rawDuration > 0 ? rawDuration : nil

        return LocalTrack(
            id: fileURL.path,
            fileURL: fileURL,
            filename: fileURL.lastPathComponent,
            title: title,
            artist: artist,
            album: album,
            duration: duration,
            artworkData: artworkData
        )
    }

    nonisolated private static func metadataValue(for commonKey: AVMetadataKey, in items: [AVMetadataItem]) -> String? {
        for item in items where item.commonKey == commonKey {
            guard let value = item.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
                continue
            }
            return value
        }
        return nil
    }

    nonisolated private static func metadataArtwork(in items: [AVMetadataItem]) -> Data? {
        for item in items where item.commonKey == .commonKeyArtwork {
            if let data = item.dataValue, !data.isEmpty {
                return data
            }

            if let data = item.value as? Data, !data.isEmpty {
                return data
            }
        }
        return nil
    }

    nonisolated private static func sort(_ tracks: [LocalTrack]) -> [LocalTrack] {
        tracks.sorted { lhs, rhs in
            let leftTitle = lhs.title.lowercased()
            let rightTitle = rhs.title.lowercased()
            if leftTitle == rightTitle {
                return lhs.filename.lowercased() < rhs.filename.lowercased()
            }
            return leftTitle < rightTitle
        }
    }
}
