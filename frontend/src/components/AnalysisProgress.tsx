import { Check } from "lucide-react";

interface Step {
  label: string;
  state: "pending" | "active" | "done";
}

interface Props {
  /** Overall analysis progress 0–100 */
  percent: number;
  /** Human-readable status line */
  statusText: string;
  steps: Step[];
}

/** 4 planet emojis that orbit with a ring */
const PLANETS = ["🪐", "🌍", "🌑", "🌙"];

export default function AnalysisProgress({ percent, statusText, steps }: Props) {
  return (
    <div className="w-full max-w-md animate-fade-in">
      {/* progress bar with rocket tip */}
      <div className="relative mb-4 h-2 w-full overflow-visible rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
        {/* Rocket emoji flying at the tip */}
        <span
          className="absolute top-1/2 -translate-y-1/2 text-lg leading-none transition-all duration-500 ease-out"
          style={{ left: `calc(${percent}% - 10px)` }}
          aria-hidden="true"
        >
          🚀
        </span>
      </div>

      {/* status text */}
      <p className="mb-4 font-heading text-xs tracking-wider text-accent">
        {statusText}
      </p>

      {/* steps */}
      <ul className="space-y-2">
        {steps.map((step) => (
          <li
            key={step.label}
            className={`flex items-center gap-2.5 transition-opacity duration-300 ${
              step.state === "pending" ? "opacity-40" : "opacity-100"
            }`}
          >
            <span
              className="relative flex h-5 w-5 shrink-0 items-center justify-center"
            >
              {step.state === "done" ? (
                <span
                  className="flex h-full w-full items-center justify-center rounded-full text-[11px] font-bold"
                  style={{
                    background: "var(--color-success)",
                    borderColor: "var(--color-success)",
                  }}
                >
                  <Check size={12} className="text-accent-foreground" />
                </span>
              ) : step.state === "active" ? (
                /* Planet orbit spinner */
                <span className="relative flex h-5 w-5 items-center justify-center">
                  {/* Orbital ring */}
                  <span
                    className="absolute inset-0 rounded-full border border-accent/40 animate-orbit"
                    aria-hidden="true"
                  />
                  {/* 4 planets positioned around the ring */}
                  {PLANETS.map((planet, i) => {
                    const angle = (i * 90 * Math.PI) / 180;
                    const r = 10; // orbit radius in px
                    const x = Math.cos(angle) * r;
                    const y = Math.sin(angle) * r;
                    return (
                      <span
                        key={i}
                        className="absolute text-[7px] leading-none animate-orbit-reverse"
                        style={{
                          transform: `translate(${x}px, ${y}px)`,
                        }}
                        aria-hidden="true"
                      >
                        {planet}
                      </span>
                    );
                  })}
                </span>
              ) : (
                <span className="flex h-full w-full items-center justify-center rounded-full border text-[11px]"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <span className="text-muted-foreground">•</span>
                </span>
              )}
            </span>
            <span
              className={`font-heading text-xs tracking-wider ${
                step.state === "done"
                  ? "text-success"
                  : step.state === "active"
                    ? "text-accent"
                    : "text-muted-foreground"
              }`}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
