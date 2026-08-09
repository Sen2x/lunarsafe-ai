import { useRef, useEffect, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Circle, Group, Text } from "react-konva";
import type { AnalysisResult, LandingCandidate, VisualizationMode } from "../types/analysis";

interface Props {
  result: AnalysisResult;
  /** Container width the canvas should fill */
  containerWidth: number;
  /** Which visualisation to show */
  visualizationMode: VisualizationMode;
  /** Callback when stage mounts */
  onStageReady?: (stage: import("konva/lib/Stage").Stage | null) => void;
  /** Currently selected landing zone id (driven by sidebar) */
  selectedCandidateId?: string | null;
  onSelectCandidate?: (id: string) => void;
}

export default function HazardCanvas({
  result,
  containerWidth,
  visualizationMode,
  onStageReady,
  selectedCandidateId = null,
  onSelectCandidate,
}: Props) {
  const stageRef = useRef<import("konva/lib/Stage").Stage>(null);

  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [hazardMapImage, setHazardMapImage] = useState<HTMLImageElement | null>(null);
  const [distanceMapImage, setDistanceMapImage] = useState<HTMLImageElement | null>(null);
  const [annotatedImage, setAnnotatedImage] = useState<HTMLImageElement | null>(null);
  const [hoveredCandidate, setHoveredCandidate] = useState<LandingCandidate | null>(null);

  /* Load the original uploaded image */
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setOriginalImage(img);
    img.src = result.imageUrl;
    return () => { img.onload = null; };
  }, [result.imageUrl]);

  /* Load the backend-generated hazard map */
  useEffect(() => {
    if (!result.hazardMapImage) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setHazardMapImage(img);
    img.src = result.hazardMapImage;
    return () => { img.onload = null; };
  }, [result.hazardMapImage]);

  /* Load the backend-generated distance map */
  useEffect(() => {
    if (!result.distanceMapImage) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setDistanceMapImage(img);
    img.src = result.distanceMapImage;
    return () => { img.onload = null; };
  }, [result.distanceMapImage]);

  /* Load the server-annotated image */
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setAnnotatedImage(img);
    img.src = result.annotatedImageUrl;
    return () => { img.onload = null; };
  }, [result.annotatedImageUrl]);

  /* Notify parent about stage */
  useEffect(() => {
    onStageReady?.(stageRef.current);
  }, [onStageReady]);

  /* Responsive canvas sizing */
  const aspectRatio = result.imageWidth / result.imageHeight;
  const canvasW = Math.min(containerWidth, result.imageWidth);
  const canvasH = canvasW / aspectRatio;
  const scaleX = canvasW / result.imageWidth;
  const scaleY = canvasH / result.imageHeight;

  /* Select image for the current mode */
  let displayImage: HTMLImageElement | null = null;
  let loadingLabel = "";
  switch (visualizationMode) {
    case "original":
      displayImage = originalImage;
      loadingLabel = "LOADING ORIGINAL IMAGE…";
      break;
    case "hazard":
      displayImage = hazardMapImage;
      loadingLabel = "LOADING HAZARD MAP…";
      break;
    case "distance":
      displayImage = distanceMapImage;
      loadingLabel = "LOADING DISTANCE MAP…";
      break;
    case "landing-zones":
      displayImage = annotatedImage;
      loadingLabel = "LOADING ANNOTATED IMAGE…";
      break;
  }

  /* Loading skeleton until the relevant image is ready */
  if (!displayImage) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-border bg-muted/30"
        style={{ width: canvasW, height: canvasH }}
      >
        <p className="font-heading text-[10px] tracking-widest text-muted-foreground animate-pulse-soft">
          {loadingLabel}
        </p>
      </div>
    );
  }

  return (
    <Stage
      ref={stageRef}
      width={canvasW}
      height={canvasH}
      className="konva-container"
    >
      <Layer>
        {/* Base image from backend */}
        <KonvaImage
          image={displayImage}
          width={result.imageWidth * scaleX}
          height={result.imageHeight * scaleY}
        />

        {/* Landing Zone overlays — shown only in landing-zones mode */}
        {visualizationMode === "landing-zones" &&
          result.landingCandidates.map((c) => {
            const cx = c.x * scaleX;
            const cy = c.y * scaleY;

            const r = c.clearance_px * scaleX;
            const craftR = c.craft_radius_px * scaleX;

            const isHovered = hoveredCandidate?.rank === c.rank;
            const isSelected = selectedCandidateId === String(c.rank);

            const siteColor =
              c.label === "A"
                ? "oklch(0.68 0.15 145)"
                : c.label === "B"
                  ? "oklch(0.85 0.18 95)"
                  : "oklch(0.78 0.15 195)";

            const siteFill =
              c.label === "A"
                ? "oklch(0.68 0.15 145 / 0.16)"
                : c.label === "B"
                  ? "oklch(0.85 0.18 95 / 0.16)"
                  : "oklch(0.78 0.15 195 / 0.16)";

            return (
              <Group key={`${c.rank}-${c.label}`}>
                {/* Clearance — only for selected site */}
                {isSelected && (
                  <Circle
                    x={cx}
                    y={cy}
                    radius={r}
                    stroke={siteColor}
                    strokeWidth={3}
                    dash={[6, 4]}
                    fill={siteFill}
                    shadowBlur={16}
                    shadowColor={siteColor}
                    listening={false}
                  />
                )}

                {/* Craft / required landing radius — always visible */}
                <Circle
                  x={cx}
                  y={cy}
                  radius={craftR}
                  stroke={siteColor}
                  strokeWidth={isSelected ? 3 : 2}
                  fill={siteFill}
                  shadowBlur={isSelected ? 12 : 0}
                  shadowColor={siteColor}
                  onMouseEnter={() => setHoveredCandidate(c)}
                  onMouseLeave={() => setHoveredCandidate(null)}
                  onTap={() => {
                    setHoveredCandidate(c);
                    onSelectCandidate?.(String(c.rank));
                  }}
                  onClick={() => {
                    setHoveredCandidate(c);
                    onSelectCandidate?.(String(c.rank));
                  }}
                />

                {isHovered && (
                  <CandidateTooltip
                    candidate={c}
                    x={cx + craftR + 8}
                    y={cy - 30}
                  />
                )}
              </Group>
            );
          })}
      </Layer>
    </Stage>
  );
}

/* ── Tooltip ── */

function CandidateTooltip({
  candidate,
  x,
  y,
}: {
  candidate: LandingCandidate;
  x: number;
  y: number;
}) {
  return (
    <Group x={x + 6} y={y}>
      <Text
        text={`Site ${candidate.label}  ${candidate.score}/100`}
        fontSize={10}
        fontFamily="Fira Code, monospace"
        fill="oklch(0.68 0.15 145)"
        width={170}
        padding={6}
        background="oklch(0.13 0.02 265 / 0.92)"
        cornerRadius={4}
        listening={false}
      />
      <Text
        text={`${candidate.clearance_px.toFixed(1)} px clearance · ${candidate.risk}`}
        fontSize={9}
        fontFamily="Fira Sans, sans-serif"
        fill="oklch(0.7 0.02 265)"
        width={170}
        x={6}
        y={20}
        listening={false}
      />
    </Group>
  );
}