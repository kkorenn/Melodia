import Foundation

enum MelodiaAPIError: LocalizedError {
    case invalidResponse
    case httpStatus(Int, String)
    case decoding(Error)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Server returned an invalid response."
        case let .httpStatus(status, message):
            if message.isEmpty {
                return "Server returned \(status)."
            }
            return "Server returned \(status): \(message)"
        case let .decoding(error):
            return "Could not decode server response: \(error.localizedDescription)"
        }
    }
}

private struct APIErrorBody: Decodable {
    let error: String?
    let details: String?
}

private struct APIHealthResponse: Decodable {
    let status: String
}

private struct APIMarkPlayResponse: Decodable {
    let success: Bool
}

struct MelodiaAPIClient {
    let baseURL: URL
    private let session: URLSession
    private let decoder = JSONDecoder()

    private static let fastSession: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 3
        configuration.timeoutIntervalForResource = 6
        configuration.waitsForConnectivity = false
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        return URLSession(configuration: configuration)
    }()

    init(baseURL: URL, session: URLSession? = nil) {
        self.baseURL = baseURL
        self.session = session ?? Self.fastSession
    }

    func checkHealth() async throws {
        _ = try await get("api/health", timeout: 2, as: APIHealthResponse.self)
    }

    func fetchSongs(limit: Int = 250) async throws -> [Song] {
        let response = try await fetchSongsPage(limit: limit, offset: 0)
        return response.rows
    }

    func fetchSongsPage(limit: Int = 200, offset: Int = 0) async throws -> SongsResponse {
        try await get(
            "api/songs",
            queryItems: [
                URLQueryItem(name: "limit", value: String(limit)),
                URLQueryItem(name: "offset", value: String(offset))
            ],
            as: SongsResponse.self
        )
    }

    func fetchStats() async throws -> LibraryStats {
        try await get("api/stats", as: LibraryStats.self)
    }

    func fetchPlaylists() async throws -> [PlaylistSummary] {
        let response = try await get("api/playlists", as: PlaylistsResponse.self)
        return response.rows
    }

    func fetchPlaylistSongs(playlistID: Int) async throws -> [Song] {
        let response = try await get("api/playlists/\(playlistID)/songs", as: PlaylistSongsResponse.self)
        return response.rows
    }

    func search(query: String) async throws -> SearchPayload {
        try await get(
            "api/search",
            queryItems: [URLQueryItem(name: "q", value: query)],
            as: SearchPayload.self
        )
    }

    func markPlayed(songID: Int) async {
        do {
            _ = try await post("api/play/\(songID)", as: APIMarkPlayResponse.self)
        } catch {
            // Ignore play marker failures; playback should continue.
        }
    }

    func streamURL(for songID: Int) -> URL {
        endpointURL(path: "api/stream/\(songID)")
    }

    func artworkURL(for songID: Int) -> URL {
        endpointURL(path: "api/art/\(songID)")
    }

    private func get<T: Decodable>(
        _ path: String,
        queryItems: [URLQueryItem] = [],
        timeout: TimeInterval = 8,
        as type: T.Type
    ) async throws -> T {
        var request = URLRequest(url: endpointURL(path: path, queryItems: queryItems))
        request.httpMethod = "GET"
        request.timeoutInterval = timeout
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await session.data(for: request)
        return try decodeResponse(data: data, response: response, as: type)
    }

    private func post<T: Decodable>(_ path: String, as type: T.Type) async throws -> T {
        var request = URLRequest(url: endpointURL(path: path))
        request.httpMethod = "POST"
        request.timeoutInterval = 8
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await session.data(for: request)
        return try decodeResponse(data: data, response: response, as: type)
    }

    private func decodeResponse<T: Decodable>(
        data: Data,
        response: URLResponse,
        as type: T.Type
    ) throws -> T {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw MelodiaAPIError.invalidResponse
        }

        guard (200 ... 299).contains(httpResponse.statusCode) else {
            let serverMessage = parseErrorMessage(from: data)
            throw MelodiaAPIError.httpStatus(httpResponse.statusCode, serverMessage)
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw MelodiaAPIError.decoding(error)
        }
    }

    private func parseErrorMessage(from data: Data) -> String {
        guard !data.isEmpty else { return "" }

        if let decoded = try? decoder.decode(APIErrorBody.self, from: data) {
            let pieces = [decoded.error, decoded.details]
                .compactMap { value -> String? in
                    guard let value else { return nil }
                    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
                    return trimmed.isEmpty ? nil : trimmed
                }

            if !pieces.isEmpty {
                return pieces.joined(separator: " ")
            }
        }

        return String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    private func endpointURL(path: String, queryItems: [URLQueryItem] = []) -> URL {
        let normalized = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let url = baseURL.appendingPathComponent(normalized)

        guard !queryItems.isEmpty,
              var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        else {
            return url
        }

        components.queryItems = queryItems
        return components.url ?? url
    }
}
