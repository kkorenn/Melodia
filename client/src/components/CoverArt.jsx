import { useEffect, useRef, useState } from "react";
import { Music2 } from "lucide-react";
import { artUrl } from "../lib/api";

export function CoverArt({
  songId,
  alt = "cover",
  className = "",
  eager = false,
  frame = true
}) {
  const [visible, setVisible] = useState(eager);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
    if (eager) {
      setVisible(true);
    }
  }, [songId, eager]);

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
          {!loaded && (
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
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
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
