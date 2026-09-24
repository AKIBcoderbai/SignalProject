"""Secret embedding and extraction helpers.

This module preserves the legacy v1 payload layout and adds the approved v2
fixed header plus password-keyed block ordering.
"""

from __future__ import annotations

import base64
import hashlib
from io import BytesIO
from os import urandom

import numpy as np
from argon2.low_level import Type, hash_secret_raw
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from PIL import Image, ImageOps, UnidentifiedImageError
from skimage.metrics import peak_signal_noise_ratio, structural_similarity

from fourier.fourier_transform import FourierTransform
import robust_transform

BLOCK = 16
STEP = 256
COEFFICIENT = (3, 5)
VERSION = 2
LEGACY_VERSION = 1
SALT_BYTES = 16
NONCE_BYTES = 12
TAG_BYTES = 16
V2_MAGIC = b"FSP2"
V2_HEADER_BYTES = 1 + len(V2_MAGIC) + 2 + SALT_BYTES + NONCE_BYTES
LEGACY_HEADER_BYTES = 2 + 1 + SALT_BYTES + NONCE_BYTES
AAD = b"Fourier-secret-v2"
LEGACY_AAD = b"Fourier-secret-v1"
MAX_PIXELS = 2048 * 2048


def _load_rgb(image_bytes: bytes) -> np.ndarray:
    if not image_bytes:
        raise ValueError("The image is empty.")
    try:
        with Image.open(BytesIO(image_bytes)) as source:
            if source.width * source.height > MAX_PIXELS:
                raise ValueError("Image is too large.")
            image = ImageOps.exif_transpose(source).convert("RGB")
            return np.asarray(image, dtype=np.uint8).copy()
    except (OSError, UnidentifiedImageError) as exc:
        raise ValueError("Please upload a valid PNG or JPEG image.") from exc


def _key(password: str, salt: bytes) -> bytes:
    if len(password) < 8:
        raise ValueError("Use an image passphrase of at least 8 characters.")
    return hash_secret_raw(
        secret=password.encode("utf-8"),
        salt=salt,
        time_cost=2,
        memory_cost=19_456,
        parallelism=1,
        hash_len=32,
        type=Type.ID,
    )


def _block_positions(height: int, width: int):
    for top in range(0, height - BLOCK + 1, BLOCK):
        for left in range(0, width - BLOCK + 1, BLOCK):
            yield top, left


def _ordered_positions(height: int, width: int, password: str, salt: bytes):
    positions = list(_block_positions(height, width))
    if not positions:
        return []
    seed = hashlib.sha256((password + salt.hex() + f"{height}:{width}").encode("utf-8")).digest()
    seed_value = int.from_bytes(seed[:8], "big") % (2 ** 32)
    rng = np.random.default_rng(seed_value)
    order = np.asarray(positions, dtype=object)
    rng.shuffle(order)
    return [tuple(item) for item in order.tolist()]


def _bit_stream(data: bytes):
    for byte in data:
        for shift in range(7, -1, -1):
            yield (byte >> shift) & 1


def _read_bit(block: np.ndarray) -> int:
    coefficient = FourierTransform(block).forward()[COEFFICIENT]
    return int(np.rint(coefficient.real / STEP)) & 1


def _write_bit(block: np.ndarray, bit: int) -> np.ndarray:
    bit = int(bit) & 1
    transform = FourierTransform(block)
    spectrum = transform.forward()
    y, x = COEFFICIENT
    current = spectrum[y, x]
    nearest = round((current.real / STEP - bit) / 2)
    target_real = (2 * nearest + bit) * STEP
    replacement = complex(target_real, current.imag)
    spectrum[y, x] = replacement
    spectrum[-y % BLOCK, -x % BLOCK] = replacement.conjugate()
    reconstructed = np.clip(np.rint(transform.inverse(spectrum)), 0, 255).astype(np.uint8)
    if _read_bit(reconstructed) != bit:
        raise ValueError("This image cannot reliably hold the message; try a different image.")
    return reconstructed


def _read_bytes(blue: np.ndarray, positions, byte_count: int, offset: int = 0) -> bytes:
    iterator = iter(positions)
    for _ in range(offset):
        next(iterator, None)
    output = bytearray()
    for _ in range(byte_count):
        value = 0
        for _ in range(8):
            try:
                top, left = next(iterator)
            except StopIteration as exc:
                raise ValueError("No recoverable message was found in this image.") from exc
            value = (value << 1) | _read_bit(blue[top:top + BLOCK, left:left + BLOCK])
        output.append(value)
    return bytes(output)


def capacity_bytes(image_bytes: bytes, version: int = VERSION) -> int:
    image = _load_rgb(image_bytes)
    block_count = (image.shape[0] // BLOCK) * (image.shape[1] // BLOCK)
    if version == LEGACY_VERSION:
        return max(0, (block_count // 8) - (2 + 1 + SALT_BYTES + NONCE_BYTES + TAG_BYTES))
    header_bits = V2_HEADER_BYTES * 8
    return max(0, (block_count - header_bits) // 8 - TAG_BYTES)


def _legacy_extract(image: np.ndarray, password: str) -> str:
    blue = image[:, :, 2]
    height, width = blue.shape
    positions = list(_block_positions(height, width))
    if len(positions) < 8 * LEGACY_HEADER_BYTES:
        raise ValueError("No recoverable message was found in this image.")
    length = int.from_bytes(_read_bytes(blue, positions, 2), "big")
    if length < 1 + SALT_BYTES + NONCE_BYTES + TAG_BYTES or (length + 2) * 8 > len(positions):
        raise ValueError("No recoverable message was found in this image.")
    payload = _read_bytes(blue, positions, length, offset=16)
    if payload[0] != LEGACY_VERSION:
        raise ValueError("No recoverable message was found in this image.")
    salt = payload[1:1 + SALT_BYTES]
    nonce = payload[1 + SALT_BYTES:1 + SALT_BYTES + NONCE_BYTES]
    ciphertext = payload[1 + SALT_BYTES + NONCE_BYTES:]
    try:
        plaintext = AESGCM(_key(password, salt)).decrypt(nonce, ciphertext, LEGACY_AAD)
        return plaintext.decode("utf-8")
    except (InvalidTag, UnicodeDecodeError) as exc:
        raise ValueError("Incorrect image passphrase or damaged image.") from exc


def _v2_header(ciphertext: bytes, salt: bytes, nonce: bytes) -> bytes:
    return bytes([VERSION]) + V2_MAGIC + len(ciphertext).to_bytes(2, "big") + salt + nonce


def _read_v2_header(blue: np.ndarray):
    positions = list(_block_positions(blue.shape[0], blue.shape[1]))
    header_bits = V2_HEADER_BYTES * 8
    if len(positions) < header_bits:
        return None
    header = _read_bytes(blue, positions, V2_HEADER_BYTES)
    if header[0] != VERSION or header[1:5] != V2_MAGIC:
        return None
    payload_length = int.from_bytes(header[5:7], "big")
    if payload_length < TAG_BYTES or payload_length * 8 > len(positions) - header_bits:
        raise ValueError("No recoverable message was found in this image.")
    salt = bytes(header[7:7 + SALT_BYTES])
    nonce = bytes(header[7 + SALT_BYTES:7 + SALT_BYTES + NONCE_BYTES])
    return payload_length, salt, nonce, positions[header_bits:]


def _decode_v2(blue: np.ndarray, password: str, payload_length: int, salt: bytes, nonce: bytes, positions):
    ordered = _ordered_positions(blue.shape[0], blue.shape[1], password, salt)
    available = set(positions)
    remaining = [pos for pos in ordered if pos in available]
    if len(remaining) < payload_length * 8:
        raise ValueError("No recoverable message was found in this image.")
    payload = _read_bytes(blue, remaining, payload_length)
    try:
        plaintext = AESGCM(_key(password, salt)).decrypt(nonce, payload, AAD)
        return plaintext.decode("utf-8")
    except (InvalidTag, UnicodeDecodeError) as exc:
        raise ValueError("Incorrect image passphrase or damaged image.") from exc


def embed_v2(image_bytes: bytes, message: str, password: str) -> tuple[bytes, int]:
    image = _load_rgb(image_bytes)
    if not message:
        raise ValueError("Enter a message.")
    if len(message.encode("utf-8")) > capacity_bytes(image_bytes):
        raise ValueError(f"This image holds at most {capacity_bytes(image_bytes)} UTF-8 message bytes. Try a larger image.")
    salt = urandom(SALT_BYTES)
    nonce = urandom(NONCE_BYTES)
    ciphertext = AESGCM(_key(password, salt)).encrypt(nonce, message.encode("utf-8"), AAD)
    header = _v2_header(ciphertext, salt, nonce)
    height, width = image.shape[:2]
    blocks = list(_block_positions(height, width))
    header_size_bits = len(header) * 8
    fixed_positions = blocks[:header_size_bits]
    available = set(blocks[header_size_bits:])
    payload_positions = [pos for pos in _ordered_positions(height, width, password, salt) if pos in available]
    if len(fixed_positions) + len(payload_positions) < header_size_bits + len(ciphertext) * 8:
        raise ValueError("This image does not have enough capacity for the payload.")
    encoded = image.copy()
    for bit, (top, left) in zip(_bit_stream(header), fixed_positions):
        encoded[top:top + BLOCK, left:left + BLOCK, 2] = _write_bit(encoded[top:top + BLOCK, left:left + BLOCK, 2], bit)
    for bit, (top, left) in zip(_bit_stream(ciphertext), payload_positions[: len(ciphertext) * 8]):
        encoded[top:top + BLOCK, left:left + BLOCK, 2] = _write_bit(encoded[top:top + BLOCK, left:left + BLOCK, 2], bit)
    output = BytesIO()
    Image.fromarray(encoded, mode="RGB").save(output, format="PNG")
    png = output.getvalue()
    if extract(png, password) != message:
        raise ValueError("The message did not survive PNG encoding. Try another image.")
    return png, capacity_bytes(png)


def embed(image_bytes: bytes, message: str, password: str, robust: bool = True) -> tuple[bytes, int]:
    image = _load_rgb(image_bytes)
    if not robust or min(image.shape[:2]) < robust_transform.TILE:
        return embed_v2(image_bytes, message, password)
    if len(password) < 8:
        raise ValueError("Use an image passphrase of at least 8 characters.")
    encoded = robust_transform.embed(image, message, password)
    output = BytesIO()
    Image.fromarray(encoded, mode="RGB").save(output, format="PNG")
    png = output.getvalue()
    if extract(png, password) != message:
        raise ValueError("This image cannot reliably carry the robust message. Try another image.")
    return png, robust_transform.capacity_bytes(image.shape[1], image.shape[0])


def embed_legacy(image_bytes: bytes, message: str, password: str) -> bytes:
    image = _load_rgb(image_bytes)
    if not message:
        raise ValueError("Enter a message.")
    salt = urandom(SALT_BYTES)
    nonce = urandom(NONCE_BYTES)
    ciphertext = AESGCM(_key(password, salt)).encrypt(nonce, message.encode("utf-8"), LEGACY_AAD)
    payload = bytes([LEGACY_VERSION]) + salt + nonce + ciphertext
    length = len(payload).to_bytes(2, "big")
    data = length + payload
    blocks = list(_block_positions(image.shape[0], image.shape[1]))
    if len(blocks) < len(data) * 8:
        raise ValueError("This image does not have enough capacity for the legacy payload.")
    encoded = image.copy()
    for bit, (top, left) in zip(_bit_stream(data), blocks[: len(data) * 8]):
        encoded[top:top + BLOCK, left:left + BLOCK, 2] = _write_bit(encoded[top:top + BLOCK, left:left + BLOCK, 2], bit)
    output = BytesIO()
    Image.fromarray(encoded, mode="RGB").save(output, format="PNG")
    return output.getvalue()


def extract_with_report(image_bytes: bytes, password: str, mode: str = "auto") -> tuple[str, dict]:
    if mode not in {"auto", "robust", "normal"}:
        raise ValueError("Choose Robust or Normal reading mode.")
    image = _load_rgb(image_bytes)
    if mode == "robust":
        try:
            return robust_transform.extract_auto(image, password)
        except ValueError as exc:
            raise ValueError("No robust message recovered. Check the image, password, or attack strength.") from exc
    blue = image[:, :, 2]
    try:
        v2_header = _read_v2_header(blue)
    except ValueError:
        v2_header = None
    if v2_header is not None:
        payload_length, salt, nonce, positions = v2_header
        return _decode_v2(blue, password, payload_length, salt, nonce, positions), {"format": "v2"}
    if min(image.shape[:2]) >= BLOCK:
        try:
            return _legacy_extract(image, password), {"format": "v1"}
        except ValueError:
            pass
    if mode == "normal":
        raise ValueError("No normal message recovered. Choose Robust for images made in robust mode.")
    try:
        return robust_transform.extract_auto(image, password)
    except ValueError as exc:
        raise ValueError("Incorrect image passphrase or damage exceeds recovery capacity.") from exc


def extract(image_bytes: bytes, password: str, mode: str = "auto") -> str:
    return extract_with_report(image_bytes, password, mode)[0]


def image_metrics(original_image: bytes, transformed_image: bytes) -> dict:
    original = _load_rgb(original_image)
    transformed = _load_rgb(transformed_image)
    if original.shape != transformed.shape:
        transformed = np.asarray(Image.fromarray(transformed).resize(original.shape[:2][::-1], Image.BILINEAR), dtype=np.uint8) # type: ignore
    mse = float(np.mean((original.astype(np.float64) - transformed.astype(np.float64)) ** 2))
    psnr = float(peak_signal_noise_ratio(original, transformed)) if mse else None
    ssim = float(structural_similarity(original, transformed, channel_axis=-1, data_range=255)) # type: ignore
    return {"mse": mse, "psnr": psnr, "ssim": ssim, "height": int(original.shape[0]), "width": int(original.shape[1])}


def difference_image(original_image: bytes, transformed_image: bytes, magnify: int = 4) -> bytes:
    original = _load_rgb(original_image)
    transformed = _load_rgb(transformed_image)
    if original.shape != transformed.shape:
        transformed = np.asarray(Image.fromarray(transformed).resize(original.shape[:2][::-1], Image.BILINEAR), dtype=np.uint8) # type: ignore
    diff_rgb = np.abs(original.astype(np.int16) - transformed.astype(np.int16))
    diff = np.clip(np.mean(diff_rgb, axis=2) * magnify, 0, 255).astype(np.uint8)
    preview = Image.fromarray(diff, mode="L")
    preview.thumbnail((768, 768))
    output = BytesIO()
    preview.save(output, format="PNG")
    return output.getvalue()


def spectrum_image(image_bytes: bytes, robust: bool = False) -> tuple[bytes, dict]:
    image = _load_rgb(image_bytes)
    size = robust_transform.BLOCK if robust else BLOCK
    blue_block = (robust_transform._luma(image)[:size, :size] if robust
                  else image[:size, :size, 2]).astype(np.float64)
    spectrum = FourierTransform(blue_block).forward()
    magnitude = np.log1p(np.abs(np.fft.fftshift(spectrum)))
    peak = float(magnitude.max())
    encoded = np.zeros_like(magnitude, dtype=np.uint8)
    if peak > 0:
        encoded = np.rint(magnitude * 255 / peak).astype(np.uint8)
    output = BytesIO()
    Image.fromarray(encoded, mode="L").resize((256, 256), Image.Resampling.NEAREST).save(output, format="PNG")
    return output.getvalue(), {"peak": peak, "rows": int(encoded.shape[0]), "columns": int(encoded.shape[1]),
                                "blockSize": size, "channel": "luminance" if robust else "blue"}


def coefficient_bit_demo(image_bytes: bytes, robust: bool = False) -> tuple[bytes, bytes, dict]:
    image = _load_rgb(image_bytes)
    if robust:
        size = robust_transform.BLOCK
        block = robust_transform._luma(image)[:size, :size].astype(np.float64)
        spectrum = np.fft.fft2(block)
        y, x = robust_transform.COEFFICIENT
        current = spectrum[y, x]
        output = []
        for bit in (0, 1):
            changed = spectrum.copy()
            nearest = np.rint((current.real / robust_transform.STEP - bit) / 2)
            changed[y, x] = (2 * nearest + bit) * robust_transform.STEP + 1j * current.imag
            changed[-y, -x] = changed[y, x].conjugate()
            result = np.clip(np.rint(np.fft.ifft2(changed).real), 0, 255).astype(np.uint8)
            encoded = BytesIO()
            Image.fromarray(result, mode="L").resize((256, 256), Image.Resampling.NEAREST).save(encoded, format="PNG")
            output.append(encoded.getvalue())
        return output[0], output[1], {"coefficient": {"y": y, "x": x}, "real": float(current.real), "imaginary": float(current.imag)}
    for top, left in _block_positions(*image.shape[:2]):
        candidate = image[top:top + BLOCK, left:left + BLOCK, 2]
        try:
            zero = _write_bit(candidate, 0)
            one = _write_bit(candidate, 1)
            block = candidate
            break
        except ValueError:
            continue
    else:
        raise ValueError("No suitable block was found for the Fourier demonstration.")
    spectrum = FourierTransform(block).forward()
    y, x = COEFFICIENT
    current = spectrum[y, x]
    zero_out = BytesIO()
    one_out = BytesIO()
    Image.fromarray(zero, mode="L").resize((256, 256), Image.Resampling.NEAREST).save(zero_out, format="PNG")
    Image.fromarray(one, mode="L").resize((256, 256), Image.Resampling.NEAREST).save(one_out, format="PNG")
    return zero_out.getvalue(), one_out.getvalue(), {"coefficient": {"y": y, "x": x}, "real": float(current.real), "imaginary": float(current.imag)}


def apply_attack(image_bytes: bytes, attack: str, quality: int | None = None, scale: float | None = None, crop: str | None = None) -> bytes:
    image = Image.fromarray(_load_rgb(image_bytes))
    name = str(attack).strip().lower()
    if name == "png":
        output = BytesIO()
        image.save(output, format="PNG", optimize=True)
        return output.getvalue()
    if name == "red_shift":
        pixels = np.asarray(image).copy()
        pixels[:, :, 0] = np.minimum(pixels[:, :, 0].astype(np.uint16) + 20, 255).astype(np.uint8)
        output = BytesIO()
        Image.fromarray(pixels, mode="RGB").save(output, format="PNG")
        return output.getvalue()
    if name == "jpeg":
        q = int(quality if quality is not None else 75)
        if not 1 <= q <= 100:
            raise ValueError("JPEG quality must be between 1 and 100.")
        output = BytesIO(); image.save(output, format="JPEG", quality=q); return output.getvalue()
    if name == "resize":
        if scale is None:
            raise ValueError("Resize requires a positive scale factor.")
        factor = float(scale)
        if factor <= 0 or factor > 10:
            raise ValueError("Resize scale must be greater than 0 and no larger than 10.")
        resized = image.resize((max(1, int(round(image.width * factor))), max(1, int(round(image.height * factor)))), Image.BILINEAR) # type: ignore
        output = BytesIO(); resized.save(output, format="PNG"); return output.getvalue()
    if name == "crop":
        if crop is None:
            raise ValueError("Crop requires a crop specification.")
        try:
            left, top, right, bottom = [float(part.strip()) for part in str(crop).split(",")]
        except ValueError as exc:
            raise ValueError("Crop must be a comma-separated list of four normalized values.") from exc
        if not (0 <= left < right <= 1 and 0 <= top < bottom <= 1):
            raise ValueError("Crop coordinates must satisfy 0 <= left < right <= 1 and 0 <= top < bottom <= 1.")
        box = (
            int(round(image.width * left)),
            int(round(image.height * top)),
            int(round(image.width * right)),
            int(round(image.height * bottom)),
        )
        cropped = image.crop(box)
        output = BytesIO(); cropped.save(output, format="PNG"); return output.getvalue()
    if name == "screenshot":
        scaled = image.resize((max(1, int(round(image.width * 0.8))), max(1, int(round(image.height * 0.8)))), Image.BILINEAR) # type: ignore
        q = int(quality if quality is not None else 50)
        if not 1 <= q <= 100:
            raise ValueError("JPEG quality must be between 1 and 100.")
        output = BytesIO(); scaled.save(output, format="JPEG", quality=q); return output.getvalue()
    raise ValueError(f"Unsupported attack type: {attack}")


def analyze_attack(image_bytes: bytes, password: str, attack: str, quality: int | None = None, scale: float | None = None, crop: str | None = None) -> dict:
    transformed = apply_attack(image_bytes, attack, quality=quality, scale=scale, crop=crop)
    metrics = image_metrics(image_bytes, transformed)
    try:
        message, recovery = extract_with_report(transformed, password)
        result = {"success": True, "message": message, "recovery": recovery}
    except ValueError:
        result = {"success": False, "message": None, "recovery": None}
    return {
        "attack": attack,
        **result,
        "metrics": metrics,
        "image": "data:image/" + ("jpeg" if transformed.startswith(b"\xff\xd8") else "png") + ";base64," + base64.b64encode(transformed).decode("ascii"),
    }


def analyze_pair(original_image: bytes, protected_image: bytes) -> dict:
    original = _load_rgb(original_image)
    protected = _load_rgb(protected_image)
    if min(original.shape[:2]) < BLOCK:
        raise ValueError("Images must be at least 16 by 16 pixels for Fourier analysis.")
    if original.shape != protected.shape:
        raise ValueError("The original and protected images must have matching dimensions.")
    metrics = image_metrics(original_image, protected_image)
    diff = difference_image(original_image, protected_image)
    robust = robust_transform.looks_like_v3(protected)
    spectrum, spectrum_meta = spectrum_image(protected_image, robust=robust)
    bit_zero, bit_one, bit_meta = coefficient_bit_demo(protected_image, robust=robust)
    return {
        "metrics": metrics,
        "changedPixels": int(np.count_nonzero(np.any(original != protected, axis=2))),
        "differenceImage": "data:image/png;base64," + base64.b64encode(diff).decode("ascii"),
        "spectrumImage": "data:image/png;base64," + base64.b64encode(spectrum).decode("ascii"),
        "spectrumMetadata": spectrum_meta,
        "coefficientBit0": "data:image/png;base64," + base64.b64encode(bit_zero).decode("ascii"),
        "coefficientBit1": "data:image/png;base64," + base64.b64encode(bit_one).decode("ascii"),
        "coefficientMetadata": bit_meta,
    }

