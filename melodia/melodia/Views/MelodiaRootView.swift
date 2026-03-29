import SwiftUI

struct ContentView: View {
    @StateObject private var appModel = MelodiaAppModel()

    var body: some View {
        TabView(selection: $appModel.selectedTab) {
            LibraryScreen()
                .tabItem {
                    Label("Library", systemImage: "music.note.list")
                }
                .tag(RootTab.library)

            SearchScreen()
                .tabItem {
                    Label("Search", systemImage: "magnifyingglass")
                }
                .tag(RootTab.search)

            NowPlayingScreen()
                .tabItem {
                    Label("Now Playing", systemImage: "play.circle")
                }
                .tag(RootTab.nowPlaying)
        }
        .environmentObject(appModel)
        .task {
            await appModel.bootstrapIfNeeded()
        }
    }
}

private struct LibraryScreen: View {
    @EnvironmentObject private var appModel: MelodiaAppModel
    @State private var showingServerSheet = false

    var body: some View {
        NavigationStack {
            Group {
                if appModel.isLoadingLibrary, appModel.librarySongs.isEmpty {
                    VStack(spacing: 14) {
                        ProgressView()
                        Text("Connecting to your Melodia server...")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)

                        Button("Connection Settings") {
                            showingServerSheet = true
                        }
                        .buttonStyle(.bordered)
                    }
                } else if let error = appModel.libraryError, appModel.librarySongs.isEmpty {
                    ContentUnavailableView(
                        "Could not load library",
                        systemImage: "wifi.exclamationmark",
                        description: Text(error)
                    )
                } else if appModel.librarySongs.isEmpty {
                    VStack(spacing: 14) {
                        ProgressView()
                        Text("Preparing your library...")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Button("Refresh") {
                            Task {
                                await appModel.refreshLibrary()
                            }
                        }
                        .buttonStyle(.bordered)
                    }
                } else {
                    List {
                        if let stats = appModel.libraryStats {
                            Section("Overview") {
                                StatsStrip(stats: stats)
                                    .listRowInsets(EdgeInsets())
                                    .listRowBackground(Color.clear)
                            }
                        }

                        if !appModel.playlists.isEmpty {
                            Section("Playlists") {
                                ForEach(appModel.playlists) { playlist in
                                    NavigationLink {
                                        PlaylistDetailScreen(playlist: playlist)
                                    } label: {
                                        PlaylistRow(playlist: playlist)
                                    }
                                }
                            }
                        }

                        Section("Songs") {
                            ForEach(appModel.librarySongs) { song in
                                SongRowButton(song: song)
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                    .refreshable {
                        await appModel.refreshLibrary()
                    }
                }
            }
            .navigationTitle("Melodia")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    HStack(spacing: 8) {
                        Image("Logo")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 22, height: 22)
                            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                        Text("Melodia")
                            .font(.headline.weight(.semibold))
                    }
                }

                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        Task {
                            await appModel.refreshLibrary()
                        }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .accessibilityLabel("Refresh library")
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingServerSheet = true
                    } label: {
                        Image(systemName: "slider.horizontal.3")
                    }
                    .accessibilityLabel("Connection settings")
                }
            }
            .safeAreaInset(edge: .bottom) {
                if appModel.isHydratingLibrary && !appModel.librarySongs.isEmpty {
                    HStack(spacing: 8) {
                        ProgressView()
                        Text("Loading full library...")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(.ultraThinMaterial, in: Capsule())
                    .padding(.bottom, 8)
                }
            }
            .sheet(isPresented: $showingServerSheet) {
                ServerSettingsSheet()
            }
            .onAppear {
                if !appModel.hasServerURLConfigured {
                    showingServerSheet = true
                }
            }
        }
    }
}

private struct SearchScreen: View {
    @EnvironmentObject private var appModel: MelodiaAppModel

    var body: some View {
        NavigationStack {
            List {
                if appModel.searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Section {
                        Text("Search songs, artists, or albums from your Melodia server.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                } else {
                    if let searchError = appModel.searchError {
                        Section {
                            Text(searchError)
                                .foregroundStyle(.red)
                                .font(.subheadline)
                        }
                    }

                    if appModel.isSearching, appModel.searchPayload.songs.isEmpty,
                       appModel.searchPayload.artists.isEmpty, appModel.searchPayload.albums.isEmpty {
                        Section {
                            ProgressView("Searching...")
                        }
                    }

                    if !appModel.searchPayload.songs.isEmpty {
                        Section("Songs") {
                            ForEach(appModel.searchPayload.songs) { song in
                                SongRowButton(song: song)
                            }
                        }
                    }

                    if !appModel.searchPayload.artists.isEmpty {
                        Section("Artists") {
                            ForEach(appModel.searchPayload.artists) { artist in
                                HStack(spacing: 12) {
                                    SongArtworkView(
                                        url: appModel.artworkURL(for: artist.artSongId),
                                        size: 38,
                                        cornerRadius: 8,
                                        iconName: "person.fill"
                                    )

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(artist.artist)
                                            .font(.body.weight(.medium))
                                        Text("\(artist.songCount) songs")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                    }

                    if !appModel.searchPayload.albums.isEmpty {
                        Section("Albums") {
                            ForEach(appModel.searchPayload.albums) { album in
                                HStack(spacing: 12) {
                                    SongArtworkView(
                                        url: appModel.artworkURL(for: album.artSongId),
                                        size: 38,
                                        cornerRadius: 8,
                                        iconName: "opticaldisc.fill"
                                    )

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(album.album)
                                            .font(.body.weight(.medium))
                                        Text(album.albumArtist)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                    }

                    if !appModel.isSearching,
                       appModel.searchError == nil,
                       appModel.searchPayload.songs.isEmpty,
                       appModel.searchPayload.artists.isEmpty,
                       appModel.searchPayload.albums.isEmpty {
                        Section {
                            ContentUnavailableView(
                                "No Results",
                                systemImage: "music.note",
                                description: Text("Try a different search term.")
                            )
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Search")
            .searchable(text: $appModel.searchQuery, prompt: "Song, artist, album")
            .onChange(of: appModel.searchQuery) { _, newValue in
                appModel.scheduleSearch(for: newValue)
            }
        }
    }
}

private struct NowPlayingScreen: View {
    @EnvironmentObject private var appModel: MelodiaAppModel

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [appModel.nowPlayingTheme.backgroundTop, appModel.nowPlayingTheme.backgroundBottom],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            if let song = appModel.currentSong {
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 22) {
                        Text("PLAYING NOW")
                            .font(.caption2.weight(.semibold))
                            .tracking(2)
                            .foregroundStyle(.white.opacity(0.75))
                            .padding(.top, 16)

                        ZStack {
                            Circle()
                                .stroke(appModel.nowPlayingTheme.ringOuter.opacity(0.22), lineWidth: 34)
                                .frame(width: 320, height: 320)

                            Circle()
                                .stroke(appModel.nowPlayingTheme.ringTrack.opacity(0.75), lineWidth: 5)
                                .frame(width: 275, height: 275)
                                .shadow(color: appModel.nowPlayingTheme.glow.opacity(0.6), radius: 12)

                            Circle()
                                .trim(from: 0, to: max(0.02, appModel.playbackProgress))
                                .stroke(
                                    AngularGradient(
                                        gradient: Gradient(colors: [
                                            appModel.nowPlayingTheme.progressStart,
                                            appModel.nowPlayingTheme.progressEnd,
                                            appModel.nowPlayingTheme.progressStart
                                        ]),
                                        center: .center
                                    ),
                                    style: StrokeStyle(lineWidth: 7, lineCap: .round)
                                )
                                .rotationEffect(.degrees(-90))
                                .frame(width: 292, height: 292)
                                .shadow(color: appModel.nowPlayingTheme.glow.opacity(0.65), radius: 10)

                            SongArtworkView(
                                url: appModel.artworkURL(for: song.id),
                                size: 210,
                                cornerRadius: 105,
                                iconName: "music.note"
                            )
                        }
                        .padding(.top, 8)

                        VStack(spacing: 4) {
                            Text(song.displayTitle)
                                .font(.title3.weight(.semibold))
                                .foregroundStyle(.white)
                                .multilineTextAlignment(.center)
                            Text(song.displayArtist)
                                .font(.footnote)
                                .foregroundStyle(.white.opacity(0.75))
                        }

                        HStack {
                            Text(MelodiaFormat.trackDuration(appModel.currentTime))
                            Spacer()
                            Text(MelodiaFormat.trackDuration(appModel.totalTime))
                        }
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(.white.opacity(0.7))
                        .padding(.horizontal, 34)

                        HStack(spacing: 30) {
                            Button {
                                appModel.playPreviousSong()
                            } label: {
                                Image(systemName: "backward.fill")
                                    .font(.title2)
                            }

                            Button {
                                appModel.togglePlayback()
                            } label: {
                                ZStack {
                                    Circle()
                                        .fill(
                                            LinearGradient(
                                                colors: [appModel.nowPlayingTheme.buttonStart, appModel.nowPlayingTheme.buttonEnd],
                                                startPoint: .topLeading,
                                                endPoint: .bottomTrailing
                                            )
                                        )
                                        .frame(width: 74, height: 74)
                                    Image(systemName: appModel.isPlaying ? "pause.fill" : "play.fill")
                                        .font(.title2.weight(.bold))
                                        .foregroundStyle(.white)
                                }
                                .shadow(color: appModel.nowPlayingTheme.glow.opacity(0.55), radius: 14)
                            }

                            Button {
                                appModel.playNextSong()
                            } label: {
                                Image(systemName: "forward.fill")
                                    .font(.title2)
                            }
                        }
                        .foregroundStyle(.white)

                        HStack(spacing: 14) {
                            Button("-15s") {
                                appModel.seek(by: -15)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color.white.opacity(0.18))

                            Button("+15s") {
                                appModel.seek(by: 15)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color.white.opacity(0.18))
                        }
                        .foregroundStyle(.white)

                        HStack(spacing: 10) {
                            Image(systemName: "speaker.fill")
                                .font(.caption)
                                .foregroundStyle(.white.opacity(0.72))

                            Slider(
                                value: Binding(
                                    get: { appModel.playbackVolume },
                                    set: { appModel.setPlaybackVolume($0) }
                                ),
                                in: 0 ... 1
                            )
                            .tint(appModel.nowPlayingTheme.buttonStart)

                            Image(systemName: "speaker.wave.3.fill")
                                .font(.caption)
                                .foregroundStyle(.white.opacity(0.72))
                        }
                        .padding(.horizontal, 24)

                        if let playerError = appModel.playerError {
                            Text(playerError)
                                .font(.caption)
                                .foregroundStyle(.red.opacity(0.85))
                                .multilineTextAlignment(.center)
                        }

                        Text("Streaming from \(appModel.currentServerURL)")
                            .font(.caption2)
                            .foregroundStyle(.white.opacity(0.45))
                            .padding(.top, 6)
                    }
                    .padding(.horizontal, 18)
                    .padding(.bottom, 30)
                }
            } else {
                ContentUnavailableView(
                    "Nothing Playing",
                    systemImage: "play.slash",
                    description: Text("Pick a track from Library or Search to start playback.")
                )
                .foregroundStyle(.white.opacity(0.85))
            }
        }
        .animation(.easeInOut(duration: 0.85), value: appModel.nowPlayingTheme)
    }
}

private struct StatsStrip: View {
    let stats: LibraryStats

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                StatCard(title: "Songs", value: String(stats.totalSongs), tint: .blue)
                StatCard(title: "Artists", value: String(stats.totalArtists), tint: .mint)
                StatCard(title: "Albums", value: String(stats.totalAlbums), tint: .orange)
                StatCard(title: "Duration", value: MelodiaFormat.totalDuration(stats.totalDuration), tint: .pink)
            }
            .padding(.horizontal)
        }
        .frame(height: 102)
    }
}

private struct StatCard: View {
    let title: String
    let value: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title3.weight(.semibold))
                .foregroundStyle(.primary)
        }
        .frame(width: 132, alignment: .leading)
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(tint.opacity(0.14))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(tint.opacity(0.3), lineWidth: 1)
        )
    }
}

private struct SongRowButton: View {
    let song: Song

    @EnvironmentObject private var appModel: MelodiaAppModel

    private var isCurrentSong: Bool {
        appModel.currentSong?.id == song.id
    }

    var body: some View {
        Button {
            appModel.play(song: song)
        } label: {
            HStack(spacing: 12) {
                SongArtworkView(
                    url: appModel.artworkURL(for: song.hasArtwork ? song.id : nil),
                    size: 42,
                    cornerRadius: 10,
                    iconName: "music.note"
                )

                VStack(alignment: .leading, spacing: 3) {
                    Text(song.displayTitle)
                        .font(.body.weight(.medium))
                        .lineLimit(1)
                    Text(song.displayArtist)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Spacer()

                if isCurrentSong {
                    Image(systemName: appModel.isPlaying ? "speaker.wave.2.fill" : "pause.fill")
                        .foregroundStyle(.tint)
                }

                Text(song.durationText)
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            .padding(.vertical, 2)
        }
        .buttonStyle(.plain)
    }
}

private struct PlaylistRow: View {
    let playlist: PlaylistSummary

    @EnvironmentObject private var appModel: MelodiaAppModel

    var body: some View {
        HStack(spacing: 12) {
            SongArtworkView(
                url: appModel.artworkURL(for: playlist.fallbackArtSongId),
                size: 42,
                cornerRadius: 10,
                iconName: "music.note.list"
            )

            VStack(alignment: .leading, spacing: 3) {
                Text(playlist.name)
                    .font(.body.weight(.medium))
                    .lineLimit(1)

                Text("\(playlist.songCount) songs")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(.vertical, 2)
    }
}

private struct PlaylistDetailScreen: View {
    let playlist: PlaylistSummary

    @EnvironmentObject private var appModel: MelodiaAppModel

    var body: some View {
        Group {
            if appModel.isLoadingPlaylistSongs && appModel.songsForPlaylist(playlistID: playlist.id).isEmpty {
                ProgressView("Loading playlist...")
            } else if let playlistError = appModel.playlistError,
                      appModel.songsForPlaylist(playlistID: playlist.id).isEmpty {
                ContentUnavailableView(
                    "Could not load playlist",
                    systemImage: "exclamationmark.triangle",
                    description: Text(playlistError)
                )
            } else {
                List {
                    ForEach(appModel.songsForPlaylist(playlistID: playlist.id)) { song in
                        SongRowButton(song: song)
                    }
                }
                .listStyle(.insetGrouped)
                .refreshable {
                    await appModel.loadPlaylistSongs(playlistID: playlist.id, forceReload: true)
                }
            }
        }
        .navigationTitle(playlist.name)
        .task(id: playlist.id) {
            await appModel.loadPlaylistSongs(playlistID: playlist.id)
        }
    }
}

private struct SongArtworkView: View {
    let url: URL?
    let size: CGFloat
    let cornerRadius: CGFloat
    let iconName: String

    var body: some View {
        Group {
            if let url {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case let .success(image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .failure:
                        artworkFallback
                    case .empty:
                        artworkFallback
                    @unknown default:
                        artworkFallback
                    }
                }
            } else {
                artworkFallback
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .stroke(Color.primary.opacity(0.08), lineWidth: 1)
        )
    }

    private var artworkFallback: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color.blue.opacity(0.30),
                    Color.mint.opacity(0.24)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            Image(systemName: iconName)
                .foregroundStyle(.primary.opacity(0.8))
        }
    }
}

private struct ServerSettingsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appModel: MelodiaAppModel

    @State private var candidateURL = ""
    @State private var validationError: String?
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Server") {
                    TextField("http://192.168.1.10:4872", text: $candidateURL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
                        .keyboardType(.URL)

                    Text("Use your Melodia backend URL. On a physical iPhone, use your Mac's local IP.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                if let validationError {
                    Section {
                        Text(validationError)
                            .foregroundStyle(.red)
                            .font(.footnote)
                    }
                }
            }
            .navigationTitle("Connection")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        validationError = appModel.saveServerURL(candidateURL)
                        guard validationError == nil else { return }

                        isSaving = true
                        Task {
                            await appModel.reconnectToServer()
                            isSaving = false
                            dismiss()
                        }
                    }
                    .disabled(isSaving)
                }
            }
            .onAppear {
                candidateURL = appModel.currentServerURL
            }
        }
    }
}

#Preview {
    ContentView()
}
