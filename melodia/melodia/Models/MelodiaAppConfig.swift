import Foundation

struct MelodiaHomeLayout: Equatable {
    let rootDirectory: URL

    var songsDirectory: URL {
        rootDirectory.appendingPathComponent("song", isDirectory: true)
    }

    var musicsDirectory: URL {
        rootDirectory.appendingPathComponent("musics", isDirectory: true)
    }

    var configFile: URL {
        rootDirectory.appendingPathComponent("config.json", isDirectory: false)
    }

    var databaseFile: URL {
        rootDirectory.appendingPathComponent("melodia.sqlite", isDirectory: false)
    }

    static func userHome(fileManager: FileManager = .default) -> MelodiaHomeLayout {
        let home = fileManager.homeDirectoryForCurrentUser
        return MelodiaHomeLayout(
            rootDirectory: home.appendingPathComponent(".melodia", isDirectory: true)
        )
    }
}

struct MelodiaAppConfig: Codable, Equatable {
    var appName: String
    var theme: String
    var port: Int
    var musicDir: String
    var dbPath: String

    static func defaults(for layout: MelodiaHomeLayout) -> MelodiaAppConfig {
        MelodiaAppConfig(
            appName: "Melodia",
            theme: "dark",
            port: 4872,
            musicDir: layout.musicsDirectory.path,
            dbPath: layout.databaseFile.path
        )
    }
}
