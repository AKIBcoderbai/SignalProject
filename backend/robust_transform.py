"""Version 3: tiled Fourier embedding with synchronization and error correction.

Existing v1/v2 images remain readable through secret_transform.extract().
This format is deliberately limited to short secrets and reasonably large images.
"""

from __future__ import annotations

import hashlib
from os import urandom

import numpy as np
from argon2.low_level import Type, hash_secret_raw
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from PIL import Image
from reedsolo import RSCodec, ReedSolomonError # type: ignore

TILE = 256
BLOCK = 8
GRID = TILE // BLOCK
COEFFICIENT = (1, 1)
STEP = 640
PILOTS = 128
DATA_BYTES = 72
PARITY_BYTES = 40
MAGIC = b"FSP3"
AAD = b"Fourier-secret-v3"
MAX_MESSAGE_BYTES = DATA_BYTES - 4 - 1 - 16 - 12 - 16
CODEC = RSCodec(PARITY_BYTES)


def capacity_bytes(width: int, height: int) -> int:
    return MAX_MESSAGE_BYTES if width >= TILE and height >= TILE else 0


def _layout():
    # Public pilot: a cheap password-derived pilot would enable fast offline guessing.
    seed = hashlib.sha256(b"fsp3-public-layout").digest()
    rng = np.random.default_rng(int.from_bytes(seed[:8], "big"))
    permutation = rng.permutation(GRID * GRID)
    pilots = permutation[:PILOTS]
    data = permutation[PILOTS:]
    pilot_bits = rng.integers(0, 2, size=PILOTS, dtype=np.uint8)
    return pilots, data, pilot_bits


def _key(password: str, salt: bytes) -> bytes:
    return hash_secret_raw(password.encode("utf-8"), salt, 2, 19_456, 1, 32, Type.ID)


def _luma(rgb: np.ndarray) -> np.ndarray:
    return np.asarray(Image.fromarray(rgb, "RGB").convert("YCbCr"))[:, :, 0]


def _block_view(channel: np.ndarray) -> np.ndarray:
    h, w = channel.shape
    return channel[:h // BLOCK * BLOCK, :w // BLOCK * BLOCK].reshape(
        h // BLOCK, BLOCK, w // BLOCK, BLOCK
    ).transpose(0, 2, 1, 3)


def _bits(channel: np.ndarray) -> np.ndarray:
    spectrum = np.fft.fft2(_block_view(channel).astype(np.float64), axes=(-2, -1))
    return (np.rint(spectrum[:, :, COEFFICIENT[0], COEFFICIENT[1]].real / STEP).astype(np.int64) & 1).astype(np.uint8)


def _pack_bits(bits: np.ndarray) -> bytes:
    return np.packbits(bits.astype(np.uint8)).tobytes()


def _frame(message: str, password: str) -> bytes:
    plain = message.encode("utf-8")
    if not plain or len(plain) > MAX_MESSAGE_BYTES:
        raise ValueError(f"Enter a message of 1 to {MAX_MESSAGE_BYTES} UTF-8 bytes for robust mode.")
    salt, nonce = urandom(16), urandom(12)
    cipher = AESGCM(_key(password, salt)).encrypt(nonce, plain, AAD)
    data = MAGIC + bytes([len(plain)]) + salt + nonce + cipher
    return bytes(CODEC.encode(data + urandom(DATA_BYTES - len(data))))


def embed(image: np.ndarray, message: str, password: str) -> np.ndarray:
    h, w = image.shape[:2]
    if not capacity_bytes(w, h):
        raise ValueError("Robust mode needs an image at least 256 × 256 pixels.")
    frame = _frame(message, password)
    # Leave headroom for both signs of the inverse Fourier oscillation.
    # Without it, clipped highlights/shadows can destroy the payload at once.
    image = np.clip(image, 20, 235).astype(np.uint8)
    pilots, data, pilot_bits = _layout()
    tile_bits = np.empty(GRID * GRID, dtype=np.uint8)
    tile_bits[pilots] = pilot_bits
    tile_bits[data] = np.unpackbits(np.frombuffer(frame, dtype=np.uint8))
    luma = _luma(image)
    blocks = _block_view(luma).astype(np.float64)
    spectrum = np.fft.fft2(blocks, axes=(-2, -1))
    ys, xs = np.indices(spectrum.shape[:2])
    target_bits = tile_bits.reshape(GRID, GRID)[ys % GRID, xs % GRID]
    y, x = COEFFICIENT
    coefficient = spectrum[:, :, y, x]
    nearest = np.rint((coefficient.real / STEP - target_bits) / 2)
    target = (2 * nearest + target_bits) * STEP
    replacement = target + 1j * coefficient.imag
    spectrum[:, :, y, x] = replacement
    spectrum[:, :, -y, -x] = np.conj(replacement)
    modified = np.fft.ifft2(spectrum, axes=(-2, -1)).real
    delta = np.rint(modified - blocks).astype(np.int16).transpose(0, 2, 1, 3).reshape(
        (h // BLOCK) * BLOCK, (w // BLOCK) * BLOCK
    )
    encoded = image.copy().astype(np.int16)
    encoded[:delta.shape[0], :delta.shape[1]] = np.clip(
        encoded[:delta.shape[0], :delta.shape[1]] + delta[:, :, None], 0, 255
    )
    return encoded.astype(np.uint8)


def _candidate_shifts(bits: np.ndarray, pilot_positions: np.ndarray, pilot_bits: np.ndarray):
    observed = 2 * bits[:GRID, :GRID].astype(np.float64) - 1
    template = np.zeros((GRID, GRID), dtype=np.float64)
    template.flat[pilot_positions] = 2 * pilot_bits.astype(np.float64) - 1
    correlation = np.fft.ifft2(np.fft.fft2(observed) * np.conj(np.fft.fft2(template))).real
    best = np.argpartition(correlation.ravel(), -2)[-2:]
    return [(tuple(np.unravel_index(int(i), correlation.shape)), float(correlation.flat[i])) for i in best[np.argsort(correlation.flat[best])[::-1]]]


def looks_like_v3(image: np.ndarray) -> bool:
    if min(image.shape[:2]) < TILE:
        return False
    pilots, _, pilot_bits = _layout()
    bits = _bits(_luma(image)[:TILE, :TILE])
    return _candidate_shifts(bits, pilots, pilot_bits)[0][1] > 90


def _read_frame(bits: np.ndarray, shift, data_positions: np.ndarray) -> tuple[bytes, int]:
    # shift describes the cyclic displacement of the tile's bit grid.
    aligned = np.roll(bits[:GRID, :GRID], (-shift[0], -shift[1]), axis=(0, 1))
    raw = _pack_bits(aligned.ravel()[data_positions])
    decoded, _, repaired = CODEC.decode(raw)
    return bytes(decoded), len(repaired)


def _decrypt(frame: bytes, password: str) -> str:
    if len(frame) != DATA_BYTES or frame[:4] != MAGIC:
        raise ValueError("No robust payload found.")
    length = frame[4]
    if not 1 <= length <= MAX_MESSAGE_BYTES:
        raise ValueError("Invalid robust payload length.")
    salt, nonce = frame[5:21], frame[21:33]
    cipher = frame[33:33 + length + 16]
    try:
        return AESGCM(_key(password, salt)).decrypt(nonce, cipher, AAD).decode("utf-8")
    except (InvalidTag, UnicodeDecodeError) as exc:
        raise ValueError("Incorrect image passphrase or damaged image.") from exc


def extract(image: np.ndarray, password: str, scale: float = 1.0) -> tuple[str, dict]:
    """Search pixel alignment and tile phase; optionally undo a known scale."""
    if scale != 1.0:
        width = max(TILE, round(image.shape[1] / scale))
        height = max(TILE, round(image.shape[0] / scale))
        image = np.asarray(Image.fromarray(image, "RGB").resize((width, height), Image.Resampling.LANCZOS))
    if min(image.shape[:2]) < TILE:
        raise ValueError("No complete 256 × 256 region remains in this image.")
    pilots, data, pilot_bits = _layout()
    channel = _luma(image)
    candidates = []
    for py in range(BLOCK):
        for px in range(BLOCK):
            window = channel[py:py + TILE, px:px + TILE]
            if window.shape != (TILE, TILE):
                continue
            raw_bits = _bits(window)
            for (sy, sx), score in _candidate_shifts(raw_bits, pilots, pilot_bits):
                candidates.append((score, py, px, sy, sx, raw_bits))
    for score, py, px, sy, sx, raw_bits in sorted(candidates, key=lambda row: row[0], reverse=True)[:8]:
        if score < 45:  # random noise has ~11-point standard deviation for 128 pilots
            break
        try:
            frame, repaired = _read_frame(raw_bits, (sy, sx), data)
            message = _decrypt(frame, password)
            return message, {"format": "v3", "pilotScore": round(score, 1), "scale": scale,
                             "pixelOffset": [px, py], "tileShift": [int(sx), int(sy)],
                             "correctedBytes": repaired}
        except (ReedSolomonError, ValueError):
            continue
    # A crop or resize can damage one copy while leaving another intact.
    # Use the best synchronization phase to inspect each remaining full tile.
    if candidates:
        score, py, px, sy, sx, first_bits = max(candidates, key=lambda row: row[0])
        if score >= 45:
            replicas = [np.roll(first_bits, (-sy, -sx), axis=(0, 1)).ravel()[data]]
            for top in range(py, channel.shape[0] - TILE + 1, TILE):
                for left in range(px, channel.shape[1] - TILE + 1, TILE):
                    if top == py and left == px:
                        continue
                    tile_bits = _bits(channel[top:top + TILE, left:left + TILE])
                    (shift_y, shift_x), tile_score = _candidate_shifts(tile_bits, pilots, pilot_bits)[0]
                    if tile_score < 45:
                        continue
                    replicas.append(np.roll(tile_bits, (-shift_y, -shift_x), axis=(0, 1)).ravel()[data])
                    try:
                        frame, repaired = _read_frame(tile_bits, (shift_y, shift_x), data)
                        message = _decrypt(frame, password)
                        return message, {"format": "v3", "pilotScore": round(tile_score, 1),
                                         "scale": scale, "pixelOffset": [left, top],
                                         "tileShift": [int(shift_x), int(shift_y)],
                                         "correctedBytes": repaired}
                    except (ReedSolomonError, ValueError):
                        continue
            if len(replicas) > 1:
                votes = np.stack(replicas).sum(axis=0)
                for threshold in (len(replicas) / 2, (len(replicas) - 1) / 2):
                    voted = (votes > threshold).astype(np.uint8)
                    try:
                        decoded, _, repaired = CODEC.decode(_pack_bits(voted))
                        message = _decrypt(bytes(decoded), password)
                        return message, {"format": "v3", "pilotScore": round(score, 1),
                                         "scale": scale, "pixelOffset": [px, py],
                                         "tileShift": [int(sx), int(sy)],
                                         "correctedBytes": len(repaired), "tilesCombined": len(replicas)}
                    except (ReedSolomonError, ValueError):
                        continue
    raise ValueError("No recoverable robust message found at this scale.")


def extract_auto(image: np.ndarray, password: str) -> tuple[str, dict]:
    try:
        return extract(image, password)
    except ValueError:
        pass
    # First try likely original sizes for resized whole images. Search is bounded.
    h, w = image.shape[:2]
    guesses = []
    for original in range(TILE, 2049, TILE):
        candidate = w / original
        if 0.4 <= candidate <= 1.5:
            guesses.append(candidate)
    guesses.extend([round(f / 100, 2) for f in range(50, 101, 5)])
    guesses.extend([0.4, 0.45, 1.1, 1.25])
    for scale in dict.fromkeys(round(g, 5) for g in guesses):
        if scale == 1 or max(w / scale, h / scale) > 2048 or min(w / scale, h / scale) < TILE:
            continue
        try:
            return extract(image, password, scale)
        except ValueError:
            continue
    raise ValueError("Incorrect image passphrase or damage exceeds robust recovery capacity.")
