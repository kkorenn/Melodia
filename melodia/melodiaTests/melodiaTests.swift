import Foundation
import Testing
@testable import melodia

struct melodiaTests {

    @Test func bootstrapCreatesMelodiaFolderShape() throws {
        let fileManager = FileManager.default
        let tempRoot = fileManager.temporaryDirectory
            .appendingPathComponent("melodia-tests-\(UUID().uuidString)", isDirectory: true)
        let layout = MelodiaHomeLayout(
            rootDirectory: tempRoot.appendingPathComponent(".melodia", isDirectory: true)
        )

        defer {
            try? fileManager.removeItem(at: tempRoot)
        }

        let result = try MelodiaBootstrap.prepare(layout: layout, fileManager: fileManager)

        #expect(fileManager.fileExists(atPath: result.layout.rootDirectory.path))
        #expect(fileManager.fileExists(atPath: result.layout.songsDirectory.path))
        #expect(fileManager.fileExists(atPath: result.layout.musicsDirectory.path))
        #expect(fileManager.fileExists(atPath: result.layout.configFile.path))
        #expect(result.config.port == 4872)
        #expect(result.config.musicDir == result.layout.musicsDirectory.path)
    }

    @Test func bootstrapPreservesConfiguredValues() throws {
        let fileManager = FileManager.default
        let tempRoot = fileManager.temporaryDirectory
            .appendingPathComponent("melodia-tests-\(UUID().uuidString)", isDirectory: true)
        let layout = MelodiaHomeLayout(
            rootDirectory: tempRoot.appendingPathComponent(".melodia", isDirectory: true)
        )

        defer {
            try? fileManager.removeItem(at: tempRoot)
        }

        try fileManager.createDirectory(at: layout.rootDirectory, withIntermediateDirectories: true)

        let savedConfig = MelodiaAppConfig(
            appName: "Desktop Melodia",
            theme: "light",
            port: 4999,
            musicDir: layout.songsDirectory.path,
            dbPath: layout.databaseFile.path
        )

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(savedConfig)
        try data.write(to: layout.configFile, options: .atomic)

        let result = try MelodiaBootstrap.prepare(layout: layout, fileManager: fileManager)

        #expect(result.config.appName == "Desktop Melodia")
        #expect(result.config.theme == "light")
        #expect(result.config.port == 4999)
    }
}
