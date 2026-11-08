import { PlugZap, WifiOff } from "lucide-react";

export function SetupNotice({ message }: { message?: string }) {
  const offline = message?.startsWith("Could not reach PayPal");
  const Icon = offline ? WifiOff : PlugZap;
  return (
    <div className="flex gap-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-amber-900">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
        <Icon className="h-5 w-5" />
      </span>
      <div className="space-y-1">
        <p className="font-semibold">{offline ? "PayPal didn't respond" : "PayPal isn't connected yet"}</p>
        {offline ? (
          <p className="text-sm">{message}</p>
        ) : (
          <>
            {message && <p className="font-mono text-sm">{message}</p>}
            <p className="text-sm">
              Copy <code>.env.example</code> to <code>.env.local</code>, add your sandbox Client ID and Secret, then
              restart <code>npm run dev</code>. The README has step-by-step setup.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
