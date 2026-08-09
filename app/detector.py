import cv2
import numpy as np


def detect_hazards(image_path: str):
    image = cv2.imread(image_path)

    if image is None:
        raise FileNotFoundError(f"Could not read image: {image_path}")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


    # 1. Improve local contrast before terrain analysis


    clahe = cv2.createCLAHE(
        clipLimit=2.0,
        tileGridSize=(8, 8)
    )

    normalized = clahe.apply(gray)

    blurred = cv2.GaussianBlur(
        normalized,
        (5, 5),
        0
    )


    # 2. Gradient / terrain-boundary signal


    image_area = gray.shape[0] * gray.shape[1]

    # Horizontal intensity changes
    sobel_x = cv2.Sobel(
        blurred,
        cv2.CV_32F,
        1,
        0,
        ksize=3
    )

    # Vertical intensity changes
    sobel_y = cv2.Sobel(
        blurred,
        cv2.CV_32F,
        0,
        1,
        ksize=3
    )

    # Combine horizontal and vertical gradients
    gradient_magnitude = cv2.magnitude(
        sobel_x,
        sobel_y
    )

    # Normalize gradient into 0-255 range
    gradient_map = cv2.normalize(
        gradient_magnitude,
        None,
        0,
        255,
        cv2.NORM_MINMAX
    ).astype(np.uint8)

    # Keep only relatively strong visual boundaries
    _, gradient_mask = cv2.threshold(
        gradient_map,
        85,
        255,
        cv2.THRESH_BINARY
    )

    gradient_kernel = np.ones(
        (3, 3),
        np.uint8
    )

    # Remove isolated gradient noise
    gradient_mask = cv2.morphologyEx(
        gradient_mask,
        cv2.MORPH_OPEN,
        gradient_kernel,
        iterations=1
    )



    # 3. Local visual texture signal


    # Convert to float so variance calculations are accurate.
    gray_float = normalized.astype(np.float32)

    # Analyze local neighborhoods.
    texture_window = (15, 15)

    # Local average intensity.
    local_mean = cv2.boxFilter(
        gray_float,
        cv2.CV_32F,
        texture_window
    )

    # Local average of squared intensity.
    local_mean_sq = cv2.boxFilter(
        gray_float * gray_float,
        cv2.CV_32F,
        texture_window
    )

    # Variance = E[x^2] - E[x]^2
    local_variance = (
        local_mean_sq
        - local_mean * local_mean
    )

    # Numerical calculations may produce tiny negative values.
    local_variance = np.maximum(
        local_variance,
        0
    )

    # Standard deviation describes local visual variation.
    local_std = np.sqrt(
        local_variance
    )

    # Normalize texture variation into the 0-255 range.
    texture_map = cv2.normalize(
        local_std,
        None,
        0,
        255,
        cv2.NORM_MINMAX
    ).astype(np.uint8)

    # 4. Detect large areas of deep shadow


    shadow_raw = cv2.inRange(
        gray,
        0,
        18
    )

    shadow_kernel = np.ones(
        (5, 5),
        np.uint8
    )

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


    # 5. Combine visual signals into a continuous risk map


    # Convert all signals to floating-point values from 0.0 to 1.0.
    gradient_signal = (
        gradient_map.astype(np.float32) / 255.0
    )

    texture_signal = (
        texture_map.astype(np.float32) / 255.0
    )

    shadow_signal = (
        shadow_mask.astype(np.float32) / 255.0
    )

    # Prototype engineering weights.
    # These values are heuristic and are NOT scientific probabilities.
    gradient_weight = 0.55
    texture_weight = 0.30
    shadow_weight = 0.15

    risk = (
        gradient_weight * gradient_signal
        + texture_weight * texture_signal
        + shadow_weight * shadow_signal
    )

    risk = np.clip(
        risk,
        0.0,
        1.0
    )

    # Convert the continuous risk map back to 0-255.
    risk_map = (
        risk * 255.0
    ).astype(np.uint8)


    # 6. Convert risk map into a binary hazard mask


    _, hazard_mask = cv2.threshold(
        risk_map,
        95,
        255,
        cv2.THRESH_BINARY
    )

    # Deep shadows are always preserved as potential hazards,
    # even if their gradient/texture contribution is weak.
    hazard_mask = cv2.bitwise_or(
        hazard_mask,
        shadow_mask
    )

    # Remove tiny isolated noise.
    cleanup_kernel = np.ones(
        (3, 3),
        np.uint8
    )

    hazard_mask = cv2.morphologyEx(
        hazard_mask,
        cv2.MORPH_OPEN,
        cleanup_kernel,
        iterations=1
    )

    # Close very small gaps inside nearby risk structures.
    hazard_mask = cv2.morphologyEx(
        hazard_mask,
        cv2.MORPH_CLOSE,
        cleanup_kernel,
        iterations=1
    )


    # 7. Build contours from the FINAL hazard mask


    filtered_contours, _ = cv2.findContours(
        hazard_mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    return image, hazard_mask, filtered_contours