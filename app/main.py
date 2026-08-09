import base64
import os
import tempfile

import cv2
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.detector import detect_hazards
from app.landing import find_landing_candidates


app = FastAPI(
    title="LunarSafe AI API",
    version="0.1.0"
)


# For the hackathon MVP.
# Later this can be restricted to the deployed Native.builder domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def encode_jpeg_data_url(image):
    success, encoded_image = cv2.imencode(
        ".jpg",
        image
    )

    if not success:
        raise RuntimeError(
            "Could not encode result image."
        )

    image_base64 = base64.b64encode(
        encoded_image.tobytes()
    ).decode("utf-8")

    return (
        "data:image/jpeg;base64,"
        + image_base64
    )


@app.get("/")
def root():
    return {
        "name": "LunarSafe AI API",
        "status": "online"
    }


@app.get("/health")
def health():
    return {
        "status": "ok"
    }


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    craft_size: str = Form("medium"),
    safety_margin: str = Form("standard")
):
    craft_size = craft_size.lower()
    safety_margin = safety_margin.lower()

    craft_radius_ratios = {
        "small": 0.018,
        "medium": 0.030,
        "large": 0.045
    }

    safety_margin_ratios = {
        "low": 0.005,
        "standard": 0.010,
        "high": 0.020
    }
    if craft_size not in craft_radius_ratios:
        raise HTTPException(
            status_code=400,
            detail="Invalid craft_size."
        )

    if safety_margin not in safety_margin_ratios:
        raise HTTPException(
            status_code=400,
            detail="Invalid safety_margin."
        )



    if file.content_type not in {
        "image/jpeg",
        "image/png",
        "image/webp"
    }:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG and WebP images are supported."
        )

    contents = await file.read()

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty."
        )

    suffix = os.path.splitext(file.filename or "")[1]

    if not suffix:
        suffix = ".jpg"

    temp_path = None

    try:
        # Existing detector works with a file path,
        # so for the MVP we temporarily save the upload.
        with tempfile.NamedTemporaryFile(
            suffix=suffix,
            delete=False
        ) as temp_file:
            temp_file.write(contents)
            temp_path = temp_file.name

        image, hazard_mask, contours = detect_hazards(
            temp_path
        )
        # Normalize pixel-based mission parameters to image resolution.
        # The 1000 px reference preserves the behavior of the original
        # prototype on 1000x1000 test imagery.
        min_dimension = min(
            image.shape[0],
            image.shape[1]
        )

        craft_radius = max(
            3,
            int(
                round(
                    min_dimension
                    * craft_radius_ratios[craft_size]
                )
            )
        )

        safety_margin_px = max(
            1,
            int(
                round(
                    min_dimension
                    * safety_margin_ratios[safety_margin]
                )
            )
        )
        analysis = find_landing_candidates(
            hazard_mask,
            count=3,
            safety_margin=safety_margin_px,
            craft_radius=craft_radius
        )

        # Dedicated potential-hazard visualization.
        hazard_visualization = image.copy()

        hazard_pixels = (
            hazard_mask > 0
        )

        hazard_red_layer = hazard_visualization.copy()
        hazard_red_layer[hazard_pixels] = (0, 0, 255)

        hazard_visualization = cv2.addWeighted(
            hazard_visualization,
            0.60,
            hazard_red_layer,
            0.40,
            0
        )

        # Dedicated distance-transform visualization.
        distance_map = analysis["distance_map"]

        distance_normalized = cv2.normalize(
            distance_map,
            None,
            0,
            255,
            cv2.NORM_MINMAX,
            dtype=cv2.CV_8U
        )

        distance_visualization = cv2.applyColorMap(
            distance_normalized,
            cv2.COLORMAP_VIRIDIS
        )

        distance_visualization[
            analysis["expanded_hazards"] > 0
        ] = (0, 0, 0)

        # Landing Zones visualization.
        visualization = image.copy()

        expanded_hazard_pixels = (
            analysis["expanded_hazards"] > 0
        )

        red_layer = visualization.copy()
        red_layer[
            expanded_hazard_pixels
        ] = (0, 0, 255)

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

        candidates_json = []

        for index, candidate in enumerate(
            analysis["candidates"]
        ):
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

            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.6
            font_thickness = 2

            (text_width, text_height), _ = cv2.getTextSize(
                label,
                font,
                font_scale,
                font_thickness
            )

            text_x = x + 18
            text_y = max(
                text_height + 5,
                y - 15
            )

            # If the label would leave the image on the right,
            # draw it to the left of the landing marker instead.
            if (
                text_x + text_width
                > visualization.shape[1] - 5
            ):
                text_x = max(
                    5,
                    x - text_width - 18
                )

            text_y = min(
                visualization.shape[0] - 5,
                text_y
            )

            cv2.putText(
                visualization,
                label,
                (text_x, text_y),
                font,
                font_scale,
                color,
                font_thickness
            )

            candidates_json.append({
                "rank": candidate["rank"],
                "label": labels[index],
                "x": int(x),
                "y": int(y),
                "clearance_px": round(
                    candidate["clearance_px"],
                    2
                ),
                "craft_radius_px": craft_radius,
                "score": candidate["score"],
                "risk": candidate["risk"]
            })

        hazard_map_image = encode_jpeg_data_url(
            hazard_visualization
        )

        distance_map_image = encode_jpeg_data_url(
            distance_visualization
        )

        annotated_image = encode_jpeg_data_url(
            visualization
        )

        best_site = (
            candidates_json[0]
            if candidates_json
            else None
        )

        return {
            "success": True,
            "image_width": int(image.shape[1]),
            "image_height": int(image.shape[0]),
            "hazard_regions": len(contours),
            "mission_parameters": {
                "craft_size": craft_size,
                "craft_radius_px": craft_radius,
                "safety_margin": safety_margin,
                "safety_margin_px": safety_margin_px
            },
            "best_site": best_site,
            "landing_candidates": candidates_json,
            "hazard_map_image": hazard_map_image,
            "distance_map_image": distance_map_image,
            "annotated_image": annotated_image
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc)
        )

    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)