import base64
import io
import os
import sys

from flask import Flask, jsonify, request
from flask_cors import CORS
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
            matrix = ImageLoader().load_from_bytes(upload.read())
            transform = FourierTransform(matrix)
            processed = transform.apply_filter(filter_name, cutoff, order)
            spectrum = transform.spectrum_image()
        except ValueError as exc:
            return jsonify(error=str(exc)), 400

        def png_data_url(array):
            buffer = io.BytesIO()
            Image.fromarray(array, mode="L").save(buffer, format="PNG")
            encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
            return f"data:image/png;base64,{encoded}"

        return jsonify(
            processedImage=png_data_url(processed),
            spectrumImage=png_data_url(spectrum),
            metadata={"filter": filter_name, "cutoff": cutoff, "order": order, "width": transform.width, "height": transform.height},
        )

    @app.errorhandler(413)
    def too_large(_error):
        return jsonify(error="Image must be smaller than 10 MB."), 413

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
