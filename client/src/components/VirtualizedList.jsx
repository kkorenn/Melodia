import { useEffect } from "react";
import clsx from "clsx";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMainScrollElement } from "../lib/mainScroll.jsx";

export function VirtualizedList({
  items,
  estimateItemHeight = 72,
  overscan = 8,
  className = "",
  itemClassName = "pb-1",
  onEndReached,
  endReachedThreshold = 3,
  getItemKey,
  renderItem
}) {
  const scrollElement = useMainScrollElement();
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => estimateItemHeight,
    overscan
  });
  const virtualRows = scrollElement ? rowVirtualizer.getVirtualItems() : [];

  useEffect(() => {
    if (!onEndReached || !virtualRows.length || !items.length) {
      return;
    }

    const lastVirtualRow = virtualRows[virtualRows.length - 1];
    if (lastVirtualRow.index >= items.length - 1 - endReachedThreshold) {
      onEndReached();
    }
  }, [endReachedThreshold, items.length, onEndReached, virtualRows]);

  if (!items.length) {
    return null;
  }

  if (!scrollElement) {
    return (
      <div className={clsx("space-y-1", className)}>
        {items.map((item, index) => (
          <div key={getItemKey(item, index)}>{renderItem(item, index)}</div>
        ))}
      </div>
    );
  }

  return (
    <div className={clsx("relative", className)}>
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          position: "relative"
        }}
      >
        {virtualRows.map((virtualRow) => {
          const item = items[virtualRow.index];
          if (!item) {
            return null;
          }

          return (
            <div
              key={virtualRow.key}
              ref={rowVirtualizer.measureElement}
              className={clsx("absolute left-0 top-0 w-full", itemClassName)}
              style={{
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              {renderItem(item, virtualRow.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
