import AppKit
import SwiftUI

struct ContentView: View {
    @ObservedObject var runtime: MelodiaRuntime
    @State private var queueOpen = false

    var body: some View {
        ZStack(alignment: .bottom) {
            VStack(spacing: 0) {
                HStack(spacing: 0) {
                    sidebar
                        .frame(width: 300)

                    Divider()

                    libraryPane
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }

                Divider()
                playerBar
            }

            floatingPanels
        }
        .frame(minWidth: 1080, minHeight: 700)
        .task {
            runtime.startIfNeeded()
        }
        .onChange(of: runtime.currentTrackID) { _, newValue in
            if newValue == nil {
                queueOpen = false
            }
        }
    }

    private var sidebar: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                MelodiaLogoView()
                    .frame(width: 24, height: 24)

                Text(runtime.config?.appName ?? "Melodia")
                    .font(.title2.weight(.semibold))
            }

            if let startupError = runtime.startupError {
                Text(startupError)
                    .font(.caption)
                    .foregroundStyle(.red)
            } else {
                Text("Standalone local library mode")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if let songsPath = runtime.primaryLibraryDirectory?.path {
                Text("Songs folder")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)

                Text(songsPath)
                    .font(.caption.monospaced())
                    .textSelection(.enabled)
                    .lineLimit(3)
            }

            HStack(spacing: 8) {
                Button("Open Song Folder") {
                    runtime.openSongsFolder()
                }

                Button("Open Config") {
                    runtime.openConfigFile()
                }
            }

            Button {
                runtime.scanLibrary()
            } label: {
                if runtime.isScanning {
                    Label("Scanning...", systemImage: "arrow.triangle.2.circlepath")
                } else {
                    Label("Rescan Library", systemImage: "arrow.clockwise")
                }
            }
            .disabled(runtime.isScanning)

            if let scanError = runtime.scanError {
                Text(scanError)
                    .font(.caption)
                    .foregroundStyle(.red)
            }

            Divider()

            Text("Tracks: \(runtime.filteredTracks.count)")
                .font(.callout)
                .foregroundStyle(.secondary)

            if let currentTrack = runtime.currentTrack {
                HStack(alignment: .top, spacing: 10) {
                    TrackArtworkView(track: currentTrack, size: 66, highlighted: runtime.isPlaying)

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Now Playing")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text(currentTrack.title)
                            .font(.callout.weight(.semibold))
                            .lineLimit(2)
                        Text(currentTrack.artist ?? "Unknown Artist")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
            }

            Spacer()
        }
        .padding(16)
    }

    private var libraryPane: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                TextField("Search songs, artists, albums", text: $runtime.searchQuery)
                    .textFieldStyle(.roundedBorder)

                if !runtime.searchQuery.isEmpty {
                    Button("Clear") {
                        runtime.searchQuery = ""
                    }
                }
            }
            .padding(14)

            Divider()

            if runtime.filteredTracks.isEmpty {
                VStack(spacing: 12) {
                    if runtime.isScanning {
                        ProgressView()
                    }

                    Text(runtime.isScanning ? "Scanning songs..." : "No songs found")
                        .font(.headline)

                    Text("Drop audio files into ~/.melodia/musics (or ~/.melodia/song), then click Rescan Library.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(runtime.filteredTracks, selection: $runtime.selectedTrackID) { track in
                    TrackRow(
                        track: track,
                        isCurrent: track.id == runtime.currentTrackID
                    )
                    .tag(track.id)
                    .contentShape(Rectangle())
                    .onTapGesture(count: 2) {
                        runtime.play(trackID: track.id)
                    }
                }
                .listStyle(.inset(alternatesRowBackgrounds: true))
            }
        }
    }

    private var floatingPanels: some View {
        ZStack(alignment: .bottomTrailing) {
            if runtime.lyricsOpen, runtime.currentTrack != nil {
                lyricsPanel
                    .frame(maxWidth: .infinity)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            if queueOpen {
                queuePanel
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 110)
        .animation(.easeOut(duration: 0.24), value: runtime.lyricsOpen)
        .animation(.easeOut(duration: 0.22), value: queueOpen)
    }

    private var playerBar: some View {
        HStack(spacing: 16) {
            nowPlayingCompact
                .frame(width: 300, alignment: .leading)

            centerTransport
                .frame(maxWidth: .infinity)

            rightControls
                .frame(width: 248, alignment: .trailing)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .background {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color(red: 0.07, green: 0.10, blue: 0.14).opacity(0.95))
        }
        .overlay {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .strokeBorder(Color.white.opacity(0.10), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.35), radius: 14, x: 0, y: 8)
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
    }

    private var nowPlayingCompact: some View {
        HStack(spacing: 12) {
            TrackArtworkView(track: runtime.currentTrack, size: 58, highlighted: runtime.isPlaying)

            VStack(alignment: .leading, spacing: 2) {
                Text(runtime.currentTrack?.title ?? "Nothing playing")
                    .font(.headline)
                    .foregroundStyle(Color.white.opacity(0.92))
                    .lineLimit(1)

                Text(nowPlayingSubtitle)
                    .font(.subheadline)
                    .foregroundStyle(Color.white.opacity(0.72))
                    .lineLimit(1)
            }

            Spacer(minLength: 0)
        }
    }

    private var nowPlayingSubtitle: String {
        guard let track = runtime.currentTrack else {
            return "Queue a track to start"
        }

        let artist = (track.artist?.isEmpty == false ? track.artist! : "Unknown Artist")
        let album = (track.album?.isEmpty == false ? track.album! : "Unknown Album")
        return "\(artist) · \(album)"
    }

    private var centerTransport: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                PlayerActionButton(
                    symbol: "shuffle",
                    isActive: runtime.isShuffleEnabled,
                    action: runtime.toggleShuffle
                )

                PlayerActionButton(
                    symbol: "backward.end.fill",
                    isActive: false,
                    action: runtime.playPrevious
                )

                PlayPauseActionButton(isPlaying: runtime.isPlaying, action: runtime.togglePlayPause)
                    .disabled(runtime.tracks.isEmpty)

                PlayerActionButton(
                    symbol: "forward.end.fill",
                    isActive: false,
                    action: { runtime.playNext() }
                )

                PlayerActionButton(
                    symbol: runtime.repeatMode.symbolName,
                    isActive: runtime.repeatMode != .off,
                    action: runtime.cycleRepeatMode
                )
            }

            HStack(spacing: 8) {
                Text(formatDuration(runtime.currentTime))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(Color.white.opacity(0.72))
                    .frame(width: 44, alignment: .trailing)

                TrackProgressBar(progress: trackProgress) { percent in
                    runtime.seek(to: runtime.duration * percent)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 14)
                .opacity(runtime.currentTrack == nil ? 0.55 : 1)
                .allowsHitTesting(runtime.currentTrack != nil)

                Text(formatDuration(runtime.duration))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(Color.white.opacity(0.72))
                    .frame(width: 44, alignment: .leading)
            }
        }
    }

    private var rightControls: some View {
        HStack(spacing: 10) {
            PlayerActionButton(
                symbol: "quote.bubble",
                isActive: runtime.lyricsOpen,
                action: {
                    queueOpen = false
                    runtime.toggleLyricsPanel()
                }
            )
            .disabled(runtime.currentTrack == nil)

            PlayerActionButton(
                symbol: runtime.isMuted ? "speaker.slash.fill" : "speaker.wave.2.fill",
                isActive: runtime.isMuted,
                action: runtime.toggleMute
            )

            Slider(
                value: Binding(
                    get: { runtime.isMuted ? 0 : runtime.volume },
                    set: { runtime.setVolume($0) }
                ),
                in: 0...1
            )
            .tint(Color(red: 0.35, green: 0.72, blue: 1.0))
            .frame(width: 118)

            PlayerActionButton(
                symbol: "list.bullet",
                isActive: queueOpen,
                action: {
                    runtime.closeLyricsPanel()
                    queueOpen.toggle()
                }
            )
        }
    }

    private var lyricsPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Lyrics")
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text(lyricsSubtitle)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.72))
                        .lineLimit(1)

                    if isCurrentSongLyricsLoaded && runtime.lyricsState.loading {
                        Text("Updating lyrics...")
                            .font(.caption2)
                            .foregroundStyle(.white.opacity(0.62))
                    }
                }

                Spacer(minLength: 8)

                HStack(spacing: 8) {
                    PlayerActionButton(
                        symbol: "arrow.clockwise",
                        isActive: false,
                        action: runtime.refreshLyrics,
                        compact: true
                    )
                    .disabled(runtime.currentTrack == nil || runtime.lyricsState.loading)

                    PlayerActionButton(
                        symbol: "xmark",
                        isActive: false,
                        action: runtime.closeLyricsPanel,
                        compact: true
                    )
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, 12)
            .padding(.bottom, 10)

            Divider()
                .overlay(Color.white.opacity(0.14))

            ScrollView {
                lyricsBody
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14)
            }
            .frame(maxHeight: 380)
        }
        .frame(maxWidth: 760)
        .background {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(red: 0.08, green: 0.11, blue: 0.16).opacity(0.97))
        }
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(Color.white.opacity(0.12), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.38), radius: 16, x: 0, y: 8)
    }

    @ViewBuilder
    private var lyricsBody: some View {
        if runtime.currentTrack == nil {
            Text("Start playing a song to view lyrics.")
                .font(.callout)
                .foregroundStyle(.white.opacity(0.70))
        } else if runtime.lyricsState.loading && !isCurrentSongLyricsLoaded {
            Text("Loading lyrics...")
                .font(.callout)
                .foregroundStyle(.white.opacity(0.70))
        } else if !runtime.lyricsState.error.isEmpty && !isCurrentSongLyricsLoaded {
            Text(runtime.lyricsState.error)
                .font(.callout)
                .foregroundStyle(.red.opacity(0.85))
        } else if let payload = currentSongLyricsPayload {
            switch payload.status {
            case .ok:
                if let lyrics = payload.lyrics, !lyrics.isEmpty {
                    Text(lyrics)
                        .font(.system(size: 13))
                        .foregroundStyle(.white.opacity(0.90))
                        .lineSpacing(4)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    Text("Lyrics are not available for this track yet.")
                        .font(.callout)
                        .foregroundStyle(.white.opacity(0.70))
                }
            case .noMatch:
                Text("We couldn't find a matching song in the lyrics provider.")
                    .font(.callout)
                    .foregroundStyle(.white.opacity(0.70))
            case .noLyrics:
                Text("No lyrics were returned for this song.")
                    .font(.callout)
                    .foregroundStyle(.white.opacity(0.70))
            case .error:
                Text(
                    payload.error ??
                    (runtime.lyricsState.error.isEmpty ? "Lyrics are currently unavailable." : runtime.lyricsState.error)
                )
                    .font(.callout)
                    .foregroundStyle(.red.opacity(0.85))
            }
        } else {
            Text("Lyrics are not available for this track yet.")
                .font(.callout)
                .foregroundStyle(.white.opacity(0.70))
        }
    }

    private var currentSongLyricsPayload: LyricsPayload? {
        guard runtime.lyricsState.songID == runtime.currentTrack?.id else {
            return nil
        }
        return runtime.lyricsState.payload
    }

    private var isCurrentSongLyricsLoaded: Bool {
        currentSongLyricsPayload != nil
    }

    private var lyricsSubtitle: String {
        guard let track = runtime.currentTrack else {
            return "No track selected"
        }

        let artist = track.artist?.isEmpty == false ? track.artist! : "Unknown Artist"
        return "\(track.title) · \(artist)"
    }

    private var queuePanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Queue")
                    .font(.headline)
                    .foregroundStyle(.white)

                Spacer()

                Button {
                    queueOpen = false
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.white.opacity(0.8))
                        .frame(width: 24, height: 24)
                        .background(Color.white.opacity(0.08), in: Circle())
                }
                .buttonStyle(.plain)
            }

            if runtime.queueTracks.isEmpty {
                Text("No tracks queued after the current song.")
                    .font(.callout)
                    .foregroundStyle(.white.opacity(0.68))
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(Array(runtime.queueTracks.prefix(40))) { track in
                            HStack(spacing: 8) {
                                TrackArtworkView(track: track, size: 30)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(track.title)
                                        .font(.subheadline.weight(.medium))
                                        .foregroundStyle(.white.opacity(0.90))
                                        .lineLimit(1)
                                    Text(track.artist ?? "Unknown Artist")
                                        .font(.caption)
                                        .foregroundStyle(.white.opacity(0.62))
                                        .lineLimit(1)
                                }
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxHeight: 300)
            }
        }
        .padding(14)
        .frame(maxWidth: 340)
        .background {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(red: 0.08, green: 0.11, blue: 0.16).opacity(0.97))
        }
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(Color.white.opacity(0.12), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.38), radius: 16, x: 0, y: 8)
    }

    private var trackProgress: Double {
        guard runtime.duration > 0 else {
            return 0
        }
        return min(max(runtime.currentTime / runtime.duration, 0), 1)
    }

    private func formatDuration(_ seconds: TimeInterval) -> String {
        guard seconds.isFinite, seconds > 0 else {
            return "0:00"
        }

        let totalSeconds = Int(seconds.rounded())
        let minutes = totalSeconds / 60
        let remaining = totalSeconds % 60
        return "\(minutes):\(String(format: "%02d", remaining))"
    }
}

private struct MelodiaLogoView: View {
    var body: some View {
        GeometryReader { geometry in
            let side = min(geometry.size.width, geometry.size.height)
            let scale = side / 24
            let lineWidth = max(1.4, 2.2 * scale)

            ZStack {
                Path { path in
                    path.move(to: CGPoint(x: 9 * scale, y: 18 * scale))
                    path.addLine(to: CGPoint(x: 9 * scale, y: 5 * scale))
                    path.addLine(to: CGPoint(x: 21 * scale, y: 3 * scale))
                    path.addLine(to: CGPoint(x: 21 * scale, y: 16 * scale))
                }
                .stroke(
                    Color.accentColor,
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round, lineJoin: .round)
                )

                Path { path in
                    path.move(to: CGPoint(x: 9 * scale, y: 9 * scale))
                    path.addLine(to: CGPoint(x: 21 * scale, y: 7 * scale))
                }
                .stroke(
                    Color.accentColor,
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round, lineJoin: .round)
                )

                Path { path in
                    path.addEllipse(in: CGRect(x: 3 * scale, y: 15 * scale, width: 6 * scale, height: 6 * scale))
                    path.addEllipse(in: CGRect(x: 15 * scale, y: 13 * scale, width: 6 * scale, height: 6 * scale))
                }
                .stroke(
                    Color.accentColor,
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round, lineJoin: .round)
                )
            }
            .frame(width: geometry.size.width, height: geometry.size.height)
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityHidden(true)
    }
}

private struct TrackArtworkView: View {
    let track: LocalTrack?
    let size: CGFloat
    var highlighted: Bool = false

    var body: some View {
        ZStack {
            if let image = nsImage {
                Image(nsImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                LinearGradient(
                    colors: [Color.gray.opacity(0.35), Color.gray.opacity(0.15)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )

                Image(systemName: "music.note")
                    .font(.system(size: max(12, size * 0.35), weight: .semibold))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .strokeBorder(
                    highlighted ? Color.accentColor.opacity(0.7) : Color.primary.opacity(0.08),
                    lineWidth: highlighted ? 1.5 : 1
                )
        }
    }

    private var nsImage: NSImage? {
        guard let data = track?.artworkData else {
            return nil
        }
        return NSImage(data: data)
    }
}

private struct PlayerActionButton: View {
    let symbol: String
    let isActive: Bool
    let action: () -> Void
    var compact: Bool = false

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: compact ? 12 : 14, weight: .semibold))
                .foregroundStyle(.white.opacity(isActive ? 0.95 : 0.78))
                .frame(width: compact ? 30 : 38, height: compact ? 30 : 38)
                .background {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(isActive ? Color(red: 0.22, green: 0.58, blue: 1.0).opacity(0.30) : Color.white.opacity(0.05))
                }
                .overlay {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(isActive ? Color(red: 0.36, green: 0.70, blue: 1.0).opacity(0.78) : Color.white.opacity(0.12), lineWidth: 1)
                }
        }
        .buttonStyle(.plain)
    }
}

private struct PlayPauseActionButton: View {
    let isPlaying: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Color(red: 0.06, green: 0.16, blue: 0.28))
                .frame(width: 46, height: 46)
                .background {
                    Circle()
                        .fill(Color(red: 0.35, green: 0.72, blue: 1.0))
                }
                .overlay {
                    Circle()
                        .strokeBorder(Color.white.opacity(0.24), lineWidth: 1)
                }
        }
        .buttonStyle(.plain)
    }
}

private struct TrackProgressBar: View {
    let progress: Double
    let onSeek: (Double) -> Void

    @State private var dragProgress: Double?

    var body: some View {
        GeometryReader { geometry in
            let shownProgress = min(max(dragProgress ?? progress, 0), 1)

            ZStack(alignment: .leading) {
                Capsule(style: .continuous)
                    .fill(Color.white.opacity(0.16))

                Capsule(style: .continuous)
                    .fill(Color.white.opacity(0.35))
                    .frame(width: geometry.size.width * shownProgress)
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        dragProgress = progressFromLocation(value.location.x, width: geometry.size.width)
                    }
                    .onEnded { value in
                        let nextProgress = progressFromLocation(value.location.x, width: geometry.size.width)
                        dragProgress = nil
                        onSeek(nextProgress)
                    }
            )
        }
        .frame(height: 12)
    }

    private func progressFromLocation(_ x: CGFloat, width: CGFloat) -> Double {
        guard width > 0 else {
            return 0
        }
        return min(max(Double(x / width), 0), 1)
    }
}

private struct TrackRow: View {
    let track: LocalTrack
    let isCurrent: Bool

    var body: some View {
        HStack(spacing: 10) {
            ZStack(alignment: .bottomTrailing) {
                TrackArtworkView(track: track, size: 38, highlighted: isCurrent)

                if isCurrent {
                    Image(systemName: "speaker.wave.2.fill")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(4)
                        .background(.tint, in: Circle())
                        .offset(x: 4, y: 4)
                }
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(track.title)
                    .lineLimit(1)

                Text(track.artist ?? "Unknown Artist")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer(minLength: 10)

            Text(durationLabel)
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }

    private var durationLabel: String {
        guard let duration = track.duration, duration.isFinite, duration > 0 else {
            return "--:--"
        }

        let total = Int(duration.rounded())
        return "\(total / 60):\(String(format: "%02d", total % 60))"
    }
}

#Preview {
    ContentView(runtime: MelodiaRuntime())
}
