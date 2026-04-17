import Foundation

struct MelodiaBootstrapResult {
    let layout: MelodiaHomeLayout
    let config: MelodiaAppConfig
}

private struct PartialMelodiaAppConfig: Codable {
    var appName: String?
    var theme: String?
    var port: Int?
    var musicDir: String?
    var dbPath: String?
}

enum MelodiaBootstrap {
    static func prepare(
        layout: MelodiaHomeLayout = .userHome(),
        fileManager: FileManager = .default
    ) throws -> MelodiaBootstrapResult {
        try fileManager.createDirectory(at: layout.rootDirectory, withIntermediateDirectories: true)
        try fileManager.createDirectory(at: layout.songsDirectory, withIntermediateDirectories: true)
        try fileManager.createDirectory(at: layout.musicsDirectory, withIntermediateDirectories: true)

        let defaults = MelodiaAppConfig.defaults(for: layout)

        if !fileManager.fileExists(atPath: layout.configFile.path) {
            try write(config: defaults, to: layout.configFile)
            return MelodiaBootstrapResult(layout: layout, config: defaults)
        }

        let data = try Data(contentsOf: layout.configFile)
        let decoded = try JSONDecoder().decode(PartialMelodiaAppConfig.self, from: data)

        let merged = MelodiaAppConfig(
            appName: sanitizeAppName(decoded.appName) ?? defaults.appName,
            theme: sanitizeTheme(decoded.theme) ?? defaults.theme,
            port: sanitizePort(decoded.port) ?? defaults.port,
            musicDir: sanitizePath(decoded.musicDir) ?? defaults.musicDir,
            dbPath: sanitizePath(decoded.dbPath) ?? defaults.dbPath
        )

        // Keep config normalized so app/server bootstrap stay deterministic.
        try write(config: merged, to: layout.configFile)
        return MelodiaBootstrapResult(layout: layout, config: merged)
    }

    private static func write(config: MelodiaAppConfig, to url: URL) throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(config)
        guard var json = String(data: data, encoding: .utf8) else {
            throw CocoaError(.fileWriteUnknown)
        }
        if !json.hasSuffix("\n") {
            json.append("\n")
        }
        try json.write(to: url, atomically: true, encoding: .utf8)
    }

    private static func sanitizeAppName(_ value: String?) -> String? {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if trimmed.isEmpty {
            return nil
        }
        return String(trimmed.prefix(80))
    }

    private static func sanitizeTheme(_ value: String?) -> String? {
        switch value?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "light":
            return "light"
        case "dark":
            return "dark"
        default:
            return nil
        }
    }

    private static func sanitizePort(_ value: Int?) -> Int? {
        guard let value, value > 0 else {
            return nil
        }
        return value
    }

    private static func sanitizePath(_ value: String?) -> String? {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if trimmed.isEmpty {
            return nil
        }
        return NSString(string: trimmed).expandingTildeInPath
    }
}
