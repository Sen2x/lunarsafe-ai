import cv2
import numpy as np


def detect_hazards(image_path: str):
    image = cv2.imread(image_path)

    if image is None:
        raise FileNotFoundError(f"Could not read image: {image_path}")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    edges = cv2.Canny(blurred, 60, 140)

    kernel = np.ones((5, 5), np.uint8)

    hazard_mask = cv2.dilate(
        edges,
        kernel,
        iterations=2
    )

    contours, _ = cv2.findContours(
        hazard_mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    filtered_contours = []

    for contour in contours:
        area = cv2.contourArea(contour)

        if area >= 80:
            filtered_contours.append(contour)

    clean_mask = np.zeros_like(gray)

    cv2.drawContours(
        clean_mask,
        filtered_contours,
        -1,
        255,
        thickness=cv2.FILLED
    )

    return image, clean_mask, filtered_contours
