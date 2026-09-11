import io

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError


class ImageLoader:
    """Decode uploads into image matrices for 2D DFT processing."""

    def _load_rgb(self, image_bytes: bytes, max_dimension: int = 128) -> np.ndarray:
        if not image_bytes:
            raise ValueError("uploaded image is empty")
        try:
            with Image.open(io.BytesIO(image_bytes)) as source:
                source.verify()
            with Image.open(io.BytesIO(image_bytes)) as source:
                image = ImageOps.exif_transpose(source).convert("RGB")
                image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
                pixels = np.asarray(image, dtype=float)
        except (UnidentifiedImageError, OSError) as exc:
            raise ValueError("uploaded file is not a valid image") from exc
        return pixels[..., :3]

    def load_from_bytes(self, image_bytes: bytes, max_dimension: int = 128) -> np.ndarray:
        return self.image_grayscale_converter(self._load_rgb(image_bytes, max_dimension))

    def load_rgb_from_bytes(self, image_bytes: bytes, max_dimension: int = 128) -> np.ndarray:
        return self._load_rgb(image_bytes, max_dimension)

    def image_grayscale_converter(self, image: np.ndarray) -> np.ndarray:
        image = np.asarray(image)
        if image.ndim != 3 or image.shape[2] < 3:
            raise ValueError("RGB image data is required")
        return image[..., :3] @ np.array([0.2989, 0.5870, 0.1140])
