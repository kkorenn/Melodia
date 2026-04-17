import SwiftUI

@main
struct MelodiaApp: App {
    @StateObject private var runtime = MelodiaRuntime()

    var body: some Scene {
        WindowGroup {
            ContentView(runtime: runtime)
        }
        .commands {
            CommandMenu("Melodia") {
                Button("Rescan Library") {
                    runtime.scanLibrary()
                }
                .keyboardShortcut("r", modifiers: [.command, .shift])

                Button("Open Song Folder") {
                    runtime.openSongsFolder()
                }

                Button("Open Config") {
                    runtime.openConfigFile()
                }

                Divider()

                Button(runtime.isPlaying ? "Pause" : "Play") {
                    runtime.togglePlayPause()
                }

                Button("Next Track") {
                    runtime.playNext()
                }

                Button("Previous Track") {
                    runtime.playPrevious()
                }
            }
        }
    }
}
