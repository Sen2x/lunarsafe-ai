import cv2
import numpy as np


def prepare_landing_maps(
    hazard_mask,
    safety_margin=10,
    border_margin=25
):
    # Expand hazards so the lander does not select
    # a point immediately next to an obstacle.
    size = safety_margin * 2 + 1
    kernel = np.ones((size, size), np.uint8)

    expanded_hazards = cv2.dilate(
        hazard_mask,
        kernel,
        iterations=1
    )

    # Image borders are unsafe because we cannot
    # evaluate terrain outside the image.
    expanded_hazards[:border_margin, :] = 255
    expanded_hazards[-border_margin:, :] = 255
    expanded_hazards[:, :border_margin] = 255
    expanded_hazards[:, -border_margin:] = 255

    # distanceTransform expects non-zero pixels
    # to represent the area in which distances are measured.
    safe_mask = cv2.bitwise_not(expanded_hazards)

    distance_map = cv2.distanceTransform(
        safe_mask,
        cv2.DIST_L2,
        5
    )

    return expanded_hazards, safe_mask, distance_map


def calculate_site_score(
    point,
    clearance_px,
    expanded_hazards,
    craft_radius
):
    x, y = point
    height, width = expanded_hazards.shape

    # The craft must have at least one craft radius
    # of clearance from the expanded hazard boundary.
    minimum_clearance = float(craft_radius)

    # A clearance of three craft radii is treated as
    # a strong safety margin for this prototype.
    target_clearance = float(craft_radius) * 3.0

    # Score only the EXTRA clearance beyond the minimum
    # required for the craft footprint to fit.
    clearance_range = (
        target_clearance
        - minimum_clearance
    )

    extra_clearance = max(
        0.0,
        clearance_px - minimum_clearance
    )

    if clearance_range <= 0:
        clearance_score = 0.0
    else:
        clearance_score = min(
            100.0,
            (
                extra_clearance
                / clearance_range
            ) * 100.0
        )

    # Examine terrain around the candidate.
    local_radius = 70

    x1 = max(0, x - local_radius)
    x2 = min(width, x + local_radius)
    y1 = max(0, y - local_radius)
    y2 = min(height, y + local_radius)

    local_region = expanded_hazards[
        y1:y2,
        x1:x2
    ]

    if local_region.size == 0:
        local_safety_score = 0.0
    else:
        hazard_fraction = (
            np.count_nonzero(local_region)
            / local_region.size
        )

        local_safety_score = (
            1.0 - hazard_fraction
        ) * 100.0

    # Clearance remains the dominant factor.
    score = (
        0.75 * clearance_score
        + 0.25 * local_safety_score
    )

    score = int(
        round(
            max(
                0,
                min(100, score)
            )
        )
    )

    if score >= 80:
        risk = "LOW"
    elif score >= 60:
        risk = "MODERATE"
    else:
        risk = "HIGH"

    return score, risk


def find_landing_candidates(
    hazard_mask,
    count=3,
    safety_margin=10,
    craft_radius=30,
    border_margin=25,
    min_separation=120
):
    expanded_hazards, safe_mask, distance_map = prepare_landing_maps(
        hazard_mask,
        safety_margin=safety_margin,
        border_margin=border_margin
    )

    # Copy because we will suppress already selected areas.
    search_map = distance_map.copy()

    # A landing craft can only be centered where the entire
    # craft footprint fits inside the safe region.
    search_map[distance_map < craft_radius] = 0

    candidates = []

    for index in range(count):
        _, max_distance, _, best_point = cv2.minMaxLoc(search_map)

        if max_distance <= 0:
            break

        score, risk = calculate_site_score(
    best_point,
    max_distance,
    expanded_hazards,
    craft_radius
)

        candidates.append({
            "rank": index + 1,
            "point": best_point,
            "clearance_px": float(max_distance),
            "score": score,
            "risk": risk
        })

        # Prevent the next candidate from being almost
        # in the same location.
        cv2.circle(
            search_map,
            best_point,
            min_separation,
            0,
            thickness=-1
        )

    return {
        "candidates": candidates,
        "expanded_hazards": expanded_hazards,
        "safe_mask": safe_mask,
        "distance_map": distance_map
    }


def find_best_landing_site(hazard_mask):
    result = find_landing_candidates(
        hazard_mask,
        count=1
    )

    if not result["candidates"]:
        raise RuntimeError("No safe landing site found.")

    best = result["candidates"][0]

    return {
        "point": best["point"],
        "clearance_px": best["clearance_px"],
        "score": best["score"],
        "risk": best["risk"],
        "expanded_hazards": result["expanded_hazards"],
        "safe_mask": result["safe_mask"],
        "distance_map": result["distance_map"]
    }
