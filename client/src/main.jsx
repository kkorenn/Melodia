import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/index.css";

function getVisibleViewportHeight() {
  if (typeof window === "undefined") {
    return 0;
  }

  if (window.visualViewport?.height) {
    return window.visualViewport.height;
  }

  return window.innerHeight;
}

function syncAppHeight() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const viewportHeight = Math.max(1, Math.round(getVisibleViewportHeight()));
  document.documentElement.style.setProperty("--app-height", `${viewportHeight}px`);
}

function bindAppHeightSync() {
  syncAppHeight();

  const syncOptions = { passive: true };
  window.addEventListener("resize", syncAppHeight, syncOptions);
  window.addEventListener("orientationchange", syncAppHeight, syncOptions);
  window.addEventListener("fullscreenchange", syncAppHeight, syncOptions);
  window.addEventListener("pageshow", syncAppHeight, syncOptions);

  const viewport = window.visualViewport;
  if (viewport) {
    viewport.addEventListener("resize", syncAppHeight);
    viewport.addEventListener("scroll", syncAppHeight);
  }

  return () => {
    window.removeEventListener("resize", syncAppHeight, syncOptions);
    window.removeEventListener("orientationchange", syncAppHeight, syncOptions);
    window.removeEventListener("fullscreenchange", syncAppHeight, syncOptions);
    window.removeEventListener("pageshow", syncAppHeight, syncOptions);

    if (viewport) {
      viewport.removeEventListener("resize", syncAppHeight);
      viewport.removeEventListener("scroll", syncAppHeight);
    }
  };
}

const unbindAppHeightSync = bindAppHeightSync();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unbindAppHeightSync();
  });
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
