export function EmptyState({ title, description }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-panel/70 p-10 text-center">
      <h3 className="text-xl font-semibold text-text">{title}</h3>
      <p className="mt-2 text-sm text-textSoft">{description}</p>
    </div>
  );
}
