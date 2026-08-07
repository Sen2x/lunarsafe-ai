import cv2
import numpy as np


def detect_hazards(image_path: str):
    image = cv2.imread(image_path)

    if image is None:
        raise FileNotFoundError(f"Could not read image: {image_path}")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    blurred = cv2.GaussianBlur(gray, (7, 7), 0)

    # Detect strong terrain boundaries
    edges = cv2.Canny(blurred, 90, 190)

    kernel = np.ones((3, 3), np.uint8)

    edges = cv2.morphologyEx(
        edges,
        cv2.MORPH_CLOSE,
        kernel,
        iterations=1
    )

    contours, _ = cv2.findContours(
        edges,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    image_area = gray.shape[0] * gray.shape[1]

    min_area = 120
    max_area = image_area * 0.025

    filtered_contours = []

    for contour in contours:
        area = cv2.contourArea(contour)

        if min_area <= area <= max_area:
            filtered_contours.append(contour)

    hazard_mask = np.zeros_like(gray)

    cv2.drawContours(
        hazard_mask,
        filtered_contours,
        -1,
        255,
        thickness=cv2.FILLED
    )

    # Detect only large areas of deep shadow
    shadow_raw = cv2.inRange(gray, 0, 18)

    shadow_kernel = np.ones((5, 5), np.uint8)

    shadow_raw = cv2.morphologyEx(
        shadow_raw,
        cv2.MORPH_OPEN,
        shadow_kernel,
        iterations=1
    )

    shadow_contours, _ = cv2.findContours(
        shadow_raw,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    shadow_mask = np.zeros_like(gray)

    min_shadow_area = image_area * 0.003

    for contour in shadow_contours:
        if cv2.contourArea(contour) >= min_shadow_area:
            cv2.drawContours(
                shadow_mask,
                [contour],
                -1,
                255,
                thickness=cv2.FILLED
            )

    hazard_mask = cv2.bitwise_or(
        hazard_mask,
        shadow_mask
    )

    return image, hazard_mask, filtered_contours
