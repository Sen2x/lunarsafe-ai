import cv2

from app.detector import detect_hazards
from app.landing import find_landing_candidates


image, hazard_mask, contours = detect_hazards(
    "data/test/moon.jpg"
)

result = find_landing_candidates(
    hazard_mask,
    count=3
)

visualization = image.copy()

# Red transparent overlay for unsafe areas
hazard_pixels = result["expanded_hazards"] > 0

red_layer = visualization.copy()
red_layer[hazard_pixels] = (0, 0, 255)

visualization = cv2.addWeighted(
    visualization,
    0.60,
    red_layer,
    0.40,
    0
)

labels = ["A", "B", "C"]

colors = [
    (0, 255, 0),
    (0, 255, 255),
    (255, 255, 0)
]

for index, candidate in enumerate(result["candidates"]):
    x, y = candidate["point"]
    color = colors[index]

    cv2.circle(
        visualization,
        (x, y),
        14,
        color,
        3
    )

    cv2.circle(
        visualization,
        (x, y),
        4,
        color,
        -1
    )

    label = (
        f"SITE {labels[index]} "
        f"{candidate['score']}/100"
    )

    cv2.putText(
        visualization,
        label,
        (x + 18, y - 15),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        color,
        2
    )


cv2.imwrite(
    "data/results/landing_candidates.jpg",
    visualization
)


print()
print("=== LunarSafe Landing Analysis ===")
print()

for index, candidate in enumerate(result["candidates"]):
    print(
        f"Site {labels[index]}:"
        f" point={candidate['point']},"
        f" clearance={candidate['clearance_px']:.1f}px,"
        f" score={candidate['score']}/100,"
        f" risk={candidate['risk']}"
    )

print()
print("Saved: data/results/landing_candidates.jpg")
