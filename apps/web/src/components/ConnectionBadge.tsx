type Props = {
  status: "disconnected" | "connecting" | "connected" | "reconnecting";
};

const LABEL: Record<Props["status"], string> = {
  disconnected: "OFFLINE",
  connecting: "LINKING",
  connected: "ONLINE",
  reconnecting: "RETRY",
};

const COLOR: Record<Props["status"], string> = {
  disconnected: "text-arcade-red",
  connecting: "text-arcade-yellow",
  connected: "text-arcade-primary",
  reconnecting: "text-arcade-pink",
};

const DOT: Record<Props["status"], string> = {
  disconnected: "bg-arcade-red",
  connecting: "bg-arcade-yellow",
  connected: "bg-arcade-primary",
  reconnecting: "bg-arcade-pink",
};

export function ConnectionBadge({ status }: Props) {
  return (
    <div className={`inline-flex items-center gap-2 font-pixel text-[10px] tracking-widest ${COLOR[status]}`}>
      <span className={`inline-block w-2 h-2 ${DOT[status]} ${status !== "disconnected" ? "animate-pulse" : ""}`} />
      <span>{LABEL[status]}</span>
    </div>
  );
}
