import { AlertTriangle, Map, Target } from "lucide-react";
import type { AnalysisResult } from "../types/analysis";

interface Props {
  result: AnalysisResult;
}

export default function MetricsPanel({ result }: Props) {
  const metrics = [
    {
      label: "Hazard Regions",
      value: String(result.hazardRegions),
      unit: "",
      icon: AlertTriangle,
      hint: "Potential hazards detected",
    },
    {
      label: "Landing Sites",
      value: String(result.landingCandidates.length),
      unit: "",
      icon: Target,
      hint: "Candidate zones ranked",
    },
    {
      label: "Image Size",
      value: `${result.imageWidth} × ${result.imageHeight}`,
      unit: "px",
      icon: Map,
      hint: "Analyzed resolution",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <div
            key={m.label}
            className="rounded-lg border border-border bg-background/40 p-3 transition-colors hover:bg-muted/40"
          >
            <div className="mb-1 flex items-center gap-1.5">
              <Icon size={12} className="text-muted-foreground" />
              <span className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
                {m.label}
              </span>
            </div>
            <p className="font-heading text-lg font-semibold tracking-tight text-foreground">
              {m.value}
              {m.unit && (
                <span className="ml-0.5 text-xs text-muted-foreground">
                  {m.unit}
                </span>
              )}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground/70">
              {m.hint}
            </p>
          </div>
        );
      })}
    </div>
  );
}