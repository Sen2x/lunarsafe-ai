import type { AnalysisResult, AnalysisResponse, MissionParams } from "../types/analysis";

/** Cloudflare-deployed LunarSafe CV endpoint */
const ANALYZE_ENDPOINT =
  "https://lunarsafe-ai.onrender.com/analyze";

function generateId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Map API risk → UI verdict */
function riskToVerdict(risk: string): "GO" | "CAUTION" | "NO-GO" {
  switch (risk) {
    case "LOW":
      return "GO";
    case "MODERATE":
      return "CAUTION";
    case "HIGH":
      return "NO-GO";
    default:
      return "CAUTION";
  }
}

/**
 * Send the uploaded lunar image to the CV API.
 *
 *  - synchronous POST
 *  - multipart/form-data, field name `file`
 */
export async function analyzeImage(
  file: File,
  missionParams?: MissionParams
): Promise<AnalysisResult> {
  const form = new FormData();

  form.append("file", file);
  form.append("craft_size", missionParams?.craftSize ?? "medium");
  form.append("safety_margin", missionParams?.safetyMargin ?? "standard");

  let res: Response;
  try {
    res = await fetch(ANALYZE_ENDPOINT, { method: "POST", body: form });
  } catch {
    throw new Error(
      "Could not reach the analysis server. Please check your connection and try again.",
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Analysis server returned ${res.status}.${body ? ` ${body}` : ""}`,
    );
  }

  let json: AnalysisResponse;
  try {
    json = (await res.json()) as AnalysisResponse;
  } catch {
    throw new Error("Invalid response from analysis server.");
  }

  if (!json.success) {
    throw new Error("Analysis failed. Please try a different image.");
  }

  const best = json.best_site;
  const imageUrl = URL.createObjectURL(file);

  return {
    id: `SAFE-${generateId()}`,
    imageUrl,
    annotatedImageUrl: json.annotated_image,
    hazardMapImage: json.hazard_map_image,
    distanceMapImage: json.distance_map_image,
    safetyScore: best.score,
    verdict: riskToVerdict(best.risk),
    hazardRegions: json.hazard_regions,
    landingCandidates: json.landing_candidates,
    bestSite: best,
    imageWidth: json.image_width,
    imageHeight: json.image_height,
    analyzedAt: Date.now(),
  };
}