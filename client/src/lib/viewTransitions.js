export function withViewTransition(update) {
  if (typeof update !== "function") {
    return;
  }

  if (typeof document === "undefined") {
    update();
    return;
  }

  const reduceMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion || typeof document.startViewTransition !== "function") {
    update();
    return;
  }

  try {
    document.startViewTransition(() => {
      update();
    });
  } catch (error) {
    update();
  }
}
