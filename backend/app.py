# ==============================================================================
# HOW TO RUN THE BACKEND FLASK SERVER:
#
# Windows (PowerShell):
#   .\venv\Scripts\python.exe app.py
#
# Windows (CMD):
#   venv\Scripts\python.exe app.py
#
# Linux / macOS:
#   python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt && python app.py
# ==============================================================================

import base64
import io
import os
import sys

from flask import Flask, jsonify, request
from flask_cors import CORS
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from fourier.fourier_transform import FourierTransform
from image.image_loader import ImageLoader


def create_app():
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    @app.get("/api/health")
    def health():
        return jsonify(status="ok")

    @app.post("/api/process")
    def process_image():
        upload = request.files.get("image")
        if upload is None or not upload.filename:
            return jsonify(error="Choose a PNG or JPEG image."), 400
        try:
            filter_name = request.form.get("filter", "gaussian").lower()
            cutoff = float(request.form.get("cutoff", 35))
            order = int(request.form.get("order", 2))
            mode = request.form.get("mode", "blur").lower()
            boost = float(request.form.get("boost", 1.5))
            matrix = ImageLoader().load_rgb_from_bytes(upload.read())
            transforms = [FourierTransform(matrix[..., channel]) for channel in range(3)]
            brush = None
            if request.form.get("brush_x") is not None:
                brush = (
                    float(request.form.get("brush_x")), # type: ignore
                    float(request.form.get("brush_y")), # type: ignore
                    float(request.form.get("brush_radius", 0.08)),
                )
            processed_channels = []
            for transform in transforms:
                processed_channels.append(
                    transform.high_boost(cutoff, boost, order, brush)
                    if mode == "sharpen"
                    else transform.apply_filter(filter_name, cutoff, order, brush=brush)
                )
            processed = np.stack(processed_channels, axis=-1)
            luminance = matrix[..., :3] @ np.array([0.2989, 0.5870, 0.1140])
            spectrum = FourierTransform(luminance).spectrum_image()
        except ValueError as exc:
            return jsonify(error=str(exc)), 400

        def png_data_url(array):
            buffer = io.BytesIO()
            image = Image.fromarray(array, mode="RGB" if array.ndim == 3 else "L")
            image.save(buffer, format="PNG")
            encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
            return f"data:image/png;base64,{encoded}"

        return jsonify(
            processedImage=png_data_url(processed),
            spectrumImage=png_data_url(spectrum),
            metadata={"filter": filter_name, "cutoff": cutoff, "order": order, "mode": mode, "boost": boost, "width": transforms[0].width, "height": transforms[0].height, "channels": 3},
        )

    @app.post("/api/decompose_shape")
    def decompose_shape():
        data = request.get_json(silent=True) or {}
        points = data.get("points")
        harmonics = data.get("harmonics")
        if not points or not isinstance(points, list):
            return jsonify(error="Please provide an array of [x, y] points."), 400
        try:
            result = FourierTransform.decompose_shape_contour(points, harmonics)
            return jsonify(result)
        except ValueError as exc:
            return jsonify(error=str(exc)), 400

    @app.errorhandler(413)
    def too_large(_error):
        return jsonify(error="Image must be smaller than 10 MB."), 413

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)

