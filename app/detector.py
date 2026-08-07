import cv2
import numpy as np


def detect_hazards(image_path: str):
    image = cv2.imread(image_path)

    if image is None:
        raise FileNotFoundError(f"Could not read image: {image_path}")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    blurred = cv2.GaussianBlur(gray, (7, 7), 0)

    edges = cv2.Canny(blurred, 80, 180)

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

    min_area = 100
    max_area = image_area * 0.04

    filtered_contours = []

    for contour in contours:
        area = cv2.contourArea(contour)

        if min_area <= area <= max_area:
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
