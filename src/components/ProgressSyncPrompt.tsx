import type { AppState } from "@/lib/rewards";

interface Props {
  guestState: AppState;
  onKeep: () => void;
  onDiscard: () => void;
}

export function ProgressSyncPrompt({ guestState, onKeep, onDiscard }: Props) {
  const savedCount = Object.keys(guestState.saved).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-primary/40 bg-surface-1 p-5 text-foreground glow-primary">
        <h2 className="text-sm font-semibold">Keep your progress on this device?</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This device has {guestState.totalEarned} points
          {savedCount > 0 ? ` and ${savedCount} saved article${savedCount === 1 ? "" : "s"}` : ""} that
          weren't earned on your account yet. Add them to your account, or start from
          your account's own progress instead?
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onKeep}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add this device's progress to my account
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Discard it, use my account's progress
          </button>
        </div>
      </div>
    </div>
  );
}
