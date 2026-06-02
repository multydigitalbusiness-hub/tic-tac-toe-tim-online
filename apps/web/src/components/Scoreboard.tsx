import type { Names } from "../store/gameStore.js";
import type { Player, Score } from "@ttt/shared";

export function Scoreboard({
  names,
  youAre,
  score,
}: {
  names: Names;
  youAre: Player | null;
  score: Score | null;
}) {
  const xScore = score?.X ?? 0;
  const oScore = score?.O ?? 0;
  const draws = score?.draws ?? 0;
  const xLeader = xScore > oScore;
  const oLeader = oScore > xScore;
  const drawLead = xScore === oScore;
  const xBorder = xLeader
    ? "border-arcade-primary"
    : drawLead && score
      ? "border-arcade-yellow"
      : youAre === "X"
        ? "border-arcade-primary"
        : "";
  const oBorder = oLeader
    ? "border-arcade-primary"
    : drawLead && score
      ? "border-arcade-yellow"
      : youAre === "O"
        ? "border-arcade-pink"
        : "";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-stretch">
        <div className={`flex-none w-[120px] arcade-panel p-3 text-center ${xBorder}`} data-testid="scoreboard-x">
          <div className="flex items-center justify-center gap-2">
            <span className="font-pixel text-2xl text-arcade-primary">X</span>
            <span className="font-pixel text-2xl text-arcade-primary" data-testid="score-x">{xScore}</span>
          </div>
          <div className="arcade-label text-arcade-muted mt-1 truncate">
            {names.X ?? "—"}
          </div>
        </div>
        <div className="flex flex-col items-center justify-center px-2 gap-1">
          <div className="text-arcade-muted font-pixel text-xs">VS</div>
          <div className="arcade-label text-arcade-muted/80 text-[8px]" data-testid="score-draws">EMPATES: {draws}</div>
        </div>
        <div className={`flex-none w-[120px] arcade-panel p-3 text-center ${oBorder}`} data-testid="scoreboard-o">
          <div className="flex items-center justify-center gap-2">
            <span className="font-pixel text-2xl text-arcade-pink">O</span>
            <span className="font-pixel text-2xl text-arcade-pink" data-testid="score-o">{oScore}</span>
          </div>
          <div className="arcade-label text-arcade-muted mt-1 truncate">
            {names.O ?? "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
