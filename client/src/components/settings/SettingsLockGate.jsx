import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function SettingsLockGate({
  settingsPassword,
  setSettingsPassword,
  unlocking,
  unlockSettings,
  message,
  error
}) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-text">Settings</h2>
        <p className="text-sm text-textSoft">Protected via backend password</p>
      </div>

      <div className="space-y-4 rounded-2xl border border-[color:var(--border)] bg-panel/70 p-4">
        <p className="text-sm text-textSoft">
          Enter your settings password to unlock configuration and rescanning controls.
        </p>

        <label className="block text-sm text-textSoft">
          Settings Password
          <Input
            type="password"
            value={settingsPassword}
            onChange={(event) => setSettingsPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                unlockSettings();
              }
            }}
            className="mt-1 h-10 rounded-xl"
            placeholder="Enter password"
            autoComplete="current-password"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={unlockSettings}
            disabled={unlocking}
            className="h-10 rounded-xl"
          >
            {unlocking ? "Unlocking..." : "Unlock Settings"}
          </Button>
        </div>

        {message && <p className="text-sm text-emerald-300">{message}</p>}
        {error && <p className="text-sm text-rose-300">{error}</p>}
      </div>
    </section>
  );
}
