import { Circle, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import type { VisualizationMode } from "../types/analysis";

interface Props {
  /** Which view mode is currently active */
  mode: VisualizationMode;
}

export default function SafetyLegend({ mode }: Props) {
  return (
    <div className="rounded-lg border border-border bg-muted/50 p-3">
      <h4 className="mb-2 font-heading text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Map Legend
      </h4>

      {mode === "original" && (
        <ul className="space-y-1.5">
          <li className="flex items-center gap-2 text-xs text-muted-foreground/70">
            <span className="flex h-4 w-4 items-center justify-center rounded border border-border bg-muted">
              <span className="text-[9px]">i</span>
            </span>
            <span>Raw unprocessed image as uploaded</span>
          </li>
          <li className="flex items-center gap-2 text-xs text-muted-foreground/70">
            <DownloadIcon />
            <span>Use the toggle above to switch views</span>
          </li>
        </ul>
      )}

      {mode === "hazard" && (
        <ul className="space-y-1.5">
          <li className="flex items-center gap-2 text-xs text-foreground/80">
            <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-destructive">
              <span className="text-[9px] font-bold text-white">!</span>
            </span>
            <span>Detected potential hazard region (red overlay)</span>
          </li>
          <li className="flex items-center gap-2 text-xs text-muted-foreground/70">
            <span className="flex h-4 w-4 items-center justify-center rounded border border-border bg-muted">
              <span className="text-[9px]">⊕</span>
            </span>
            <span>Brightness + texture analysis</span>
          </li>
          <li className="flex items-center gap-2 text-xs text-muted-foreground/70">
            <DownloadIcon />
            <span>Adaptive threshold vs. local mean</span>
          </li>
        </ul>
      )}

      {mode === "landing-zones" && (
        <ul className="space-y-1.5">
          <li className="flex items-center gap-2 text-xs text-foreground/80">
            <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-success bg-success/20">
              <Circle size={6} className="text-success" />
            </span>
            <span>Landing candidate — recommended zone</span>
          </li>
          <li className="flex items-center gap-2 text-xs text-foreground/80">
            <ShieldCheck size={12} className="text-success" />
            <span>LOW risk — favourable terrain</span>
          </li>
          <li className="flex items-center gap-2 text-xs text-foreground/80">
            <ShieldAlert size={12} className="text-warning" />
            <span>MODERATE risk — requires assessment</span>
          </li>
          <li className="flex items-center gap-2 text-xs text-foreground/80">
            <ShieldX size={12} className="text-destructive" />
            <span>HIGH risk — not recommended</span>
          </li>
          <li className="flex items-center gap-2 text-xs text-muted-foreground/70">
            <span className="text-[10px]">⏺</span>
            <span>Hazard annotations drawn on image</span>
          </li>
        </ul>
      )}

      {mode === "distance" && (
        <ul className="space-y-1.5">
          <li className="flex items-center gap-2 text-xs text-foreground/80">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm" style={{ background: '#000004' }} />
            <span>Unsafe / expanded hazard region</span>
          </li>
          <li className="flex items-center gap-2 text-xs text-foreground/80">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm" style={{ background: '#3B0F70' }} />
            <span>Very low clearance</span>
          </li>
          <li className="flex items-center gap-2 text-xs text-foreground/80">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm" style={{ background: '#298F8F' }} />
            <span>Low to moderate clearance</span>
          </li>
          <li className="flex items-center gap-2 text-xs text-foreground/80">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm" style={{ background: '#46AB79' }} />
            <span>High clearance</span>
          </li>
          <li className="flex items-center gap-2 text-xs text-foreground/80">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm" style={{ background: '#FDE725' }} />
            <span>Maximum clearance</span>
          </li>
        </ul>
      )}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="shrink-0 text-muted-foreground/60"
    >
      <path
        d="M8 3v7M5 7l3 3 3-3M3 11v1a1 1 0 001 1h8a1 1 0 001-1v-1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}