import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchSearch } from "../lib/api";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { highlightMatch } from "../utils/highlight.jsx";
import { usePlayerStore } from "../store/playerStore";
import { Input } from "./ui/input";
import { Card } from "./ui/card";

function sameSongOrder(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index]?.id !== right[index]?.id) {
      return false;
    }
  }

  return true;
}

export function TopBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ songs: [], artists: [], albums: [] });
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debouncedQuery = useDebouncedValue(query, 300);
  const containerRef = useRef(null);
  const searchRequestIdRef = useRef(0);
  const navigate = useNavigate();
  const queue = usePlayerStore((state) => state.queue);
  const setQueue = usePlayerStore((state) => state.setQueue);
  const setCurrentIndex = usePlayerStore((state) => state.setCurrentIndex);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults({ songs: [], artists: [], albums: [] });
      setActiveIndex(-1);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;
    setLoading(true);
    fetchSearch(debouncedQuery, { signal: controller.signal })
      .then((payload) => {
        if (requestId !== searchRequestIdRef.current) {
          return;
        }
        setResults({
          songs: payload.songs || [],
          artists: payload.artists || [],
          albums: payload.albums || []
        });
      })
      .catch((error) => {
        if (error?.name === "AbortError") {
          return;
        }
        if (requestId !== searchRequestIdRef.current) {
          return;
        }
        setResults({ songs: [], artists: [], albums: [] });
      })
      .finally(() => {
        if (requestId === searchRequestIdRef.current) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [debouncedQuery]);

  const displayedSongs = useMemo(() => results.songs.slice(0, 8), [results.songs]);
  const displayedArtists = useMemo(() => results.artists.slice(0, 6), [results.artists]);
  const displayedAlbums = useMemo(() => results.albums.slice(0, 6), [results.albums]);

  const hasResults = useMemo(() => {
    return (
      displayedSongs.length > 0 ||
      displayedArtists.length > 0 ||
      displayedAlbums.length > 0
    );
  }, [displayedSongs, displayedArtists, displayedAlbums]);

  const playSongFromSearch = (song) => {
    const index = displayedSongs.findIndex((candidate) => candidate.id === song.id);
    const nextQueue = displayedSongs.length ? displayedSongs : [song];
    const startIndex = index >= 0 ? index : 0;

    if (sameSongOrder(queue, nextQueue)) {
      setCurrentIndex(startIndex, true);
      setOpen(false);
      return;
    }

    setQueue(nextQueue, startIndex, true);
    setOpen(false);
  };

  const flattenedResults = useMemo(() => {
    const items = [];

    for (let index = 0; index < displayedSongs.length; index += 1) {
      const song = displayedSongs[index];
      items.push({
        optionId: `search-option-${index}`,
        onSelect: () => playSongFromSearch(song)
      });
    }

    for (let index = 0; index < displayedArtists.length; index += 1) {
      const artist = displayedArtists[index];
      items.push({
        optionId: `search-option-${displayedSongs.length + index}`,
        onSelect: () => {
          navigate(`/artists/${encodeURIComponent(artist.artist)}`);
          setOpen(false);
        }
      });
    }

    for (let index = 0; index < displayedAlbums.length; index += 1) {
      const album = displayedAlbums[index];
      items.push({
        optionId: `search-option-${displayedSongs.length + displayedArtists.length + index}`,
        onSelect: () => {
          navigate(
            `/albums/${encodeURIComponent(album.albumArtist)}/${encodeURIComponent(album.album)}`
          );
          setOpen(false);
        }
      });
    }

    return items;
  }, [displayedSongs, displayedArtists, displayedAlbums, navigate]);

  useEffect(() => {
    if (!flattenedResults.length) {
      setActiveIndex(-1);
      return;
    }

    setActiveIndex((previous) => {
      if (previous < 0) {
        return 0;
      }
      return Math.min(previous, flattenedResults.length - 1);
    });
  }, [flattenedResults]);

  const activeItemId =
    activeIndex >= 0 && activeIndex < flattenedResults.length
      ? flattenedResults[activeIndex].optionId
      : undefined;

  const songsOffset = 0;
  const artistsOffset = displayedSongs.length;
  const albumsOffset = displayedSongs.length + displayedArtists.length;

  return (
    <header className="sticky top-0 z-20 border-b border-[color:var(--border)] bg-[color:var(--bg-main)] px-4 py-3 md:px-6">
      <div className="relative" ref={containerRef}>
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (!open || !query.trim()) {
              return;
            }

            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              return;
            }

            if (!flattenedResults.length) {
              return;
            }

            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((previous) =>
                previous < flattenedResults.length - 1 ? previous + 1 : 0
              );
              return;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((previous) =>
                previous > 0 ? previous - 1 : flattenedResults.length - 1
              );
              return;
            }

            if (event.key === "Enter" && activeIndex >= 0) {
              event.preventDefault();
              flattenedResults[activeIndex]?.onSelect();
            }
          }}
          placeholder="Search songs, artists, albums"
          className="h-10 rounded-xl px-4 text-sm"
          role="combobox"
          aria-expanded={open && Boolean(query.trim())}
          aria-controls="topbar-search-results"
          aria-activedescendant={activeItemId}
        />

        {open && query.trim() && (
          <Card
            id="topbar-search-results"
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+8px)] max-h-[60vh] overflow-y-auto rounded-2xl p-3 shadow-xl shadow-black/20"
          >
            {loading && <p className="px-2 py-3 text-sm text-textSoft">Searching...</p>}

            {!loading && !hasResults && (
              <p className="px-2 py-3 text-sm text-textSoft">No matches yet.</p>
            )}

            {!loading && displayedSongs.length > 0 && (
              <section>
                <h4 className="mb-2 px-2 text-xs font-medium text-textSoft">Songs</h4>
                <div className="space-y-1">
                  {displayedSongs.map((song, index) => (
                    <button
                      key={song.id}
                      type="button"
                      onClick={() => playSongFromSearch(song)}
                      id={`search-option-${songsOffset + index}`}
                      role="option"
                      aria-selected={activeIndex === songsOffset + index}
                      className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-text transition hover:bg-panelSoft ${
                        activeIndex === songsOffset + index ? "bg-panelSoft" : ""
                      }`}
                      onMouseEnter={() => setActiveIndex(songsOffset + index)}
                    >
                      <span>
                        {highlightMatch(song.title || song.filename || "Untitled", debouncedQuery)}
                        <span className="ml-2 text-xs text-textSoft">
                          {highlightMatch(song.artist || "Unknown Artist", debouncedQuery)}
                        </span>
                      </span>
                      <span className="text-xs text-textSoft">
                        {highlightMatch(song.album || "Unknown Album", debouncedQuery)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {!loading && displayedArtists.length > 0 && (
              <section className="mt-3">
                <h4 className="mb-2 px-2 text-xs font-medium text-textSoft">Artists</h4>
                <div className="space-y-1">
                  {displayedArtists.map((artist, index) => (
                    <button
                      key={artist.artist}
                      type="button"
                      onClick={() => {
                        navigate(`/artists/${encodeURIComponent(artist.artist)}`);
                        setOpen(false);
                      }}
                      id={`search-option-${artistsOffset + index}`}
                      role="option"
                      aria-selected={activeIndex === artistsOffset + index}
                      className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-text transition hover:bg-panelSoft ${
                        activeIndex === artistsOffset + index ? "bg-panelSoft" : ""
                      }`}
                      onMouseEnter={() => setActiveIndex(artistsOffset + index)}
                    >
                      <span>{highlightMatch(artist.artist, debouncedQuery)}</span>
                      <span className="text-xs text-textSoft">{artist.songCount} songs</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {!loading && displayedAlbums.length > 0 && (
              <section className="mt-3">
                <h4 className="mb-2 px-2 text-xs font-medium text-textSoft">Albums</h4>
                <div className="space-y-1">
                  {displayedAlbums.map((album, index) => (
                    <button
                      key={`${album.albumArtist}-${album.album}`}
                      type="button"
                      onClick={() => {
                        navigate(
                          `/albums/${encodeURIComponent(album.albumArtist)}/${encodeURIComponent(
                            album.album
                          )}`
                        );
                        setOpen(false);
                      }}
                      id={`search-option-${albumsOffset + index}`}
                      role="option"
                      aria-selected={activeIndex === albumsOffset + index}
                      className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-text transition hover:bg-panelSoft ${
                        activeIndex === albumsOffset + index ? "bg-panelSoft" : ""
                      }`}
                      onMouseEnter={() => setActiveIndex(albumsOffset + index)}
                    >
                      <span>
                        {highlightMatch(album.album, debouncedQuery)}
                        <span className="ml-2 text-xs text-textSoft">
                          {highlightMatch(album.albumArtist, debouncedQuery)}
                        </span>
                      </span>
                      <span className="text-xs text-textSoft">{album.songCount} songs</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </Card>
        )}
      </div>
    </header>
  );
}
