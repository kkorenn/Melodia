import { useNavigate } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";
import { sameSongOrder } from "../lib/songOrder";

export function useSongActions() {
  const navigate = useNavigate();
  const queue = usePlayerStore((state) => state.queue);
  const setQueue = usePlayerStore((state) => state.setQueue);
  const setCurrentIndex = usePlayerStore((state) => state.setCurrentIndex);
  const addToQueue = usePlayerStore((state) => state.addToQueue);

  const playSong = (song, index = 0, songs = [song]) => {
    const source = Array.isArray(songs) && songs.length ? songs : [song];
    const startIndex = source.findIndex((candidate) => candidate.id === song.id);
    const targetIndex = startIndex >= 0 ? startIndex : index;

    if (sameSongOrder(queue, source)) {
      setCurrentIndex(targetIndex, true);
      return;
    }

    setQueue(source, targetIndex, true);
  };

  const queueSong = (song, mode = "end") => {
    addToQueue(song, mode);
  };

  const goToArtist = (artist) => {
    navigate(`/artists/${encodeURIComponent(artist)}`);
  };

  const goToAlbum = (album, albumArtist) => {
    navigate(`/albums/${encodeURIComponent(albumArtist)}/${encodeURIComponent(album)}`);
  };

  return {
    playSong,
    queueSong,
    goToArtist,
    goToAlbum
  };
}
