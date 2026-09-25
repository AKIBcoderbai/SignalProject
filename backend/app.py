"""Run with: uvicorn app:app --reload --port 5000"""

import base64
import io
import logging
import os
from uuid import UUID, uuid4

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image

from secret_transform import analyze_attack, analyze_pair, embed, extract
from supabase_connection import BUCKET, admin_client, current_user_id
from fourier.brush_processing import process_image

load_dotenv()
logger = logging.getLogger(__name__)
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

app = FastAPI(title="Fourier Image API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


def upload_bytes(image: UploadFile) -> bytes:
    data = image.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image must be smaller than 10 MB.")
    if not data:
        raise HTTPException(status_code=400, detail="Choose a PNG or JPEG image.")
    return data


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/secret/embed")
def embed_secret(
    image: UploadFile = File(...), message: str = Form(...),
    password: str = Form(...), robust: bool = Form(True),
    user_id: str = Depends(current_user_id),
):
    try:
        png, capacity = embed(upload_bytes(image), message, password, robust=robust)
        with Image.open(io.BytesIO(png)) as result:
            width, height = result.size
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    image_id = str(uuid4())
    path = f"{user_id}/{image_id}.png"
    database = admin_client()
    try:
        database.storage.from_(BUCKET).upload(
            path, png, {"content-type": "image/png", "upsert": "false"}
        )
        database.table("protected_images").insert({
            "id": image_id, "user_id": user_id, "storage_path": path,
            "width": width, "height": height,
            "message_bytes": len(message.encode("utf-8")),
        }).execute()
    except Exception as exc:
        logger.exception("Could not save protected image")
        try:
            database.storage.from_(BUCKET).remove([path])
        except Exception:
            logger.exception("Could not remove incomplete upload")
        raise HTTPException(status_code=502, detail="Could not save image. Check Supabase setup.") from exc

    return {"imageId": image_id, "protectedImage": "data:image/png;base64," +
            base64.b64encode(png).decode("ascii"), "capacityBytes": capacity,
            "messageBytes": len(message.encode("utf-8")),
            "format": "v3" if robust and min(width, height) >= 256 else "v2"}


@app.post("/api/secret/extract")
def extract_secret(
    image: UploadFile = File(...), password: str = Form(...),
    mode: str = Form("auto"),
):
    try:
        return {"message": extract(upload_bytes(image), password, mode=mode)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/secret/analyze")
def analyze_images(
    original: UploadFile = File(...), protected: UploadFile = File(...),
    _user_id: str = Depends(current_user_id),
):
    try:
        return analyze_pair(upload_bytes(original), upload_bytes(protected))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/image-edit/brush")
def brush_edit(
    image: UploadFile = File(...), operation: str = Form(...), mode: str = Form("spatial"),
    brush_size: float = Form(...), strength: float = Form(...), strokes: str = Form(...),
    channel: str = Form("rgb"), _user_id: str = Depends(current_user_id),
):
    """Apply a non-destructive local blur/sharpen preview using manual signal code."""
    try:
        edited, mask, metadata = process_image(
            upload_bytes(image), operation, mode, brush_size, strength, strokes, channel
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "image": "data:image/png;base64," + base64.b64encode(edited).decode("ascii"),
        "mask": "data:image/png;base64," + base64.b64encode(mask).decode("ascii"),
        "metadata": metadata,
    }


@app.post("/api/secret/attack")
def attack_image(
    image: UploadFile = File(...), password: str = Form(...),
    attack: str = Form(...), quality: int | None = Form(None),
    scale: float | None = Form(None), crop: str | None = Form(None),
    _user_id: str = Depends(current_user_id),
):
    try:
        return analyze_attack(
            upload_bytes(image), password, attack,
            quality=quality, scale=scale, crop=crop,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/secret/images")
def list_images(user_id: str = Depends(current_user_id)):
    try:
        rows = (admin_client().table("protected_images")
                .select("id,width,height,message_bytes,created_at")
                .eq("user_id", user_id).order("created_at", desc=True).execute())
        return {"images": rows.data}
    except Exception as exc:
        logger.exception("Could not list images")
        raise HTTPException(status_code=502, detail="Could not list images.") from exc


@app.get("/api/secret/images/{image_id}")
def download_image(image_id: UUID, user_id: str = Depends(current_user_id)):
    try:
        rows = (admin_client().table("protected_images").select("storage_path")
                .eq("id", str(image_id)).eq("user_id", user_id).limit(1).execute())
        if not rows.data:
            raise HTTPException(status_code=404, detail="Image not found.")
        png = admin_client().storage.from_(BUCKET).download(rows.data[0]["storage_path"]) # type: ignore
        return Response(png, media_type="image/png",
                        headers={"Content-Disposition": f'attachment; filename="{image_id}.png"'})
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Could not download image")
        raise HTTPException(status_code=502, detail="Could not download image.") from exc
