"""Password-encrypted text hidden in 16x16 block Fourier coefficients.

This version preserves data through a PNG save/load cycle. It does not promise
survival after resizing, cropping, screenshots, or JPEG recompression.
"""

from io import BytesIO
from os import urandom

import numpy as np
from argon2.low_level import Type, hash_secret_raw
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from PIL import Image, ImageOps, UnidentifiedImageError

from fourier.fourier_transform import FourierTransform


BLOCK = 16
STEP = 256
COEFFICIENT = (3, 5)
VERSION = 1
SALT_BYTES = 16
NONCE_BYTES = 12
TAG_BYTES = 16
OVERHEAD = 2 + 1 + SALT_BYTES + NONCE_BYTES + TAG_BYTES
MAX_PIXELS = 2048 * 2048
AAD = b"Fourier-secret-v1"


def _load_rgb(image_bytes: bytes) -> np.ndarray:
    if not image_bytes:
        raise ValueError("The image is empty.")
    try:
        with Image.open(BytesIO(image_bytes)) as source:
            if source.width * source.height > MAX_PIXELS:
                raise ValueError("Image is too large (maximum 4 megapixels).")
            image = ImageOps.exif_transpose(source).convert("RGB")
            return np.asarray(image, dtype=np.uint8).copy()
    except (OSError, UnidentifiedImageError) as exc:
        raise ValueError("Please upload a valid PNG or JPEG image.") from exc


def _key(password: str, salt: bytes) -> bytes:
    if len(password) < 8:
        raise ValueError("Use an image passphrase of at least 8 characters.")
    return hash_secret_raw(
        secret=password.encode("utf-8"), salt=salt,
        time_cost=2, memory_cost=19_456, parallelism=1,
        hash_len=32, type=Type.ID,
    )


def capacity_bytes(image_bytes: bytes) -> int:
    image = _load_rgb(image_bytes)
    height, width = image.shape[:2]
    return max(0, ((height // BLOCK) * (width // BLOCK)) // 8 - OVERHEAD)


def _block_positions(height: int, width: int):
    for top in range(0, height - BLOCK + 1, BLOCK):
        for left in range(0, width - BLOCK + 1, BLOCK):
            yield top, left


def _read_bit(block: np.ndarray) -> int:
    coefficient = FourierTransform(block).forward()[COEFFICIENT]
    return int(np.rint(coefficient.real / STEP)) & 1


def _write_bit(block: np.ndarray, bit: int) -> np.ndarray:
    transform = FourierTransform(block)
    spectrum = transform.forward()
    y, x = COEFFICIENT
    current = spectrum[y, x]
    nearest = round((current.real / STEP - bit) / 2)
    target_real = (2 * nearest + bit) * STEP
    replacement = complex(target_real, current.imag)
    spectrum[y, x] = replacement
    spectrum[-y % BLOCK, -x % BLOCK] = replacement.conjugate()
    result = np.clip(np.rint(transform.inverse(spectrum)), 0, 255).astype(np.uint8)
    if _read_bit(result) != bit:
        raise ValueError("This image cannot reliably hold the message; try a different image.")
    return result


def _bits(data: bytes):
    for byte in data:
        for offset in range(7, -1, -1):
            yield (byte >> offset) & 1


def _read_bytes(blue: np.ndarray, byte_count: int, start_bit: int = 0) -> bytes:
    height, width = blue.shape
    positions = _block_positions(height, width)
    for _ in range(start_bit):
        next(positions)
    output = bytearray()
    for _ in range(byte_count):
        value = 0
        for _ in range(8):
            top, left = next(positions)
            value = (value << 1) | _read_bit(blue[top:top + BLOCK, left:left + BLOCK])
        output.append(value)
    return bytes(output)


def embed(image_bytes: bytes, message: str, password: str) -> tuple[bytes, int]:
    image = _load_rgb(image_bytes)
    plaintext = message.encode("utf-8")
    height, width = image.shape[:2]
    maximum = max(0, (height // BLOCK * (width // BLOCK)) // 8 - OVERHEAD)
    if not plaintext:
        raise ValueError("Enter a message.")
    if len(plaintext) > maximum:
        raise ValueError(f"This image holds at most {maximum} UTF-8 message bytes. Try a larger image.")

    salt, nonce = urandom(SALT_BYTES), urandom(NONCE_BYTES)
    ciphertext = AESGCM(_key(password, salt)).encrypt(nonce, plaintext, AAD)
    payload = bytes([VERSION]) + salt + nonce + ciphertext
    data = len(payload).to_bytes(2, "big") + payload
    blue = image[:, :, 2]
    for bit, (top, left) in zip(_bits(data), _block_positions(height, width)):
        blue[top:top + BLOCK, left:left + BLOCK] = _write_bit(
            blue[top:top + BLOCK, left:left + BLOCK], bit
        )

    output = BytesIO()
    Image.fromarray(image, mode="RGB").save(output, format="PNG")
    png = output.getvalue()
    if extract(png, password) != message:
        raise ValueError("The message did not survive PNG encoding. Try another image.")
    return png, maximum


def extract(image_bytes: bytes, password: str) -> str:
    image = _load_rgb(image_bytes)
    blue = image[:, :, 2]
    height, width = blue.shape
    available = (height // BLOCK) * (width // BLOCK)
    if available < OVERHEAD * 8:
        raise ValueError("No recoverable message was found in this image.")
    length = int.from_bytes(_read_bytes(blue, 2), "big")
    if length < OVERHEAD - 2 or (length + 2) * 8 > available:
        raise ValueError("No recoverable message was found in this image.")
    payload = _read_bytes(blue, length, start_bit=16)
    if payload[0] != VERSION:
        raise ValueError("No recoverable message was found in this image.")
    salt = payload[1:1 + SALT_BYTES]
    nonce = payload[1 + SALT_BYTES:1 + SALT_BYTES + NONCE_BYTES]
    ciphertext = payload[1 + SALT_BYTES + NONCE_BYTES:]
    try:
        plaintext = AESGCM(_key(password, salt)).decrypt(nonce, ciphertext, AAD)
        return plaintext.decode("utf-8")
    except (InvalidTag, UnicodeDecodeError) as exc:
        raise ValueError("Incorrect image passphrase or damaged image.") from exc
