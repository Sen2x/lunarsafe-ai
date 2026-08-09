import { Image, Map as MapIcon, Crosshair, Layers } from "lucide-react";
import type { VisualizationMode } from "../types/analysis";

interface Props {
  mode: VisualizationMode;
  onChange: (mode: VisualizationMode) => void;
}

const TABS: {
  id: VisualizationMode;
  label: string;
  icon: typeof Image;
  desc: string;
}[] = [
  {
    id: "original",
    label: "Original",
    icon: Image,
    desc: "Raw uploaded image",
  },
  {
    id: "hazard",
    label: "Hazard Map",
    icon: MapIcon,
    desc: "CV-detected hazards",
  },
  {
    id: "distance",
    label: "Distance Map",
    icon: Layers,
    desc: "Distance from hazards heatmap",
  },
  {
    id: "landing-zones",
    label: "Landing Zones",
    icon: Crosshair,
    desc: "Annotated safe sites",
  },
];

export default function VisualizationToggle({ mode, onChange }: Props) {
  return (
    <div
      className="flex rounded-lg border border-border bg-muted/40 p-0.5"
      role="radiogroup"
      aria-label="Visualization mode"
    >
      {TABS.map((tab) => {
        const isActive = mode === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            role="radio"
            aria-checked={isActive}
            aria-label={tab.desc}
            onClick={() => onChange(tab.id)}
            className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold tracking-wider transition-all duration-150 ${
              isActive
                ? "bg-accent text-accent-foreground shadow-glow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
            }`}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.label.charAt(0)}</span>
          </button>
        );
      })}
    </div>
  );
}