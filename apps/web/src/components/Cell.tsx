type Props = {
  value: "X" | "O" | null;
  position: number;
  isWinning: boolean;
  disabled: boolean;
  onClick: (position: number) => void;
};

const VALUE_CLASS: Record<NonNullable<Props["value"]>, string> = {
  X: "text-arcade-primary",
  O: "text-arcade-pink",
};

const VALUE_DROP_SHADOW: Record<NonNullable<Props["value"]>, string> = {
  X: "drop-shadow-[0_0_8px_rgba(57,255,20,0.7)]",
  O: "drop-shadow-[0_0_8px_rgba(255,113,206,0.7)]",
};

export function Cell({ value, position, isWinning, disabled, onClick }: Props) {
  const filled = value !== null;
  const isDisabled = disabled || filled;
  const classes = [
    "arcade-cell",
    filled ? VALUE_CLASS[value] : "",
    filled ? VALUE_DROP_SHADOW[value] : "",
    isWinning ? "arcade-cell-winning animate-glow-pulse" : "",
    filled ? "animate-pop-in" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classes}
      disabled={isDisabled}
      aria-label={filled ? `casa ${position} com ${value}` : `casa ${position} vazia`}
      data-testid={`cell-${position}`}
      onClick={() => !isDisabled && onClick(position)}
    >
      {value}
    </button>
  );
}
