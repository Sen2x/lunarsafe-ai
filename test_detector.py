import cv2

from app.detector import detect_hazards


image, hazard_mask, contours = detect_hazards(
    "data/test/moon.jpg"
)

cv2.imwrite(
    "data/results/hazard_mask.png",
    hazard_mask
)

print("Detected hazard regions:", len(contours))
print("Saved: data/results/hazard_mask.png")
