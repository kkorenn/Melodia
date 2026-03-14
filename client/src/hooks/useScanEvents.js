import { useEffect } from "react";
import { fetchScanState, scanEventsUrl } from "../lib/api";
import { useAppStore } from "../store/appStore";

function parsePayload(event) {
  try {
    return JSON.parse(event.data);
  } catch {
    return null;
  }
}

export function useScanEvents() {
  const setScanState = useAppStore((state) => state.setScanState);

  useEffect(() => {
    let eventSource;

    fetchScanState()
      .then((state) => {
        setScanState(state);
      })
      .catch(() => {
        // no-op
      });

    try {
      eventSource = new EventSource(scanEventsUrl());
    } catch {
      return undefined;
    }

    const updateFromEvent = (event) => {
      const payload = parsePayload(event);
      if (!payload) {
        return;
      }

      if (payload.scan) {
        setScanState(payload.scan);
        return;
      }

      setScanState(payload);
    };

    eventSource.addEventListener("connected", updateFromEvent);
    eventSource.addEventListener("scan-state", updateFromEvent);
    eventSource.addEventListener("scan-progress", updateFromEvent);
    eventSource.addEventListener("scan-complete", updateFromEvent);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [setScanState]);
}
