import cv2
import numpy as np


def find_best_landing_site(
    hazard_mask,
    safety_margin=10,
    border_margin=25
):
    # Expand hazards so we do not land too close to them
    size = safety_margin * 2 + 1
    kernel = np.ones((size, size), np.uint8)

    expanded_hazards = cv2.dilate(
        hazard_mask,
        kernel,
        iterations=1
    )

    # Image borders are also unsafe
    expanded_hazards[:border_margin, :] = 255
    expanded_hazards[-border_margin:, :] = 255
    expanded_hazards[:, :border_margin] = 255
    expanded_hazards[:, -border_margin:] = 255

    # White = safe, black = hazard
    safe_mask = cv2.bitwise_not(expanded_hazards)

    # Distance from every safe pixel to nearest hazard
    distance = cv2.distanceTransform(
        safe_mask,
        cv2.DIST_L2,
        5
    )

    _, max_distance, _, best_point = cv2.minMaxLoc(distance)

    return {
        "point": best_point,
        "clearance_px": float(max_distance),
        "expanded_hazards": expanded_hazards,
        "safe_mask": safe_mask,
        "distance_map": distance
    }
