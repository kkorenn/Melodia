import AVFoundation
import AppKit
import Combine
import Foundation

@MainActor
final class MelodiaRuntime: NSObject, ObservableObject {
    enum RepeatMode: String, CaseIterable, Sendable {
        case off
        case all
        case one

        var symbolName: String {
            switch self {
            case .off, .all:
                return "repeat"
            case .one:
                return "repeat.1"
            }
        }

        var label: String {
            switch self {
            case .off:
                return "Repeat Off"
            case .all:
                return "Repeat All"
            case .one:
                return "Repeat One"
            }
        }
    }

    struct LyricsViewState: Sendable {
        var songID: String?
        var loading: Bool
        var payload: LyricsPayload?
        var error: String
    }

    @Published private(set) var layout: MelodiaHomeLayout?
    @Published private(set) var config: MelodiaAppConfig?
    @Published private(set) var startupError: String?
    @Published private(set) var scanError: String?
    @Published private(set) var tracks: [LocalTrack] = []
    @Published var selectedTrackID: LocalTrack.ID?
    @Published var searchQuery: String = ""
    @Published private(set) var isScanning = false
    @Published private(set) var currentTrackID: LocalTrack.ID?
    @Published private(set) var isPlaying = false
    @Published private(set) var currentTime: TimeInterval = 0
    @Published private(set) var duration: TimeInterval = 0
    @Published private(set) var isShuffleEnabled = false
    @Published private(set) var repeatMode: RepeatMode = .off
    @Published private(set) var isMuted = false
    @Published private(set) var lyricsOpen = false
    @Published private(set) var lyricsState = LyricsViewState(
        songID: nil,
        loading: false,
        payload: nil,
        error: ""
    )

    @Published var volume: Double = 0.85 {
        didSet {
            let clamped = min(max(volume, 0), 1)
            if clamped != volume {
                volume = clamped
                return
            }

            if clamped > 0, isMuted {
                isMuted = false
            }
            applyVolume()
        }
    }

    var primaryLibraryDirectory: URL? {
        libraryDirectories().first
    }

    var currentTrack: LocalTrack? {
        guard let currentTrackID else {
            return nil
        }
        return tracks.first(where: { $0.id == currentTrackID })
    }

    var filteredTracks: [LocalTrack] {
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        if query.isEmpty {
            return tracks
        }

        let needle = query.lowercased()
        return tracks.filter { track in
            track.searchableText.contains(needle)
        }
    }

    var queueTracks: [LocalTrack] {
        guard let currentTrackID,
              let currentIndex = tracks.firstIndex(where: { $0.id == currentTrackID }) else {
            return tracks
        }

        let nextStart = tracks.index(after: currentIndex)
        if nextStart >= tracks.endIndex {
            return []
        }

        return Array(tracks[nextStart...])
    }

    private static let lyricsCacheKeyMaxEntries = 160
    private static let lyricsCacheTTLMilliseconds: Int64 = 24 * 60 * 60 * 1000
    private static let lyricsErrorCacheTTLMilliseconds: Int64 = 5 * 60 * 1000

    private var hasStarted = false
    private var audioPlayer: AVAudioPlayer?
    private var progressTimer: Timer?
    private var lyricsLocalCache: [String: LyricsCacheEntry] = [:]
    private var lyricsRequestID = 0
    private var lyricsRefreshTimer: Timer?
    private var lyricsInitialRefreshTimer: Timer?

    override init() {
        super.init()
        bootstrapFilesystem()
        loadLyricsLocalCache()
    }

    func startIfNeeded() {
        guard !hasStarted else {
            return
        }
        hasStarted = true
        scanLibrary()
    }

    func scanLibrary() {
        guard startupError == nil else {
            return
        }

        let directories = libraryDirectories()
        guard !directories.isEmpty else {
            scanError = "Music directory is unavailable."
            return
        }

        isScanning = true
        scanError = nil

        Task {
            do {
                let scannedTracks = try await Task.detached(priority: .userInitiated) {
                    try LocalLibraryScanner.scan(directories: directories)
                }.value

                tracks = scannedTracks

                if selectedTrackID == nil {
                    selectedTrackID = scannedTracks.first?.id
                } else if let selectedTrackID,
                          !scannedTracks.contains(where: { $0.id == selectedTrackID }) {
                    self.selectedTrackID = scannedTracks.first?.id
                }

                if let currentTrackID,
                   !scannedTracks.contains(where: { $0.id == currentTrackID }) {
                    stopPlayback()
                }
            } catch {
                scanError = "Could not scan songs folder: \(error.localizedDescription)"
            }

            isScanning = false
        }
    }

    func playSelectedTrack() {
        if let selectedTrackID {
            play(trackID: selectedTrackID)
            return
        }

        if let firstTrack = filteredTracks.first ?? tracks.first {
            play(trackID: firstTrack.id)
        }
    }

    func play(trackID: LocalTrack.ID) {
        guard let track = tracks.first(where: { $0.id == trackID }) else {
            return
        }

        do {
            let player = try AVAudioPlayer(contentsOf: track.fileURL)
            player.delegate = self
            player.volume = effectiveVolume()
            player.prepareToPlay()
            player.play()

            audioPlayer = player
            isPlaying = true
            currentTrackID = track.id
            selectedTrackID = track.id
            duration = max(0, player.duration)
            currentTime = player.currentTime
            startProgressTimer()
            loadLyricsForCurrentTrack(refresh: false)
            scheduleLyricsRefreshIfNeeded()
        } catch {
            scanError = "Could not play \(track.filename): \(error.localizedDescription)"
            stopPlayback()
        }
    }

    func togglePlayPause() {
        if isPlaying {
            pausePlayback()
            return
        }

        if let audioPlayer {
            if audioPlayer.play() {
                isPlaying = true
                startProgressTimer()
                syncProgress()
            }
            return
        }

        playSelectedTrack()
    }

    func playNext(isAutoAdvance: Bool = false) {
        guard !tracks.isEmpty else {
            return
        }

        let baseID = currentTrackID ?? selectedTrackID ?? tracks.first?.id
        guard let baseID,
              let currentIndex = tracks.firstIndex(where: { $0.id == baseID }) else {
            play(trackID: tracks[0].id)
            return
        }

        if repeatMode == .one {
            play(trackID: baseID)
            return
        }

        if isShuffleEnabled, tracks.count > 1 {
            if let randomIndex = randomTrackIndex(excluding: currentIndex) {
                play(trackID: tracks[randomIndex].id)
                return
            }
        }

        let nextIndex = currentIndex + 1
        if nextIndex < tracks.count {
            play(trackID: tracks[nextIndex].id)
            return
        }

        if repeatMode == .all {
            play(trackID: tracks[0].id)
            return
        }

        if isAutoAdvance {
            finishPlaybackAtEnd()
        }
    }

    func playPrevious() {
        guard !tracks.isEmpty else {
            return
        }

        if currentTime > 3 {
            seek(to: 0)
            return
        }

        let baseID = currentTrackID ?? selectedTrackID ?? tracks.first?.id
        guard let baseID,
              let currentIndex = tracks.firstIndex(where: { $0.id == baseID }) else {
            play(trackID: tracks[0].id)
            return
        }

        if isShuffleEnabled, tracks.count > 1 {
            if let randomIndex = randomTrackIndex(excluding: currentIndex) {
                play(trackID: tracks[randomIndex].id)
                return
            }
        }

        if currentIndex > 0 {
            play(trackID: tracks[currentIndex - 1].id)
            return
        }

        if repeatMode == .all {
            play(trackID: tracks[tracks.count - 1].id)
        } else {
            seek(to: 0)
        }
    }

    func seek(to targetTime: TimeInterval) {
        guard let audioPlayer else {
            return
        }

        let safeDuration = max(audioPlayer.duration, 0)
        let clamped = min(max(0, targetTime), safeDuration)
        audioPlayer.currentTime = clamped
        currentTime = clamped
        duration = safeDuration
    }

    func setVolume(_ value: Double) {
        volume = min(max(value, 0), 1)
    }

    func toggleMute() {
        isMuted.toggle()
        applyVolume()
    }

    func toggleShuffle() {
        isShuffleEnabled.toggle()
    }

    func cycleRepeatMode() {
        switch repeatMode {
        case .off:
            repeatMode = .all
        case .all:
            repeatMode = .one
        case .one:
            repeatMode = .off
        }
    }

    func toggleLyricsPanel() {
        guard currentTrack != nil else {
            lyricsOpen = false
            return
        }

        lyricsOpen.toggle()
        if lyricsOpen {
            loadLyricsForCurrentTrack(refresh: false)
            scheduleLyricsRefreshIfNeeded()
        } else {
            stopLyricsRefreshScheduling()
        }
    }

    func closeLyricsPanel() {
        lyricsOpen = false
        stopLyricsRefreshScheduling()
    }

    func refreshLyrics() {
        loadLyricsForCurrentTrack(refresh: true)
    }

    func openSongsFolder() {
        guard let directory = primaryLibraryDirectory else {
            return
        }
        NSWorkspace.shared.activateFileViewerSelecting([directory])
    }

    func openConfigFile() {
        guard let layout else {
            return
        }
        NSWorkspace.shared.open(layout.configFile)
    }

    private func pausePlayback() {
        audioPlayer?.pause()
        isPlaying = false
        stopProgressTimer()
        syncProgress()
    }

    private func stopPlayback() {
        audioPlayer?.stop()
        audioPlayer = nil
        isPlaying = false
        currentTrackID = nil
        currentTime = 0
        duration = 0
        stopProgressTimer()
        closeLyricsPanel()
        resetLyricsState()
    }

    private func finishPlaybackAtEnd() {
        audioPlayer?.stop()
        isPlaying = false
        stopProgressTimer()
        if let audioPlayer {
            currentTime = max(0, audioPlayer.duration)
            duration = max(0, audioPlayer.duration)
        }
    }

    private func randomTrackIndex(excluding index: Int) -> Int? {
        guard tracks.count > 1 else {
            return nil
        }

        var candidates = Array(tracks.indices)
        candidates.removeAll(where: { $0 == index })
        return candidates.randomElement()
    }

    private func startProgressTimer() {
        stopProgressTimer()

        progressTimer = Timer.scheduledTimer(withTimeInterval: 0.4, repeats: true) { [weak self] _ in
            guard let self else {
                return
            }
            Task { @MainActor [weak self] in
                self?.syncProgress()
            }
        }

        if let progressTimer {
            RunLoop.main.add(progressTimer, forMode: .common)
        }
    }

    private func stopProgressTimer() {
        progressTimer?.invalidate()
        progressTimer = nil
    }

    private func syncProgress() {
        guard let audioPlayer else {
            currentTime = 0
            duration = 0
            return
        }

        currentTime = max(0, audioPlayer.currentTime)
        duration = max(0, audioPlayer.duration)
    }

    private func applyVolume() {
        audioPlayer?.volume = effectiveVolume()
    }

    private func effectiveVolume() -> Float {
        isMuted ? 0 : Float(min(max(volume, 0), 1))
    }

    private func bootstrapFilesystem() {
        do {
            let result = try MelodiaBootstrap.prepare()
            layout = result.layout
            config = result.config
            startupError = nil
        } catch {
            startupError = "Failed to prepare ~/.melodia: \(error.localizedDescription)"
        }
    }

    private func libraryDirectories() -> [URL] {
        var candidates: [URL] = []

        if let configuredPath = config?.musicDir.trimmingCharacters(in: .whitespacesAndNewlines),
           !configuredPath.isEmpty {
            candidates.append(URL(fileURLWithPath: configuredPath, isDirectory: true))
        }

        if let layout {
            candidates.append(layout.musicsDirectory)
            candidates.append(layout.songsDirectory)
        }

        var seen: Set<String> = []
        var uniqueDirectories: [URL] = []
        for url in candidates {
            let normalized = url.standardizedFileURL.path
            if seen.insert(normalized).inserted {
                uniqueDirectories.append(url)
            }
        }

        return uniqueDirectories
    }

    private func resetLyricsState() {
        lyricsState = LyricsViewState(songID: nil, loading: false, payload: nil, error: "")
    }

    private func loadLyricsForCurrentTrack(refresh: Bool) {
        guard let track = currentTrack else {
            resetLyricsState()
            return
        }

        let songID = track.id
        lyricsRequestID += 1
        let requestID = lyricsRequestID
        let cachedPayload = refresh ? nil : cachedLyricsPayload(songID: songID, allowExpired: true)
        let freshPayload = refresh ? nil : cachedLyricsPayload(songID: songID, allowExpired: false)

        if let freshPayload {
            lyricsState = LyricsViewState(songID: songID, loading: false, payload: freshPayload, error: "")
            return
        }

        lyricsState = LyricsViewState(
            songID: songID,
            loading: true,
            payload: lyricsState.songID == songID ? lyricsState.payload ?? cachedPayload : cachedPayload,
            error: ""
        )

        Task {
            do {
                let fetched = try await LyricsService.fetchLyrics(for: track)
                let fetchedAt = currentTimeMilliseconds()
                let expiresAt = fetchedAt + lyricsExpiryMilliseconds(for: fetched.status)

                let payload = LyricsPayload(
                    songID: songID,
                    provider: fetched.provider,
                    status: fetched.status,
                    lyrics: fetched.lyrics,
                    language: fetched.language,
                    copyright: fetched.copyright,
                    trackID: fetched.trackID,
                    fetchedAt: fetchedAt,
                    expiresAt: expiresAt,
                    cached: false,
                    error: fetched.error
                )

                storeLyricsPayload(songID: songID, payload: payload)

                guard requestID == lyricsRequestID else {
                    return
                }

                lyricsState = LyricsViewState(songID: songID, loading: false, payload: payload, error: "")
            } catch {
                let message = (error as NSError).localizedDescription
                let fetchedAt = currentTimeMilliseconds()
                let expiresAt = fetchedAt + Self.lyricsErrorCacheTTLMilliseconds
                let errorPayload = LyricsPayload(
                    songID: songID,
                    provider: "lrclib",
                    status: .error,
                    lyrics: nil,
                    language: nil,
                    copyright: nil,
                    trackID: nil,
                    fetchedAt: fetchedAt,
                    expiresAt: expiresAt,
                    cached: false,
                    error: message
                )

                storeLyricsPayload(songID: songID, payload: errorPayload)

                guard requestID == lyricsRequestID else {
                    return
                }

                let fallbackPayload: LyricsPayload? =
                    (lyricsState.songID == songID ? lyricsState.payload : nil) ??
                    cachedPayload ??
                    errorPayload

                lyricsState = LyricsViewState(
                    songID: songID,
                    loading: false,
                    payload: fallbackPayload,
                    error: message
                )
            }
        }
    }

    private func scheduleLyricsRefreshIfNeeded() {
        stopLyricsRefreshScheduling()

        guard lyricsOpen, currentTrack != nil else {
            return
        }

        lyricsInitialRefreshTimer = Timer.scheduledTimer(withTimeInterval: 1.5, repeats: false) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.loadLyricsForCurrentTrack(refresh: true)
            }
        }

        lyricsRefreshTimer = Timer.scheduledTimer(withTimeInterval: 45, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.loadLyricsForCurrentTrack(refresh: true)
            }
        }

        if let lyricsInitialRefreshTimer {
            RunLoop.main.add(lyricsInitialRefreshTimer, forMode: .common)
        }

        if let lyricsRefreshTimer {
            RunLoop.main.add(lyricsRefreshTimer, forMode: .common)
        }
    }

    private func stopLyricsRefreshScheduling() {
        lyricsInitialRefreshTimer?.invalidate()
        lyricsInitialRefreshTimer = nil

        lyricsRefreshTimer?.invalidate()
        lyricsRefreshTimer = nil
    }

    private func lyricsExpiryMilliseconds(for status: LyricsStatus) -> Int64 {
        status == .error ? Self.lyricsErrorCacheTTLMilliseconds : Self.lyricsCacheTTLMilliseconds
    }

    private func currentTimeMilliseconds() -> Int64 {
        Int64(Date().timeIntervalSince1970 * 1000)
    }

    private func cachedLyricsPayload(songID: String, allowExpired: Bool) -> LyricsPayload? {
        guard let entry = lyricsLocalCache[songID] else {
            return nil
        }

        if !allowExpired {
            let now = currentTimeMilliseconds()
            if entry.payload.expiresAt <= now {
                return nil
            }
        }

        return entry.payload.markedCached()
    }

    private func storeLyricsPayload(songID: String, payload: LyricsPayload) {
        var nextCache = lyricsLocalCache
        nextCache[songID] = LyricsCacheEntry(payload: payload, updatedAt: currentTimeMilliseconds())
        lyricsLocalCache = normalizeLyricsLocalCache(nextCache)
        persistLyricsLocalCache()
    }

    private func normalizeLyricsLocalCache(_ cache: [String: LyricsCacheEntry]) -> [String: LyricsCacheEntry] {
        let normalized = cache
            .sorted { lhs, rhs in
                lhs.value.updatedAt > rhs.value.updatedAt
            }
            .prefix(Self.lyricsCacheKeyMaxEntries)

        var result: [String: LyricsCacheEntry] = [:]
        for (key, value) in normalized {
            result[key] = value
        }
        return result
    }

    private func loadLyricsLocalCache() {
        guard let cacheFile = lyricsCacheFile else {
            lyricsLocalCache = [:]
            return
        }

        guard FileManager.default.fileExists(atPath: cacheFile.path) else {
            lyricsLocalCache = [:]
            return
        }

        do {
            let data = try Data(contentsOf: cacheFile)
            let decoded = try JSONDecoder().decode([String: LyricsCacheEntry].self, from: data)
            lyricsLocalCache = normalizeLyricsLocalCache(decoded)
        } catch {
            lyricsLocalCache = [:]
        }
    }

    private func persistLyricsLocalCache() {
        guard let cacheFile = lyricsCacheFile else {
            return
        }

        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.sortedKeys]
            let data = try encoder.encode(lyricsLocalCache)
            try data.write(to: cacheFile, options: .atomic)
        } catch {
            // no-op
        }
    }

    private var lyricsCacheFile: URL? {
        layout?.rootDirectory.appendingPathComponent("lyrics-cache.json", isDirectory: false)
    }
}

extension MelodiaRuntime: AVAudioPlayerDelegate {
    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor [weak self] in
            self?.playNext(isAutoAdvance: true)
        }
    }
}
