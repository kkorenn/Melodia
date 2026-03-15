import { useEffect, useRef, useState } from "react";
import { Music2 } from "lucide-react";
import { artUrl } from "../lib/api";

const LAST_PLAYED_COVER_CACHE_KEY = "melodia-last-cover-art-v1";
const LAST_PLAYED_COVER_SIZE = 160;

function readLastPlayedCoverCache(songId) {
  if (typeof window === "undefined" || !songId) {
    return "";
  }

  try {
    const raw = window.localStorage.getItem(LAST_PLAYED_COVER_CACHE_KEY);
    if (!raw) {
      return "";
    }

    const parsed = JSON.parse(raw);
    if (
      Number(parsed?.songId) !== Number(songId) ||
      typeof parsed?.dataUrl !== "string" ||
      !parsed.dataUrl.startsWith("data:image/")
    ) {
      return "";
    }

    return parsed.dataUrl;
  } catch {
    return "";
  }
}

function writeLastPlayedCoverCache(songId, dataUrl) {
  if (typeof window === "undefined" || !songId || typeof dataUrl !== "string") {
    return;
  }

  try {
    window.localStorage.setItem(
      LAST_PLAYED_COVER_CACHE_KEY,
      JSON.stringify({
        songId: Number(songId),
        dataUrl,
        updatedAt: Date.now()
      })
    );
  } catch {
    // no-op
  }
}

function createCoverThumbnailDataUrl(imgElement) {
  const sourceWidth = Number(imgElement?.naturalWidth || 0);
  const sourceHeight = Number(imgElement?.naturalHeight || 0);
  if (!sourceWidth || !sourceHeight) {
    return "";
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return "";
  }

  const targetSize = LAST_PLAYED_COVER_SIZE;
  canvas.width = targetSize;
  canvas.height = targetSize;

  const scale = Math.max(targetSize / sourceWidth, targetSize / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const offsetX = (targetSize - drawWidth) / 2;
  const offsetY = (targetSize - drawHeight) / 2;

  context.drawImage(imgElement, offsetX, offsetY, drawWidth, drawHeight);
  return canvas.toDataURL("image/jpeg", 0.76);
}

export function CoverArt({
  songId,
  alt = "cover",
  className = "",
  eager = false,
  frame = true,
  useLastPlayedCache = false
}) {
  const [visible, setVisible] = useState(eager);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [cachedPreviewSrc, setCachedPreviewSrc] = useState(
    () => (useLastPlayedCache ? readLastPlayedCoverCache(songId) : "")
  );
  const ref = useRef(null);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
    if (useLastPlayedCache) {
      setCachedPreviewSrc(readLastPlayedCoverCache(songId));
    } else {
      setCachedPreviewSrc("");
    }
    if (eager) {
      setVisible(true);
    }
  }, [songId, eager, useLastPlayedCache]);

  useEffect(() => {
    if (eager) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "120px" }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [eager]);

  return (
    <div
      ref={ref}
      className={`${frame ? "overflow-hidden rounded-lg border border-[color:var(--border)] bg-panelSoft" : "overflow-hidden bg-panelSoft"} ${className}`}
    >
      {visible && songId && !failed ? (
        <div className="relative h-full w-full">
          {!loaded && cachedPreviewSrc ? (
            <img
              src={cachedPreviewSrc}
              alt={alt}
              className="absolute inset-0 h-full w-full object-cover opacity-100"
            />
          ) : null}
          {!loaded && !cachedPreviewSrc && (
            <div className="absolute inset-0 flex h-full w-full animate-pulse items-center justify-center bg-panelSoft">
              <Music2 className="h-5 w-5 text-textSoft/70" strokeWidth={2.2} aria-hidden="true" />
            </div>
          )}
          <img
            src={artUrl(songId)}
            alt={alt}
            loading={eager ? "eager" : "lazy"}
            className={`h-full w-full object-cover transition-opacity duration-200 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={(event) => {
              setLoaded(true);
              if (useLastPlayedCache) {
                const thumbnailDataUrl = createCoverThumbnailDataUrl(event.currentTarget);
                if (thumbnailDataUrl) {
                  writeLastPlayedCoverCache(songId, thumbnailDataUrl);
                  setCachedPreviewSrc(thumbnailDataUrl);
                }
              }
            }}
            onError={() => {
              if (!cachedPreviewSrc) {
                setFailed(true);
              }
            }}
          />
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-panelSoft text-xs text-textSoft">
          <Music2 className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
