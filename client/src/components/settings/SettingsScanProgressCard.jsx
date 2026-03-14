export function SettingsScanProgressCard({ scanState }) {
  return (
    <section className="space-y-3 rounded-2xl border border-[color:var(--border)] bg-panel/70 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm uppercase tracking-[0.14em] text-textSoft">
          Library Scan Progress
        </h3>
        <span className="text-sm text-text">{scanState.progress || 0}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-panelSoft">
        <div
          className="h-full bg-gradient-to-r from-accent to-accentWarm transition-all"
          style={{ width: `${scanState.progress || 0}%` }}
        />
      </div>
      <p className="text-xs text-textSoft">
        {scanState.running
          ? `Scanning ${scanState.scanned || 0}/${scanState.total || 0} files`
          : "Idle"}
      </p>
      <p className="truncate text-xs text-textSoft">
        {scanState.currentFile || "No file active"}
      </p>
      <p className="text-xs text-textSoft">
        Added: {scanState.added || 0} · Updated: {scanState.updated || 0} · Skipped:{" "}
        {scanState.skipped || 0} · Removed: {scanState.removed || 0}
      </p>
    </section>
  );
}
