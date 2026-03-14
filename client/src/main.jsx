import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/index.css";

function syncAppHeight() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
}

syncAppHeight();
window.addEventListener("resize", syncAppHeight);
window.addEventListener("fullscreenchange", syncAppHeight);

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
