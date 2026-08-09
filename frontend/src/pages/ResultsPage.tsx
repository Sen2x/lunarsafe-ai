import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Download,
  ArrowLeft,
  AlertTriangle,
  Eye,
  FileText,
  Crosshair,
  Layers,
  Info,
  BarChart3,
} from "lucide-react";
import type { Stage as KonvaStage } from "konva/lib/Stage";
import { getCachedResult } from "../store";
import type { LandingCandidate, VisualizationMode } from "../types/analysis";
import Header from "../components/Header";
import SafetyLegend from "../components/SafetyLegend";
import HazardCanvas from "../components/HazardCanvas";
import VisualizationToggle from "../components/VisualizationToggle";

/* ── Verdict configuration ── */
const VERDICT_META = {
  GO: {
    icon: ShieldCheck,
    label: "RECOMMENDED FOR FURTHER ASSESSMENT",
    desc: "Best candidate classified as LOW risk.",
    color: "var(--color-success)",
  },
  CAUTION: {
    icon: ShieldAlert,
    label: "CAUTION — Further Assessment Required",
    desc: "Best candidate classified as MODERATE risk. Manual review recommended.",
    color: "var(--color-warning)",
  },
  "NO-GO": {
    icon: ShieldX,
    label: "NO-GO — Conditions Require Reassessment",
    desc: "Best candidate classified as HIGH risk. Alternative area strongly recommended.",
    color: "var(--color-destructive)",
  },
} as const;

/** Risk badge styling */
const RISK_BADGE: Record<string, { label: string; cls: string }> = {
  LOW: { label: "LOW", cls: "bg-success/15 text-success border-success/30" },
  MODERATE: { label: "MOD", cls: "bg-warning/15 text-warning border-warning/30" },
  HIGH: { label: "HIGH", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

/* ── Helper: Euclidean distance ── */
function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

/* ── Helper: format number consistently ── */
function fmt(n: number, d = 1): string {
  return n.toFixed(d);
}

/* ── Helper: Normalized clearance percentage ── */
function normClearancePct(c: LandingCandidate, dim: number): string {
  return `${((c.clearance_px / dim) * 100).toFixed(1)}%`;
}

/* ── Helper: build coordinate string ── */
function coordsStr(c: LandingCandidate): string {
  return `(${Math.round(c.x)}, ${Math.round(c.y)})`;
}

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const result = id ? getCachedResult(id) : undefined;

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<KonvaStage | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>("landing-zones");

  /* Responsive canvas sizing */
  useEffect(() => {
    const measure = () => {
      if (canvasContainerRef.current) {
        setContainerWidth(canvasContainerRef.current.clientWidth);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const handleStageReady = useCallback((s: KonvaStage | null) => {
    stageRef.current = s;
  }, []);

  const handleSelectCandidate = useCallback((cid: string) => {
    setSelectedCandidateId((prev) => (prev === cid ? null : cid));
  }, []);

  /* ── Derive all metrics from real data ── */
  const derived = useMemo(() => {
    if (!result) return null;
    const { imageWidth: W, imageHeight: H, hazardRegions, landingCandidates: cands, bestSite } = result;

    const imageArea = W * H;
    const imageAreaMP = imageArea / 1_000_000;
    const minDim = Math.min(W, H);

    const hazardDensity = imageAreaMP > 0 ? hazardRegions / imageAreaMP : 0;
    const normClearance = minDim > 0 ? (bestSite.clearance_px / minDim) * 100 : 0;

    const sorted = [...cands].sort((a, b) => b.score - a.score);
    const scoreAdvantage = sorted.length >= 2 ? sorted[0].score - sorted[1].score : 0;
    const scoreRange = sorted.length >= 2 ? sorted[0].score - sorted[sorted.length - 1].score : 0;

    const pairs: { a: string; b: string; d: number }[] = [];
    for (let i = 0; i < cands.length; i++) {
      for (let j = i + 1; j < cands.length; j++) {
        pairs.push({
          a: cands[i].label,
          b: cands[j].label,
          d: dist(cands[i].x, cands[i].y, cands[j].x, cands[j].y),
        });
      }
    }
    const minSeparation = pairs.length > 0 ? Math.min(...pairs.map((p) => p.d)) : 0;

    const riskCount: Record<string, number> = { LOW: 0, MODERATE: 0, HIGH: 0 };
    for (const c of cands) {
      if (riskCount[c.risk] !== undefined) riskCount[c.risk]++;
    }

    return { imageArea, hazardDensity, normClearance, scoreAdvantage, scoreRange, pairs, minSeparation, riskCount, minDim };
  }, [result]);

  /* ── Empty / not-found state ── */
  if (!result) {
    return (
      <div className="flex min-h-screen flex-col bg-space">
        <Header />
        <main className="flex flex-1 items-center justify-center px-4">
          <div className="animate-fade-in text-center">
            <AlertTriangle size={40} className="mx-auto mb-4 text-muted-foreground" />
            <h2 className="mb-2 font-heading text-lg font-semibold text-foreground">
              Analysis Not Found
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              This analysis may have expired or the link is invalid.
            </p>
            <button
              onClick={() => navigate("/")}
              className="btn-primary inline-flex items-center gap-2"
            >
              <ArrowLeft size={16} />
              Analyze a New Image
            </button>
          </div>
        </main>
      </div>
    );
  }

  const verdictMeta = VERDICT_META[result.verdict];
  const VerdictIcon = verdictMeta.icon;
  const d = derived!;
  const cands = result.landingCandidates;
  const best = result.bestSite;
  const dimLabel = `${result.imageWidth} × ${result.imageHeight}`;

  return (
    <div className="flex min-h-screen flex-col bg-space">
      <Header />

      {/* ── 1. EXECUTIVE ASSESSMENT ── */}
      <section className="border-b border-border bg-muted/20 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <Crosshair size={16} className="text-primary" />
            <h2 className="font-heading text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Lunar Terrain Assessment
            </h2>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/20 text-[10px] font-bold text-success">
              {best.label}
            </span>
            <span className="font-heading text-sm font-bold text-foreground">
              {best.score}
              <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">/100</span>
            </span>
            <span className={`rounded-sm border px-1.5 py-px text-[9px] font-semibold tracking-wide ${RISK_BADGE[best.risk]?.cls ?? RISK_BADGE.MODERATE.cls}`}>
              {best.risk}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {fmt(best.clearance_px)} px hazard clearance
          </div>
          <div className="text-[11px] text-muted-foreground">
            {result.hazardRegions} potential hazard regions evaluated
          </div>
          <div className={`ml-auto flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold ${
            result.verdict === "GO"
              ? "bg-success/10 text-success"
              : result.verdict === "CAUTION"
                ? "bg-warning/10 text-warning"
                : "bg-destructive/10 text-destructive"
          }`}>
            <VerdictIcon size={14} />
            {verdictMeta.label}
          </div>
        </div>
        <p className="mx-auto mt-1.5 max-w-7xl text-[10px] text-muted-foreground/70">
          Candidate {best.label} ranks highest under the current visual hazard assessment.
        </p>
      </section>

      {/* ── 2. MAIN CONTENT — Canvas + Sidebar ── */}
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between">
            <VisualizationToggle
              mode={visualizationMode}
              onChange={setVisualizationMode}
            />
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Eye size={12} />
              <span className="hidden sm:inline">View</span>
            </div>
          </div>
          <div ref={canvasContainerRef} className="w-full">
            {containerWidth > 0 && (
              <div className="animate-fade-in">
                <HazardCanvas
                  result={result}
                  containerWidth={containerWidth}
                  visualizationMode={visualizationMode}
                  onStageReady={handleStageReady}
                  selectedCandidateId={selectedCandidateId}
                  onSelectCandidate={handleSelectCandidate}
                />
              </div>
            )}

            {visualizationMode === "distance" && (
              <div className="mt-3 animate-fade-in rounded-lg border border-border bg-muted/40 p-3">
                <div className="mb-2 flex items-center gap-3">
                  <span className="font-heading text-[10px] font-semibold tracking-widest text-muted-foreground whitespace-nowrap">
                    UNSAFE / LOW CLEARANCE
                  </span>
                  <div
                    className="h-3 flex-1 rounded-sm"
                    style={{
                      background:
                        "linear-gradient(to right, #000004, #3B0F70, #25618D, #298F8F, #46AB79, #B5DE2B, #FDE725)",
                    }}
                    aria-hidden="true"
                  />
                  <span className="font-heading text-[10px] font-semibold tracking-widest text-muted-foreground whitespace-nowrap">
                    MAXIMUM CLEARANCE
                  </span>
                </div>
                <div className="flex justify-between px-0.5 mt-1 text-[8px] text-muted-foreground/60">
                  <span>Black — Unsafe / expanded hazard region</span>
                  <span>Dark purple — Very low clearance</span>
                  <span>Blue/cyan — Low to moderate clearance</span>
                  <span>Green — High clearance</span>
                  <span>Yellow — Maximum clearance</span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Backend-generated distance transform — brighter Viridis colors indicate greater image-space clearance from expanded potential hazards.
                </p>
              </div>
            )}

            <p className="mt-2 text-[10px] text-muted-foreground">
              {visualizationMode === "original" && "Raw uploaded image without annotations."}
              {visualizationMode === "hazard" && "Backend-generated hazard overlay — detected potential hazard regions highlighted in red."}
              {visualizationMode === "distance" && "Backend-generated distance transform — brighter Viridis colors indicate greater image-space clearance from expanded potential hazards."}
              {visualizationMode === "landing-zones" && "Backend-annotated image with expanded hazard overlay and landing site labels. Click a candidate to select it."}
            </p>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="flex w-full flex-col gap-4 lg:w-72">

          {/* 3. DECISION RATIONALE */}
          <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-1.5">
              <BarChart3 size={14} className="text-primary" />
              <h3 className="font-heading text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Decision Rationale
              </h3>
            </div>

            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success/20 text-sm font-bold text-success">
                {best.label}
              </span>
              <div>
                <p className="font-heading text-xs font-semibold text-foreground">
                  Recommended Candidate
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Ranked #{best.rank} &middot; {best.score}/100
                </p>
              </div>
            </div>

            <div className="mb-3 space-y-1 text-[11px]">
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">Hazard Clearance</span>
                <span className="font-heading text-foreground">{fmt(best.clearance_px)} px</span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">Normalized Clearance</span>
                <span className="font-heading text-foreground">{d.normClearance.toFixed(1)}% of shorter dimension</span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-1">
                <span className="text-muted-foreground">Score Advantage</span>
                <span className="font-heading text-foreground">+{d.scoreAdvantage} vs next candidate</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Risk Classification</span>
                <span className={`font-heading font-semibold ${best.risk === "LOW" ? "text-success" : best.risk === "MODERATE" ? "text-warning" : "text-destructive"}`}>{best.risk}</span>
              </div>
            </div>

            <p className="text-[10px] leading-relaxed text-muted-foreground/80">
              Candidate {best.label} ranks highest under the current heuristic assessment because it provides the strongest combination of hazard clearance and local terrain safety among the evaluated candidates. This recommendation requires further assessment before operational use.
            </p>
          </div>

          <SafetyLegend mode={visualizationMode} />

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                const payload = {
                  image_width: result.imageWidth,
                  image_height: result.imageHeight,
                  hazard_regions: result.hazardRegions,
                  best_site: best,
                  landing_candidates: cands,
                  safety_score: result.safetyScore,
                  verdict: result.verdict,
                  analyzed_at: result.analyzedAt,
                };
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.download = "lunarsafe-analysis.json";
                a.href = url;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="btn-export-primary"
            >
              <FileText size={16} />
              Download Analysis JSON
            </button>
            <button
              onClick={() => {
                const dataUrl = result?.annotatedImageUrl;
                if (!dataUrl) return;
                const [header, base64] = dataUrl.split(",");
                const mime = header.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
                const binary = atob(base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                  bytes[i] = binary.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: mime });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "lunarsafe-analysis.jpg";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
              className="btn-export-secondary"
            >
              <Download size={16} />
              Download Image
            </button>
            <button
              onClick={() => {
                URL.revokeObjectURL(result.imageUrl);
                navigate("/");
              }}
              className="btn-nav"
            >
              <ArrowLeft size={16} />
              Analyze New Image
            </button>
          </div>
        </aside>
      </div>

      {/* ═══ 4. LANDING CANDIDATE COMPARISON ═══ */}
      {cands.length > 0 && (
        <section className="border-t border-border px-4 py-5 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <h3 className="mb-3 font-heading text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Landing Candidate Comparison
            </h3>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2">Site</th>
                    <th className="px-3 py-2">Rank</th>
                    <th className="px-3 py-2">Coordinates</th>
                    <th className="px-3 py-2">Safety Score</th>
                    <th className="px-3 py-2">Clearance</th>
                    <th className="px-3 py-2">Normalized Clearance*</th>
                    <th className="px-3 py-2">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {[...cands].sort((a, b) => a.rank - b.rank).map((c) => {
                    const isBest = c.rank === best.rank;
                    const risk = RISK_BADGE[c.risk] ?? RISK_BADGE.MODERATE;
                    return (
                      <tr key={c.rank} className={`border-t border-border/50 transition-colors ${isBest ? "bg-success/5" : "hover:bg-muted/20"}`}>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${isBest ? "bg-success/20 text-success" : "bg-muted-foreground/20 text-muted-foreground"}`}>
                              {c.label}
                            </span>
                            {isBest && <span className="text-[9px] font-semibold text-success">RECOMMENDED</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-foreground/80">#{c.rank}</td>
                        <td className="px-3 py-2.5 font-mono text-foreground/80">{coordsStr(c)}</td>
                        <td className="px-3 py-2.5"><span className="font-heading font-semibold text-foreground">{c.score}</span><span className="text-muted-foreground">/100</span></td>
                        <td className="px-3 py-2.5 font-mono text-foreground/80">{fmt(c.clearance_px)} px</td>
                        <td className="px-3 py-2.5 font-mono text-foreground/80">{normClearancePct(c, d.minDim)}</td>
                        <td className="px-3 py-2.5"><span className={`rounded-sm border px-1.5 py-px text-[9px] font-semibold tracking-wide ${risk.cls}`}>{risk.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-1.5 text-[9px] text-muted-foreground/60">
              * Normalized clearance = clearance_px / shorter image dimension × 100, for cross-image comparison.
            </p>
          </div>
        </section>
      )}

      {/* ═══ 5. QUANTITATIVE TERRAIN ASSESSMENT ═══ */}
      <section className="border-t border-border px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <h3 className="mb-3 font-heading text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Quantitative Terrain Assessment
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
            <MetricCard label="Image Resolution" value={dimLabel} sub="pixels" />
            <MetricCard label="Image Area" value={d.imageArea.toLocaleString()} sub="px²" />
            <MetricCard label="Hazard Regions" value={String(result.hazardRegions)} sub="potential hazard regions detected" />
            <MetricCard label="Hazard Region Density" value={d.hazardDensity < 10 ? d.hazardDensity.toFixed(1) : d.hazardDensity.toFixed(0)} sub="regions / MP" tooltip="Detected hazard-region density = count / image area in megapixels. Does not represent physical terrain density." />
            <MetricCard label="Best-Site Clearance" value={fmt(best.clearance_px)} sub={`px · Site ${best.label}`} />
            <MetricCard label="Normalized Clearance" value={`${d.normClearance.toFixed(1)}%`} sub="of shorter image dimension" />
            <MetricCard label="Score Advantage" value={d.scoreAdvantage > 0 ? `+${d.scoreAdvantage}` : "0"} sub={`Site ${best.label} vs next candidate`} />
            <MetricCard label="Score Range" value={String(d.scoreRange)} sub="points across candidates" />
          </div>
        </div>
      </section>

      {/* ═══ 6. SPATIAL CANDIDATE DISTRIBUTION ═══ */}
      {d.pairs.length > 0 && (
        <section className="border-t border-border px-4 py-5 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <h3 className="mb-3 font-heading text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Spatial Candidate Distribution
            </h3>
            <div className="flex flex-wrap gap-4">
              {d.pairs.map((p) => (
                <div key={`${p.a}-${p.b}`} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                  <span className="font-heading text-[10px] font-bold text-foreground/80">{p.a} ↔ {p.b}</span>
                  <span className="font-mono text-xs text-foreground">{fmt(p.d)} px</span>
                </div>
              ))}
              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                <span className="font-heading text-[10px] font-bold text-primary/80">Minimum separation</span>
                <span className="font-mono text-xs text-primary">{fmt(d.minSeparation)} px</span>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground/60">
              Euclidean pixel distances between candidate centers. Larger separation indicates more spatially distinct alternatives.
            </p>
          </div>
        </section>
      )}

      {/* ═══ 7. ANALYSIS BASIS ═══ */}
      <section className="border-t border-border px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-1.5 mb-3">
            <Info size={12} className="text-muted-foreground" />
            <h3 className="font-heading text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Analysis Basis
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
            <div><p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Method</p><p className="font-mono text-foreground/80">Classical Computer Vision</p></div>
            <div><p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Hazard Processing</p><p className="font-mono text-foreground/80">OpenCV (Python backend)</p></div>
            <div><p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Selection Method</p><p className="font-mono text-foreground/80">Distance-based candidate ranking</p></div>
            <div><p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Scoring</p><p className="font-mono text-foreground/80">Clearance + local hazard assessment</p></div>
            <div><p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Measurement Space</p><p className="font-mono text-foreground/80">Image pixels</p></div>
            <div><p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Safety Score</p><p className="font-mono text-foreground/80">Heuristic relative suitability metric for comparative terrain assessment</p></div>
          </div>
          <p className="mt-3 text-[9px] text-muted-foreground/60">
            Measurements are image-space metrics unless physical scale metadata is available.
          </p>
        </div>
      </section>

      {/* ═══ 8. HOW LUNARSAFE WORKS ═══ */}
      <section className="border-t border-border px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-1.5 mb-3">
            <Layers size={12} className="text-muted-foreground" />
            <h3 className="font-heading text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              How LunarSafe Works
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { step: "01", title: "Upload", desc: "Orbital lunar image submitted via drag-and-drop or file picker (JPEG, PNG, WebP)." },
              { step: "02", title: "Analyze", desc: "Image is converted to grayscale, enhanced using CLAHE local contrast normalization, and smoothed before terrain analysis." },
              { step: "03", title: "Detect Hazards", desc: "Sobel gradient, local texture variation, and deep-shadow detection are combined into a heuristic multi-signal terrain risk map and potential hazard mask." },
              { step: "04", title: "Rank Candidates", desc: "Detected hazards are expanded by the selected safety margin. A distance transform measures clearance, and three spatially separated landing candidates are ranked using clearance relative to spacecraft size and local hazard density." },
              { step: "05", title: "Review", desc: "Interactive views show the Original image, Hazard Map, Distance Map, and Landing Zones with ranked candidates A, B, and C." },
              { step: "06", title: "Export", desc: "Download analysis data as JSON or export the annotated image." },
            ].map((item) => (
              <div key={item.step} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="font-heading text-[9px] font-bold text-primary">{item.step}</p>
                <p className="mt-0.5 font-heading text-[11px] font-semibold text-foreground">{item.title}</p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ── Metric card component ── */
function MetricCard({ label, value, sub, tooltip }: { label: string; value: string; sub: string; tooltip?: string }) {
  return (
    <div className="group relative rounded-lg border border-border/60 bg-muted/20 p-3 hover:border-border transition-colors">
      <p className="font-heading text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
        {tooltip && (
          <span className="ml-1 inline-block cursor-help text-muted-foreground/40 hover:text-muted-foreground/70" title={tooltip}>&#9432;</span>
        )}
      </p>
      <p className="mt-0.5 font-heading text-sm font-bold tracking-tight text-foreground">{value}</p>
      <p className="text-[9px] text-muted-foreground/70">{sub}</p>
    </div>
  );
}