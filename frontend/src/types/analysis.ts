export type Verdict = "GO" | "CAUTION" | "NO-GO";

/** Which visualisation the user is viewing on the results canvas */
export type VisualizationMode = "original" | "hazard" | "distance" | "landing-zones";

/** Internal mission parameters (sent to backend, not user-configurable via UI) */
export interface MissionParams {
  craftSize: "small" | "medium" | "large";
  safetyMargin: "low" | "standard" | "high";
}

/** A single landing candidate site from the LunarSafe API */
export interface LandingCandidate {
  rank: number;
  label: string; // "A", "B", "C", …
  x: number; // pixel coordinate on annotated image
  y: number; // pixel coordinate on annotated image
  clearance_px: number;
  craft_radius_px: number;
  score: number; // 0–100
  risk: "LOW" | "MODERATE" | "HIGH";
}

/** Raw shape the API returns */
export interface AnalysisResponse {
  success: boolean;
  image_width: number;
  image_height: number;
  hazard_regions: number;
  best_site: LandingCandidate;
  landing_candidates: LandingCandidate[];
  hazard_map_image: string; // backend-generated hazard visualization
  distance_map_image: string; // backend-generated distance transform
  annotated_image: string; // "data:image/jpeg;base64,…"
}

/** Normalised result stored in session cache & used by UI */
export interface AnalysisResult {
  id: string;
  /** Original uploaded image (object URL for preview) */
  imageUrl: string;
  /** Server-annotated image (base64 data URL with hazards drawn) */
  annotatedImageUrl: string;
  /** Backend-generated hazard-map visualization */
  hazardMapImage: string;
  /** Backend-generated distance-map visualization */
  distanceMapImage: string;
  /** Overall safety score 0–100 (from best_site.score) */
  safetyScore: number;
  verdict: Verdict;
  /** Number of hazard regions detected */
  hazardRegions: number;
  /** All landing candidates */
  landingCandidates: LandingCandidate[];
  /** Best single site (copy of first entry) */
  bestSite: LandingCandidate;
  imageWidth: number;
  imageHeight: number;
  analyzedAt: number;
}