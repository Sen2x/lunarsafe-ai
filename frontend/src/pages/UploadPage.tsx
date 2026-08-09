import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import { UploadCloud, ImagePlus, AlertTriangle, Rocket } from "lucide-react";
import { analyzeImage } from "../api/analyzeClient";
import { cacheResult } from "../store";
import Header from "../components/Header";
import AnalysisProgress from "../components/AnalysisProgress";

type StepState = "pending" | "active" | "done";
type StepDef = { label: string; state: StepState };

const ANALYSIS_STEPS = [
  "Preprocessing image…",
  "Detecting hazards…",
  "Evaluating landing zones…",
  "Computing safety score…",
] as const;

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

interface AnalysisProgressState {
  percent: number;
  statusText: string;
  stepIndex: number;
  done: boolean;
}

export default function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<AnalysisProgressState>({
    percent: 0,
    statusText: "Ready",
    stepIndex: 0,
    done: false,
  });

  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Cleanup old preview URL + interval on unmount */
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, []);

  const handleFile = useCallback((f: File) => {
    setError(null);
    if (!f.type.startsWith("image/")) {
      setError("Please select an image file (JPEG, PNG, WebP).");
      return;
    }
    if (f.size > MAX_SIZE_BYTES) {
      setError("File exceeds 20 MB limit. Choose a smaller image.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }, [previewUrl]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const startAnalysis = useCallback(async () => {
    if (!file) return;
    setAnalyzing(true);
    setError(null);

    const steps: StepDef[] = ANALYSIS_STEPS.map((label, i) => ({
      label,
      state: i === 0 ? "active" as const : "pending" as const,
    }));

    setProgress({ percent: 2, statusText: steps[0].label, stepIndex: 0, done: false });

    let cancel = false;
    const tick = () => {
      if (cancel) return;
      setProgress((prev) => {
        if (prev.done) return prev;
        const step = prev.stepIndex;
        const stepStart = [2, 22, 57, 87][step];
        const stepEnd = [20, 55, 85, 96][step];
        const increment = 0.3 + Math.random() * 1.2;
        let nextPercent = Math.min(stepEnd, prev.percent + increment);
        let nextStep = step;
        let nextText = steps[step].label;
        if (nextPercent >= stepEnd && step < 3) {
          nextStep = step + 1;
          nextPercent = stepStart + increment;
          nextText = steps[nextStep].label;
        }
        return { percent: nextPercent, statusText: nextText, stepIndex: nextStep, done: false };
      });
    };

    progressRef.current = setInterval(tick, 120);

    try {
      const result = await analyzeImage(file);
      cancel = true;
      if (progressRef.current) clearInterval(progressRef.current);

      setProgress({
        percent: 100,
        statusText: "Analysis complete",
        stepIndex: 3,
        done: true,
      });

      cacheResult(result);
      await new Promise((r) => setTimeout(r, 450));
      navigate(`/results/${result.id}`);
    } catch (err) {
      cancel = true;
      if (progressRef.current) clearInterval(progressRef.current);
      setAnalyzing(false);
      setError(
        err instanceof Error ? err.message : "Analysis failed. Please try again.",
      );
    }
  }, [file, navigate]);

  // Build steps array for progress component
  const stepsForDisplay: StepDef[] = ANALYSIS_STEPS.map((label, i) => ({
    label,
    state: (i < progress.stepIndex ? "done" : i === progress.stepIndex ? "active" : "pending") as StepState,
  }));

  return (
    <div className="flex min-h-screen flex-col bg-space">
      <Header />

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl animate-fade-in">
          {/* Hero text */}
          <div className="mb-8 text-center">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Lunar Terrain Assessment
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Upload orbital lunar imagery for automated hazard-region detection, landing-candidate evaluation, and quantitative terrain assessment using a classical Computer Vision pipeline.
            </p>
          </div>

          {/* Dropzone */}
          {!analyzing && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              className={`group relative cursor-pointer rounded-xl border-2 border-dashed p-2 transition-all duration-200 ${
                isDragOver
                  ? "border-accent bg-accent/5"
                  : "border-border hover:border-accent/50 hover:bg-muted/30"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleInputChange}
                className="sr-only"
                aria-label="Select an image for analysis"
              />

              {previewUrl ? (
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt="Selected lunar surface image"
                    className="h-auto w-full rounded-lg object-contain max-h-[60vh]"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="rounded-full bg-background/80 p-3 backdrop-blur-sm">
                      <ImagePlus size={24} className="text-accent" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-16">
                  <div className="rounded-full bg-muted p-4">
                    <UploadCloud size={32} className="text-muted-foreground" />
                  </div>
                  <p className="font-heading text-sm font-medium text-foreground/80">
                    Drop lunar imagery here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    JPEG, PNG, WebP &middot; Max 20 MB
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 flex animate-slide-up items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Progress / CTA */}
          <div className="mt-6 flex flex-col items-center gap-4">
            {analyzing ? (
              <AnalysisProgress
                percent={progress.percent}
                statusText={progress.statusText}
                steps={stepsForDisplay}
              />
            ) : (
              <button
                onClick={startAnalysis}
                disabled={!file}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-bold text-black shadow-lg shadow-amber-500/30 transition-all duration-150 hover:bg-amber-400 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400 disabled:shadow-none disabled:opacity-50"
              >
                <Rocket size={16} />
                Analyze Image
              </button>
            )}
          </div>

          {/* Info note */}
          <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground/60">
            Image is sent to the LunarSafe CV API for analysis. Results are held in memory for this session only. &middot; v0.2
          </p>
        </div>
      </main>
    </div>
  );
}