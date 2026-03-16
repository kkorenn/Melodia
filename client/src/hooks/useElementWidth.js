import { useEffect, useState } from "react";

export function useElementWidth(ref) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return undefined;
    }

    const updateWidth = () => {
      setWidth(Math.round(node.getBoundingClientRect().width));
    };

    updateWidth();

    if (typeof ResizeObserver !== "function") {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
