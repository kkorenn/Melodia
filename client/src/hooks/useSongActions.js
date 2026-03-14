import { useNavigate } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";

function sameSongOrder(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftId = left[index]?.id;
    const rightId = right[index]?.id;
    if (leftId !== rightId) {
      return false;
    }
  }

  return true;
}

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
