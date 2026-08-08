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

    craft_margins = {
        "small": 0,
        "medium": 10,
        "large": 25
    }

    safety_margins = {
        "low": 0,
        "standard": 4,
        "high": 10
    }

    if craft_size not in craft_margins:
        raise HTTPException(
            status_code=400,
            detail="Invalid craft_size."
        )

    if safety_margin not in safety_margins:
        raise HTTPException(
            status_code=400,
            detail="Invalid safety_margin."
        )

    effective_safety_margin = (
        craft_margins[craft_size]
        + safety_margins[safety_margin]
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

        analysis = find_landing_candidates(
            hazard_mask,
            count=3,
            safety_margin=effective_safety_margin
        )

        visualization = image.copy()

        # Semi-transparent red hazard overlay.
        hazard_pixels = (
            analysis["expanded_hazards"] > 0
        )

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

            cv2.putText(
                visualization,
                label,
                (x + 18, y - 15),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                color,
                2
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
                "score": candidate["score"],
                "risk": candidate["risk"]
            })

        # Encode annotated result image as JPEG.
        success, encoded_image = cv2.imencode(
            ".jpg",
            visualization
        )

        if not success:
            raise RuntimeError(
                "Could not encode result image."
            )

        image_base64 = base64.b64encode(
            encoded_image.tobytes()
        ).decode("utf-8")

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
                "safety_margin": safety_margin,
                "effective_safety_margin_px": effective_safety_margin
            },
            "best_site": best_site,
            "landing_candidates": candidates_json,
            "annotated_image": (
                "data:image/jpeg;base64,"
                + image_base64
            )
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
