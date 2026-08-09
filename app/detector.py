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
    # ---------------------------------------------------------
    # 5. Detect crater-like closed structures
    # ---------------------------------------------------------

        # ---------------------------------------------------------
    # 5. Detect crater-like closed structures
    # ---------------------------------------------------------

    crater_mask = np.zeros_like(gray)

    # Detect candidate closed boundaries.
    crater_edges = cv2.Canny(
        blurred,
        70,
        160
    )

    crater_kernel = np.ones(
        (3, 3),
        np.uint8
    )

    crater_edges = cv2.morphologyEx(
        crater_edges,
        cv2.MORPH_CLOSE,
        crater_kernel,
        iterations=1
    )

    crater_contours, _ = cv2.findContours(
        crater_edges,
        cv2.RETR_LIST,
        cv2.CHAIN_APPROX_SIMPLE
    )

    # Relative size limits make the detector
    # less dependent on one specific image resolution.
    min_crater_area = image_area * 0.0004
    max_crater_area = image_area * 0.025

    for contour in crater_contours:
        area = cv2.contourArea(contour)

        if area < min_crater_area or area > max_crater_area:
            continue

        perimeter = cv2.arcLength(
            contour,
            True
        )

        if perimeter <= 0:
            continue

        # Circularity:
        # 1.0 = perfect circle.
        circularity = (
            4.0 * np.pi * area
            / (perimeter * perimeter)
        )

        x, y, w, h = cv2.boundingRect(
            contour
        )

        if w == 0 or h == 0:
            continue

        aspect_ratio = (
            w / float(h)
        )

        # How much of the bounding rectangle
        # is actually occupied by the contour.
        extent = (
            area / float(w * h)
        )

        # Compare the contour with its minimum
        # enclosing circle.
        (_, _), radius = cv2.minEnclosingCircle(
            contour
        )

        if radius <= 0:
            continue

        enclosing_circle_area = (
            np.pi * radius * radius
        )

        circle_fill_ratio = (
            area / enclosing_circle_area
        )

        # A crater-like candidate must satisfy
        # several geometric conditions simultaneously.
        is_crater_like = (
            circularity >= 0.55
            and 0.65 <= aspect_ratio <= 1.55
            and extent >= 0.40
            and circle_fill_ratio >= 0.40
        )

        if not is_crater_like:
            continue

        cv2.drawContours(
            crater_mask,
            [contour],
            -1,
            255,
            thickness=cv2.FILLED
        )

    # Use gradient information to search for closed structures.
    crater_edges = cv2.Canny(
        blurred,
        60,
        140
    )

    crater_edges = cv2.morphologyEx(
        crater_edges,
        cv2.MORPH_CLOSE,
        np.ones((3, 3), np.uint8),
        iterations=2
    )

    crater_contours, _ = cv2.findContours(
        crater_edges,
        cv2.RETR_LIST,
        cv2.CHAIN_APPROX_SIMPLE
    )

    min_crater_area = image_area * 0.0003
    max_crater_area = image_area * 0.04

    for contour in crater_contours:
        area = cv2.contourArea(contour)

        if area < min_crater_area or area > max_crater_area:
            continue

        perimeter = cv2.arcLength(
            contour,
            True
        )

        if perimeter <= 0:
            continue

        # Circularity approaches 1.0 for a perfect circle.
        circularity = (
            4.0 * np.pi * area
            / (perimeter * perimeter)
        )

        x, y, w, h = cv2.boundingRect(contour)

        if h == 0:
            continue

        aspect_ratio = w / float(h)

        # Conservative crater-like shape filtering.
        if (
            circularity >= 0.45
            and 0.55 <= aspect_ratio <= 1.80
        ):
            cv2.drawContours(
                crater_mask,
                [contour],
                -1,
                255,
                thickness=cv2.FILLED
            )

     # 6. Combine visual signals into a continuous risk map


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
    crater_signal = (
        crater_mask.astype(np.float32) / 255.0
    )
    # Prototype engineering weights.
    # These values are heuristic and are NOT scientific probabilities.
    gradient_weight = 0.40
    texture_weight = 0.25
    shadow_weight = 0.15
    crater_weight = 0.35

    risk = (
        gradient_weight * gradient_signal
        + texture_weight * texture_signal
        + shadow_weight * shadow_signal
        + crater_weight * crater_signal
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


    # 7. Convert risk map into a binary hazard mask


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
    # Preserve detected crater-like interiors as potential hazards.
    hazard_mask = cv2.bitwise_or(
        hazard_mask,
        crater_mask
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


    # 8. Build contours from the FINAL hazard mask


    filtered_contours, _ = cv2.findContours(
        hazard_mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )
    # ---------------------------------------------------------
    # DEBUG OUTPUT
    # ---------------------------------------------------------

    import os

    debug_dir = "debug_signals"
    os.makedirs(debug_dir, exist_ok=True)

    cv2.imwrite(
        os.path.join(debug_dir, "01_normalized.jpg"),
        normalized
    )

    cv2.imwrite(
        os.path.join(debug_dir, "02_gradient_map.jpg"),
        gradient_map
    )

    cv2.imwrite(
        os.path.join(debug_dir, "03_texture_map.jpg"),
        texture_map
    )

    cv2.imwrite(
        os.path.join(debug_dir, "04_shadow_mask.jpg"),
        shadow_mask
    )

    cv2.imwrite(
        os.path.join(debug_dir, "05_crater_mask.jpg"),
        crater_mask
    )

    cv2.imwrite(
        os.path.join(debug_dir, "06_risk_map.jpg"),
        risk_map
    )

    cv2.imwrite(
        os.path.join(debug_dir, "07_hazard_mask.jpg"),
        hazard_mask
    )
    return image, hazard_mask, filtered_contours