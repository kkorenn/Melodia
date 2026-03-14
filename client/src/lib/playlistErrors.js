export function getPlaylistWriteErrorMessage(error, fallback) {
  if (error?.status === 401 || error?.code === "SETTINGS_AUTH_REQUIRED") {
    return "Unlock Settings first, then try editing playlists again.";
  }
  return error?.message || fallback;
}
