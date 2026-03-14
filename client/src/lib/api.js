const API_BASE = import.meta.env.VITE_API_BASE || "";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let code = "";
    let retryAfterMs = 0;
    try {
      const data = await response.json();
      if (data?.error) {
        message = data.error;
      }
      if (typeof data?.code === "string") {
        code = data.code;
      }
      if (Number.isFinite(Number(data?.retryAfterMs))) {
        retryAfterMs = Number(data.retryAfterMs);
      }
    } catch {
      // no-op
    }
    const error = new Error(message);
    error.status = response.status;
    error.code = code;
    error.retryAfterMs = retryAfterMs;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function streamUrl(songId) {
  return `${API_BASE}/api/stream/${songId}`;
}

export function artUrl(songId) {
  return `${API_BASE}/api/art/${songId}`;
}

export function playlistArtUrl(playlistId) {
  return `${API_BASE}/api/playlists/${playlistId}/art`;
}

export function fetchSongs({ offset = 0, limit = 200, sort = "title", direction = "asc", signal } = {}) {
  return request(
    `/api/songs?offset=${offset}&limit=${limit}&sort=${encodeURIComponent(
      sort
    )}&direction=${encodeURIComponent(direction)}`
    ,
    { signal }
  );
}

export function fetchMostPlayed(limit = 200, { signal } = {}) {
  return request(`/api/views/most-played?limit=${limit}`, { signal });
}

export function fetchRediscover({ limit = 120, staleDays = 90, signal } = {}) {
  return request(`/api/views/rediscover?limit=${limit}&staleDays=${staleDays}`, { signal });
}

export function fetchActiveArtists({ limit = 60, days = 30, signal } = {}) {
  return request(`/api/views/active-artists?limit=${limit}&days=${days}`, { signal });
}

export function fetchRecentlyPlayed(limit = 50, { signal } = {}) {
  return request(`/api/views/recently-played?limit=${limit}`, { signal });
}

export function fetchArtists({ signal } = {}) {
  return request("/api/artists", { signal });
}

export function fetchArtistSongs(artist, { signal } = {}) {
  return request(`/api/artists/${encodeURIComponent(artist)}/songs`, { signal });
}

export function fetchArtistAlbums(artist, { signal } = {}) {
  return request(`/api/artists/${encodeURIComponent(artist)}/albums`, { signal });
}

export function fetchAlbums({ offset = 0, limit = 200, signal } = {}) {
  return request(`/api/albums?offset=${offset}&limit=${limit}`, { signal });
}

export function fetchAlbumTracks(album, albumArtist, { signal } = {}) {
  return request(
    `/api/albums/tracks?album=${encodeURIComponent(album)}&albumArtist=${encodeURIComponent(
      albumArtist
    )}`,
    { signal }
  );
}

export function fetchPlaylists({ signal } = {}) {
  return request("/api/playlists", { signal });
}

export function createPlaylist(name) {
  return request("/api/playlists", {
    method: "POST",
    body: JSON.stringify({ name })
  });
}

export function fetchPlaylist(playlistId, { signal } = {}) {
  return request(`/api/playlists/${playlistId}`, { signal });
}

export function updatePlaylist(playlistId, payload) {
  return request(`/api/playlists/${playlistId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deletePlaylist(playlistId) {
  return request(`/api/playlists/${playlistId}`, {
    method: "DELETE"
  });
}

export function fetchPlaylistSongs(playlistId, { signal } = {}) {
  return request(`/api/playlists/${playlistId}/songs`, { signal });
}

export function addSongToPlaylist(playlistId, songId) {
  return request(`/api/playlists/${playlistId}/songs`, {
    method: "POST",
    body: JSON.stringify({ songId })
  });
}

export function removeSongFromPlaylist(playlistId, songId) {
  return request(`/api/playlists/${playlistId}/songs/${songId}`, {
    method: "DELETE"
  });
}

export function sortPlaylistSongs(playlistId, payload) {
  return request(`/api/playlists/${playlistId}/sort`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function setPlaylistCover(playlistId, coverDataUrl) {
  return request(`/api/playlists/${playlistId}/cover`, {
    method: "POST",
    body: JSON.stringify({ coverDataUrl })
  });
}

export function clearPlaylistCover(playlistId) {
  return request(`/api/playlists/${playlistId}/cover`, {
    method: "DELETE"
  });
}

export function fetchSearch(query, { signal } = {}) {
  return request(`/api/search?q=${encodeURIComponent(query)}`, { signal });
}

export function fetchStats({ signal } = {}) {
  return request("/api/stats", { signal });
}

export function fetchStatistics({ signal } = {}) {
  return request("/api/statistics", { signal });
}

export function fetchSettings() {
  return request("/api/settings");
}

export function fetchPublicSettings() {
  return request("/api/settings/public");
}

export function fetchSettingsAuthStatus() {
  return request("/api/settings/auth/status");
}

export function loginSettings(password) {
  return request("/api/settings/auth/login", {
    method: "POST",
    body: JSON.stringify({ password })
  });
}

export function logoutSettings() {
  return request("/api/settings/auth/logout", {
    method: "POST"
  });
}

export function saveSettings(payload) {
  return request("/api/settings", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function triggerRescan() {
  return request("/api/rescan", {
    method: "POST"
  });
}

export function fetchScanState() {
  return request("/api/scan/state");
}

export function markSongPlayed(songId) {
  return request(`/api/play/${songId}`, {
    method: "POST"
  });
}

export function fetchLyrics(songId, { refresh = false } = {}) {
  const refreshQuery = refresh ? "?refresh=1" : "";
  return request(`/api/lyrics/${songId}${refreshQuery}`);
}

export function scanEventsUrl() {
  return `${API_BASE}/api/scan/events`;
}
