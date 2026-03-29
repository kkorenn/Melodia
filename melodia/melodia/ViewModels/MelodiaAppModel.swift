import AVFoundation
import Combine
import Foundation
import SwiftUI

enum RootTab: Hashable {
    case library
    case search
    case nowPlaying
}

@MainActor
final class MelodiaAppModel: ObservableObject {
    @AppStorage("melodia.serverURL") private var savedServerURL = ""
    @AppStorage("melodia.playerVolume") private var savedPlayerVolume = 0.9

    @Published var selectedTab: RootTab = .library
    @Published var serverURLDraft = ""
    @Published var searchQuery = ""

    @Published private(set) var librarySongs: [Song] = []
    @Published private(set) var libraryStats: LibraryStats?
    @Published private(set) var searchPayload: SearchPayload = .empty
    @Published private(set) var playlists: [PlaylistSummary] = []
    @Published private(set) var isLoadingPlaylistSongs = false

    @Published private(set) var isLoadingLibrary = true
    @Published private(set) var isHydratingLibrary = false
    @Published private(set) var isSearching = false
    @Published private(set) var isPlaying = false
    @Published private(set) var currentTime: TimeInterval = 0
    @Published private(set) var totalTime: TimeInterval = 0
    @Published private(set) var nowPlayingTheme: NowPlayingTheme = .default
    @Published private(set) var playbackVolume: Double = 0.9

    @Published var libraryError: String?
    @Published var searchError: String?
    @Published var playerError: String?
    @Published var playlistError: String?
    @Published private(set) var currentSong: Song?

    private let player = AVPlayer()
    private var timeObserverToken: Any?
    private var itemEndObserver: NSObjectProtocol?
    private var searchTask: Task<Void, Never>?
    private var backgroundSongLoadTask: Task<Void, Never>?
    private var artworkThemeTask: Task<Void, Never>?
    private var playlistSongsCache: [Int: [Song]] = [:]
    private var bootstrapped = false
    private var refreshGeneration = UUID()

    init() {
        serverURLDraft = savedServerURL
        playbackVolume = min(max(savedPlayerVolume, 0), 1)
        player.volume = Float(playbackVolume)
        configurePlayerObservers()
    }

    deinit {
        if let timeObserverToken {
            player.removeTimeObserver(timeObserverToken)
        }

        if let itemEndObserver {
            NotificationCenter.default.removeObserver(itemEndObserver)
        }

        searchTask?.cancel()
        backgroundSongLoadTask?.cancel()
        artworkThemeTask?.cancel()
    }

    var currentServerURL: String {
        savedServerURL
    }

    var hasServerURLConfigured: Bool {
        !savedServerURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var playbackProgress: Double {
        guard totalTime > 0 else { return 0 }
        return min(max(currentTime / totalTime, 0), 1)
    }

    func bootstrapIfNeeded() async {
        guard !bootstrapped else { return }
        bootstrapped = true
        await refreshLibrary()
    }

    func refreshLibrary() async {
        guard let apiClient else {
            librarySongs = []
            libraryStats = nil
            playlists = []
            isLoadingLibrary = false
            libraryError = "Enter a valid server URL in Settings."
            return
        }

        backgroundSongLoadTask?.cancel()
        refreshGeneration = UUID()
        let generation = refreshGeneration

        isLoadingLibrary = true
        isHydratingLibrary = false
        libraryError = nil

        do {
            async let firstPageTask = apiClient.fetchSongsPage(limit: 80, offset: 0)
            async let statsTask = apiClient.fetchStats()
            async let playlistsTask = apiClient.fetchPlaylists()

            let firstPage = try await firstPageTask
            guard generation == refreshGeneration else { return }

            librarySongs = firstPage.rows
            isLoadingLibrary = false

            do {
                libraryStats = try await statsTask
            } catch {
                libraryStats = nil
            }

            do {
                playlists = try await playlistsTask
            } catch {
                playlists = []
            }

            let total = firstPage.total ?? firstPage.rows.count
            let hasMore = firstPage.hasMore ?? (librarySongs.count < total)
            if hasMore {
                isHydratingLibrary = true
                backgroundSongLoadTask = Task { [weak self] in
                    await self?.loadRemainingSongs(
                        apiClient: apiClient,
                        generation: generation,
                        startOffset: firstPage.rows.count,
                        total: total
                    )
                }
            }
        } catch {
            guard generation == refreshGeneration else { return }

            isLoadingLibrary = false
            isHydratingLibrary = false
            libraryError = error.localizedDescription
            if librarySongs.isEmpty {
                libraryStats = nil
                playlists = []
            }
        }
    }

    func scheduleSearch(for query: String) {
        searchTask?.cancel()
        searchError = nil

        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            isSearching = false
            searchPayload = .empty
            return
        }

        searchTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled else { return }
            await self?.performSearch(query: trimmed)
        }
    }

    func loadPlaylistSongs(playlistID: Int, forceReload: Bool = false) async {
        if playlistSongsCache[playlistID] != nil, !forceReload {
            playlistError = nil
            return
        }

        guard let apiClient else {
            playlistError = "Server URL is not configured."
            return
        }

        isLoadingPlaylistSongs = true
        playlistError = nil

        do {
            let rows = try await apiClient.fetchPlaylistSongs(playlistID: playlistID)
            playlistSongsCache[playlistID] = rows
        } catch {
            playlistError = error.localizedDescription
        }

        isLoadingPlaylistSongs = false
    }

    func songsForPlaylist(playlistID: Int) -> [Song] {
        playlistSongsCache[playlistID] ?? []
    }

    func play(song: Song) {
        guard let apiClient else {
            playerError = "Enter a valid server URL in Settings first."
            return
        }

        playerError = nil
        currentSong = song
        currentTime = 0
        totalTime = 0

        let streamURL = apiClient.streamURL(for: song.id)
        let item = AVPlayerItem(url: streamURL)
        player.replaceCurrentItem(with: item)
        player.play()
        isPlaying = true
        selectedTab = .nowPlaying

        Task {
            await markSongPlayed(songID: song.id)
        }

        artworkThemeTask?.cancel()
        artworkThemeTask = Task { [weak self] in
            await self?.updateTheme(for: song)
        }
    }

    func togglePlayback() {
        if isPlaying {
            player.pause()
            isPlaying = false
        } else {
            player.play()
            isPlaying = true
        }
    }

    func seek(by seconds: Double) {
        let current = player.currentTime().seconds
        let safeCurrent = current.isFinite ? current : 0

        let maximum = totalTime > 0 ? totalTime : safeCurrent + abs(seconds)
        let target = min(max(safeCurrent + seconds, 0), maximum)

        player.seek(to: CMTime(seconds: target, preferredTimescale: 600))
        currentTime = target
    }

    func setPlaybackVolume(_ value: Double) {
        let clamped = min(max(value, 0), 1)
        playbackVolume = clamped
        savedPlayerVolume = clamped
        player.volume = Float(clamped)
    }

    func playNextSong() {
        guard
            let currentSong,
            let currentIndex = librarySongs.firstIndex(where: { $0.id == currentSong.id }),
            currentIndex + 1 < librarySongs.count
        else {
            return
        }

        play(song: librarySongs[currentIndex + 1])
    }

    func playPreviousSong() {
        guard
            let currentSong,
            let currentIndex = librarySongs.firstIndex(where: { $0.id == currentSong.id }),
            currentIndex > 0
        else {
            seek(by: -15)
            return
        }

        play(song: librarySongs[currentIndex - 1])
    }

    func saveServerURL(_ rawValue: String) -> String? {
        guard let normalized = Self.normalizedServerURLString(from: rawValue) else {
            return "Use a valid URL like http://192.168.1.10:4872"
        }

        savedServerURL = normalized
        serverURLDraft = normalized
        libraryError = nil
        searchError = nil
        playerError = nil
        playlistError = nil
        return nil
    }

    func reconnectToServer() async {
        playlistSongsCache = [:]
        await refreshLibrary()

        let activeQuery = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        if !activeQuery.isEmpty {
            await performSearch(query: activeQuery)
        }
    }

    func artworkURL(for songID: Int?) -> URL? {
        guard let songID, let apiClient else { return nil }
        return apiClient.artworkURL(for: songID)
    }

    static func normalizedServerURLString(from rawValue: String) -> String? {
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        let candidate = trimmed.contains("://") ? trimmed : "http://\(trimmed)"
        guard var components = URLComponents(string: candidate) else { return nil }

        guard
            let scheme = components.scheme?.lowercased(),
            scheme == "http" || scheme == "https",
            let host = components.host,
            !host.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            return nil
        }

        components.scheme = scheme

        guard var normalized = components.url?.absoluteString else { return nil }
        while normalized.count > 1 && normalized.hasSuffix("/") {
            normalized.removeLast()
        }

        return normalized
    }

    private var apiClient: MelodiaAPIClient? {
        guard let serverURL = Self.normalizedServerURLString(from: savedServerURL),
              let url = URL(string: serverURL)
        else {
            return nil
        }

        return MelodiaAPIClient(baseURL: url)
    }

    private func performSearch(query: String) async {
        guard let apiClient else {
            searchPayload = .empty
            searchError = "Enter a valid server URL in Settings."
            return
        }

        isSearching = true

        do {
            let payload = try await apiClient.search(query: query)
            guard !Task.isCancelled else { return }

            let currentQuery = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
            if currentQuery == query {
                searchPayload = payload
                searchError = nil
            }
        } catch {
            guard !Task.isCancelled else { return }

            let currentQuery = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
            if currentQuery == query {
                searchPayload = .empty
                searchError = error.localizedDescription
            }
        }

        isSearching = false
    }

    private func loadRemainingSongs(
        apiClient: MelodiaAPIClient,
        generation: UUID,
        startOffset: Int,
        total: Int
    ) async {
        defer { isHydratingLibrary = false }
        var offset = startOffset
        let pageSize = 220

        while offset < total, !Task.isCancelled {
            do {
                let page = try await apiClient.fetchSongsPage(limit: pageSize, offset: offset)
                guard generation == refreshGeneration else { return }

                let rows = page.rows
                if rows.isEmpty { return }

                librarySongs.append(contentsOf: rows)
                offset += rows.count

                if let hasMore = page.hasMore, !hasMore {
                    return
                }
            } catch {
                return
            }
        }
    }

    private func markSongPlayed(songID: Int) async {
        guard let apiClient else { return }
        await apiClient.markPlayed(songID: songID)
    }

    private func updateTheme(for song: Song) async {
        guard let artworkURL = artworkURL(for: song.id) else {
            await MainActor.run {
                nowPlayingTheme = .default
            }
            return
        }

        if let dynamicTheme = await ArtworkPaletteExtractor.shared.theme(for: artworkURL) {
            await MainActor.run {
                nowPlayingTheme = dynamicTheme
            }
        } else {
            await MainActor.run {
                nowPlayingTheme = .default
            }
        }
    }

    private func configurePlayerObservers() {
        let interval = CMTime(seconds: 0.5, preferredTimescale: 600)
        timeObserverToken = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            guard let self else { return }
            let durationSeconds = self.player.currentItem?.duration.seconds ?? 0
            let currentSeconds = time.seconds
            let playing = self.player.rate > 0

            Task { @MainActor [weak self] in
                guard let self else { return }
                self.currentTime = currentSeconds.isFinite ? max(0, currentSeconds) : 0

                if durationSeconds.isFinite, durationSeconds > 0 {
                    self.totalTime = durationSeconds
                } else {
                    self.totalTime = 0
                }

                self.isPlaying = playing
            }
        }

        itemEndObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.isPlaying = false
                self.currentTime = self.totalTime
            }
        }
    }
}
