import cv2

from app.detector import detect_hazards
from app.landing import find_best_landing_site


image, hazard_mask, contours = detect_hazards(
    "data/test/moon.jpg"
)

result = find_best_landing_site(hazard_mask)

x, y = result["point"]
clearance = result["clearance_px"]

visualization = image.copy()

# Mark hazards red
hazard_pixels = result["expanded_hazards"] > 0
visualization[hazard_pixels] = (0, 0, 255)

# Best landing point
cv2.circle(
    visualization,
    (x, y),
    12,
    (0, 255, 0),
    3
)

cv2.circle(
    visualization,
    (x, y),
    3,
    (0, 255, 0),
    -1
)

cv2.putText(
    visualization,
    "BEST LANDING SITE",
    (x + 15, y - 15),
    cv2.FONT_HERSHEY_SIMPLEX,
    0.7,
    (0, 255, 0),
    2
)

cv2.imwrite(
    "data/results/landing_result.jpg",
    visualization
)

print("Hazard regions:", len(contours))
print("Best landing point:", (x, y))
print("Clearance:", round(clearance, 2), "px")
print("Saved: data/results/landing_result.jpg")
