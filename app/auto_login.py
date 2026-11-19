from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import re
import subprocess
import tempfile
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.config import settings
from app.envelope import success_response, error_response
from app.limiter import limiter
from app.proxy import get_proxy
from app.upstream_session import campus_cookie_dict

logger = logging.getLogger("app.auto_login")

router = APIRouter(prefix="/v1/auth", tags=["auth-auto"])

# ─── Tesseract OCR (same config as Next.js bridge) ───
TESSERACT_CMD = r"C:/Program Files/Tesseract-OCR/tesseract.exe"
TESSDATA_PREFIX = r"C:/Program Files/Tesseract-OCR/tessdata"

# SIAKAD: 4 uppercase letters only
SIAKAD_WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
SIAKAD_EXPECTED_LEN = 4

# MyBest: 3 chars mixed case alphanumeric
MYBEST_WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
MYBEST_EXPECTED_LEN = 3


class AutoLoginRequest(BaseModel):
    nim: str = Field(..., min_length=3)
    studentv2_pass: str = Field("", description="Password SIAKAD (optional)")
    elearning_pass: str = Field(..., min_length=1, description="Password MyBest")


def _run_tesseract(image_bytes: bytes, whitelist: str, psm: int = 7, threshold: int = 140, invert: bool = False, denoise: bool = False, scale: int = 4) -> str:
    """Run Tesseract CLI on image bytes, return raw text."""
    # Preprocess image with PIL (resize, grayscale, threshold)
    from PIL import Image, ImageOps, ImageFilter, ImageEnhance
    import io
    
    img = Image.open(io.BytesIO(image_bytes))
    # Resize for better OCR (configurable scale)
    img = img.resize((img.width * scale, img.height * scale), Image.Resampling.LANCZOS)
    # Convert to grayscale
    img = img.convert("L")
    
    # Enhance contrast
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(2.0)
    
    # Enhance sharpness
    enhancer = ImageEnhance.Sharpness(img)
    img = enhancer.enhance(2.0)
    
    if invert:
        # Invert: white text on black background
        img = ImageOps.invert(img)
    
    if denoise:
        # Apply median filter to reduce noise
        img = img.filter(ImageFilter.MedianFilter(size=3))
        # Apply slight blur to smooth noise
        img = img.filter(ImageFilter.GaussianBlur(radius=0.5))
        
        # Morphological opening to remove thin lines (noise)
        # Convert to binary for morphology
        img_binary = img.point(lambda x: 0 if x < threshold else 255)
        # Use min filter (erosion) then max filter (dilation) = opening
        # Size must be odd for MinFilter/MaxFilter
        img_binary = img_binary.filter(ImageFilter.MinFilter(size=3))
        img_binary = img_binary.filter(ImageFilter.MaxFilter(size=3))
        img = img_binary
    
    # Threshold (if not already done via denoise)
    if not denoise:
        img = img.point(lambda x: 0 if x < threshold else 255)
    
    # Save preprocessed image to temp file
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_in:
        img.save(tmp_in, format="PNG")
        in_path = tmp_in.name
    
    out_base = in_path[:-4]  # without .png
    out_path = out_base + ".txt"
    
    try:
        env = os.environ.copy()
        env["TESSDATA_PREFIX"] = TESSDATA_PREFIX
        
        cmd = [
            TESSERACT_CMD,
            in_path,
            out_base,
            "-c",
            f"tessedit_char_whitelist={whitelist}",
            "--psm",
            str(psm),
            "--oem",
            "1",
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=10, env=env)
        if result.returncode != 0:
            logger.warning("Tesseract exited %d: %s", result.returncode, result.stderr.decode())
            return ""
        
        # Read output file
        try:
            with open(out_path, "r", encoding="utf-8") as f:
                text = f.read().strip()
            return text
        except FileNotFoundError:
            return ""
    finally:
        # Cleanup
        for p in (in_path, out_path):
            try:
                os.unlink(p)
            except OSError:
                pass


def _scale_and_prep_captcha(image_bytes: bytes) -> bytes:
    """Scale CAPTCHA image 4x for better OCR. Returns PNG bytes."""
    from PIL import Image
    import io
    import numpy as np

    img = Image.open(io.BytesIO(image_bytes)).convert("L")
    img_large = img.resize((img.width * 4, img.height * 4), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    img_large.save(buf, format="PNG")
    return buf.getvalue()


def _threshold_prep_captcha(image_bytes: bytes, threshold: int = 110) -> bytes:
    """Binarize CAPTCHA at given threshold (0=black, 255=white). Returns PNG bytes."""
    from PIL import Image
    import io
    import numpy as np

    img = Image.open(io.BytesIO(image_bytes)).convert("L")
    arr = np.array(img)
    arr_t = np.where(arr < threshold, 0, 255).astype(np.uint8)
    img_t = Image.fromarray(arr_t)
    buf = io.BytesIO()
    img_t.save(buf, format="PNG")
    return buf.getvalue()


def _run_tesseract_advanced(image_bytes: bytes, whitelist: str, psm: int = 8, threshold: int = 110, scale: int = 6) -> str:
    """Run Tesseract with advanced connected-component denoising (light denoise).
    This preserves character shapes while removing small noise components.
    """
    from PIL import Image, ImageEnhance
    import io
    import numpy as np
    from scipy import ndimage

    img = Image.open(io.BytesIO(image_bytes))
    # Convert to grayscale
    img = img.convert("L")
    arr = np.array(img)

    # Global threshold
    binary = (arr < threshold).astype(np.uint8)

    # Label connected components
    labeled, num = ndimage.label(binary)

    # Remove only very small components (noise) - keep everything >= 15 pixels
    cleaned_labeled = labeled.copy()
    for i in range(1, num + 1):
        coords = np.where(labeled == i)
        size = len(coords[0])
        if size < 15:
            cleaned_labeled[labeled == i] = 0

    # Reconstruct cleaned image
    cleaned = (cleaned_labeled > 0).astype(np.uint8) * 255
    cleaned_img = Image.fromarray(cleaned, mode="L")

    # Scale up for better OCR
    cleaned_img = cleaned_img.resize((cleaned_img.width * scale, cleaned_img.height * scale), Image.Resampling.LANCZOS)
    # Enhance contrast and sharpness
    cleaned_img = ImageEnhance.Contrast(cleaned_img).enhance(2.0)
    cleaned_img = ImageEnhance.Sharpness(cleaned_img).enhance(2.0)

    # Save to temp file
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_in:
        cleaned_img.save(tmp_in, format="PNG")
        in_path = tmp_in.name

    out_base = in_path[:-4]
    out_path = out_base + ".txt"

    try:
        env = os.environ.copy()
        env["TESSDATA_PREFIX"] = TESSDATA_PREFIX

        cmd = [
            TESSERACT_CMD,
            in_path,
            out_base,
            "-c",
            f"tessedit_char_whitelist={whitelist}",
            "--psm",
            str(psm),
            "--oem",
            "1",
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=10, env=env)
        if result.returncode != 0:
            logger.warning("Tesseract advanced exited %d: %s", result.returncode, result.stderr.decode())
            return ""

        try:
            with open(out_path, "r", encoding="utf-8") as f:
                text = f.read().strip()
            return text
        except FileNotFoundError:
            return ""
    finally:
        for p in (in_path, out_path):
            try:
                os.unlink(p)
            except OSError:
                pass


def _run_tesseract_vproj(image_bytes: bytes, whitelist: str, psm: int = 10, threshold: int = 120, scale: int = 20) -> str:
    """Run Tesseract with vertical projection character segmentation + per-character OCR.
    This segments the CAPTCHA into individual characters using vertical projection,
    then runs OCR on each character at very high scale (20x) for maximum accuracy.
    """
    from PIL import Image, ImageEnhance
    import io
    import numpy as np

    img = Image.open(io.BytesIO(image_bytes))
    # Convert to grayscale
    img = img.convert("L")
    arr = np.array(img)

    # Threshold to binary
    binary = (arr < threshold).astype(np.uint8)

    # Vertical projection: sum along rows (axis=0) to find character columns
    v_proj = np.sum(binary, axis=0)

    # Find character regions from vertical projection
    regions = []
    in_region = False
    start = 0
    min_width = 2  # reduced to catch thinner characters

    for i, val in enumerate(v_proj):
        if val > min_width and not in_region:
            in_region = True
            start = i
        elif val <= min_width and in_region:
            in_region = False
            if i - start > 6:  # minimum character width
                regions.append((start, i))

    if in_region and arr.shape[1] - start > 6:
        regions.append((start, arr.shape[1]))

    # Post-process regions: merge very close ones, split very wide ones
    # Target: exactly 4 regions for SIAKAD
    merged_regions = []
    for r in regions:
        if not merged_regions:
            merged_regions.append(list(r))
        else:
            last = merged_regions[-1]
            gap = r[0] - last[1]
            # If gap is small (< 3px), merge with previous
            if gap < 3:
                last[1] = r[1]
            else:
                merged_regions.append(list(r))

    # If we have more than 4, try to split the widest one(s)
    while len(merged_regions) < 4 and len(merged_regions) > 0:
        # Find widest region
        widest_idx = max(range(len(merged_regions)), key=lambda i: merged_regions[i][1] - merged_regions[i][0])
        w = merged_regions[widest_idx]
        width = w[1] - w[0]
        if width > 15:  # wide enough to split
            mid = (w[0] + w[1]) // 2
            # Split into two
            merged_regions[widest_idx] = [w[0], mid]
            merged_regions.insert(widest_idx + 1, [mid, w[1]])
        else:
            break

    # If still not 4, return empty
    if len(merged_regions) != 4:
        logger.warning("VProj: expected 4 regions, got %d: %s", len(merged_regions), merged_regions)
        return ""

    regions = [(r[0], r[1]) for r in merged_regions]

    # OCR each character individually at high scale
    chars = []
    for idx, (c1, c2) in enumerate(regions):
        # Crop character region with some vertical padding
        char_img = img.crop((c1, 15, c2, 60))
        # Scale up massively for single-character OCR
        scaled = char_img.resize((char_img.width * scale, char_img.height * scale), Image.Resampling.LANCZOS)
        scaled = ImageEnhance.Contrast(scaled).enhance(3.0)
        scaled = ImageEnhance.Sharpness(scaled).enhance(3.0)

        # Try multiple thresholds for this character
        best_char = ""
        for th in [60, 80, 100, 120, 140]:
            th_img = scaled.point(lambda x: 0 if x < th else 255)

            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_in:
                th_img.save(tmp_in, format="PNG")
                in_path = tmp_in.name

            out_base = in_path[:-4]
            out_path = out_base + ".txt"

            try:
                env = os.environ.copy()
                env["TESSDATA_PREFIX"] = TESSDATA_PREFIX

                cmd = [
                    TESSERACT_CMD,
                    in_path,
                    out_base,
                    "-c",
                    f"tessedit_char_whitelist={whitelist}",
                    "--psm",
                    str(psm),
                    "--oem",
                    "1",
                ]
                result = subprocess.run(cmd, capture_output=True, timeout=10, env=env)
                if result.returncode == 0:
                    try:
                        with open(out_path, "r", encoding="utf-8") as f:
                            text = f.read().strip()
                        if text and len(text) == 1:
                            best_char = text
                            break
                    except FileNotFoundError:
                        pass
            finally:
                for p in (in_path, out_path):
                    try:
                        os.unlink(p)
                    except OSError:
                        pass

        chars.append(best_char)
        logger.warning("VProj char %d (%d-%d): %r", idx, c1, c2, best_char)

    combined = "".join(chars)
    logger.warning("VProj combined: %r (regions=%s)", combined, regions)
    return combined


def _run_tesseract_vproj_candidates(
    image_bytes: bytes, whitelist: str, psm: int = 10, threshold: int = 120, scale: int = 20
) -> list[list[str]] | None:
    """Like _run_tesseract_vproj but returns per-character candidate lists.

    Returns a list of lists: one candidate list per character position.
    Each inner list contains up to 3 top OCR reads for that character.
    Returns None if segmentation doesn't yield exactly 4 regions.
    """
    from PIL import Image, ImageEnhance
    import io, numpy as np, os, subprocess, tempfile

    img = Image.open(io.BytesIO(image_bytes))
    img = img.convert("L")
    arr = np.array(img)

    # Threshold to binary
    binary = (arr < threshold).astype(np.uint8)

    # Vertical projection
    v_proj = np.sum(binary, axis=0)

    regions = []
    in_region = False
    start = 0
    min_width = 2
    for i, val in enumerate(v_proj):
        if val > min_width and not in_region:
            in_region = True
            start = i
        elif val <= min_width and in_region:
            in_region = False
            if i - start > 6:
                regions.append((start, i))
    if in_region and arr.shape[1] - start > 6:
        regions.append((start, arr.shape[1]))

    merged_regions = []
    for r in regions:
        if not merged_regions:
            merged_regions.append(list(r))
        else:
            last = merged_regions[-1]
            gap = r[0] - last[1]
            if gap < 3:
                last[1] = r[1]
            else:
                merged_regions.append(list(r))

    while len(merged_regions) < 4 and len(merged_regions) > 0:
        widest_idx = max(range(len(merged_regions)), key=lambda i: merged_regions[i][1] - merged_regions[i][0])
        w = merged_regions[widest_idx]
        width = w[1] - w[0]
        if width > 15:
            mid = (w[0] + w[1]) // 2
            merged_regions[widest_idx] = [w[0], mid]
            merged_regions.insert(widest_idx + 1, [mid, w[1]])
        else:
            break

    if len(merged_regions) != 4:
        logger.warning("VProj-Candidates: expected 4 regions, got %d: %s", len(merged_regions), merged_regions)
        return None

    regions = [(r[0], r[1]) for r in merged_regions]

    per_char_candidates = []
    for idx, (c1, c2) in enumerate(regions):
        char_img = img.crop((c1, 15, c2, 60))
        scaled = char_img.resize((char_img.width * scale, char_img.height * scale), Image.Resampling.LANCZOS)
        scaled = ImageEnhance.Contrast(scaled).enhance(3.0)
        scaled = ImageEnhance.Sharpness(scaled).enhance(3.0)

        char_candidates = []
        for th in [60, 80, 100, 120, 140]:
            th_img = scaled.point(lambda x: 0 if x < th else 255)

            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_in:
                th_img.save(tmp_in, format="PNG")
                in_path = tmp_in.name

            out_base = in_path[:-4]
            out_path = out_base + ".txt"

            try:
                env = os.environ.copy()
                env["TESSDATA_PREFIX"] = TESSDATA_PREFIX

                cmd = [
                    TESSERACT_CMD,
                    in_path,
                    out_base,
                    "-c",
                    f"tessedit_char_whitelist={whitelist}",
                    "--psm",
                    str(psm),
                    "--oem",
                    "1",
                ]
                result = subprocess.run(cmd, capture_output=True, timeout=10, env=env)
                if result.returncode == 0:
                    try:
                        with open(out_path, "r", encoding="utf-8") as f:
                            text = f.read().strip()
                        if text and len(text) == 1 and text not in char_candidates:
                            char_candidates.append(text)
                            if len(char_candidates) >= 3:
                                break
                    except FileNotFoundError:
                        pass
            finally:
                for p in (in_path, out_path):
                    try:
                        os.unlink(p)
                    except OSError:
                        pass

        logger.warning("VProj-Cand char %d (%d-%d): %r", idx, c1, c2, char_candidates)
        per_char_candidates.append(char_candidates)

    return per_char_candidates


def _clean_siakad(text: str) -> str:
    """Clean SIAKAD OCR: keep only A-Z and 0-9, uppercase."""
    cleaned = re.sub(r"[^A-Z0-9]", "", text.upper())
    return cleaned


def _clean_mybest(text: str) -> str:
    """Clean MyBest OCR: keep only alphanumeric, preserve case."""
    cleaned = re.sub(r"[^A-Za-z0-9]", "", text)
    return cleaned


async def _solve_captcha_bytes(
    image_bytes: bytes, host: str, max_attempts: int = 3
) -> list[str]:
    """Try multiple PSM modes and thresholds, return ALL valid-length results."""
    if host == "siakad":
        whitelist = SIAKAD_WHITELIST
        expected_len = SIAKAD_EXPECTED_LEN
        clean_fn = _clean_siakad

        candidates = []

        # FIRST: Scale up 4x then basic OCR at key thresholds (FAST, gives 4-char reads)
        scaled_bytes = await asyncio.to_thread(_scale_and_prep_captcha, image_bytes)
        for psm in [7, 8]:  # PSM 7 (single line) works better for this CAPTCHA style
            for threshold in [80, 90, 100, 110, 120, 130]:
                raw = await asyncio.to_thread(
                    _run_tesseract, scaled_bytes, whitelist, psm, threshold, False, False, 1
                )
                cleaned = clean_fn(raw)
                if len(cleaned) == expected_len:
                    logger.warning(
                        "OCR candidate BASIC host=%s psm=%d thresh=%d raw=%r clean=%s",
                        host, psm, threshold, raw, cleaned,
                    )
                    candidates.append(cleaned)

        # ALSO: Try threshold preprocessing BEFORE scaling (helps with F/E, B/E confusion)
        for psm in [7, 8]:
            for threshold in [80, 90, 100, 110, 120, 130]:
                thresh_bytes = await asyncio.to_thread(_threshold_prep_captcha, image_bytes, threshold)
                raw = await asyncio.to_thread(
                    _run_tesseract, thresh_bytes, whitelist, psm, threshold, False, False, 1
                )
                cleaned = clean_fn(raw)
                if len(cleaned) == expected_len and cleaned not in candidates:
                    logger.warning(
                        "OCR candidate PRE-THRESH host=%s psm=%d thresh=%d raw=%r clean=%s",
                        host, psm, threshold, raw, cleaned,
                    )
                    candidates.append(cleaned)

        # SECOND: Vertical projection + per-character OCR (3 calls)
        for threshold in [100, 110, 120]:
            raw = await asyncio.to_thread(
                _run_tesseract_vproj, image_bytes, whitelist, 10, threshold, 20
            )
            cleaned = clean_fn(raw)
            if len(cleaned) == expected_len and cleaned not in candidates:
                logger.warning(
                    "OCR candidate VPROJ host=%s thresh=%d raw=%r clean=%s",
                    host, threshold, raw, cleaned,
                )
                candidates.append(cleaned)

        # THIRD: Advanced denoising (scipy) - ONE attempt as fallback
        raw = await asyncio.to_thread(
            _run_tesseract_advanced, image_bytes, whitelist, 8, 110, 6
        )
        cleaned = clean_fn(raw)
        if len(cleaned) == expected_len and cleaned not in candidates:
            logger.warning(
                "OCR candidate ADV host=%s raw=%r clean=%s",
                host, raw, cleaned,
            )
            candidates.append(cleaned)

    else:
        whitelist = MYBEST_WHITELIST
        expected_len = MYBEST_EXPECTED_LEN
        clean_fn = _clean_mybest
        psm_modes = [7, 8, 13, 6]
        thresholds = [140]
        try_invert = [False]
        try_denoise = [False]
        try_scale = [4]
        extra_configs = []

        candidates = []

        # ALSO: Try threshold preprocessing BEFORE scaling (helps with X vs K confusion)
        for psm in psm_modes:
            for threshold in [80, 90, 100, 110, 120, 130, 140]:
                thresh_bytes = await asyncio.to_thread(_threshold_prep_captcha, image_bytes, threshold)
                raw = await asyncio.to_thread(
                    _run_tesseract, thresh_bytes, whitelist, psm, threshold, False, False, 1
                )
                cleaned = clean_fn(raw)
                if len(cleaned) == expected_len and cleaned not in candidates:
                    logger.warning(
                        "OCR candidate PRE-THRESH host=%s psm=%d thresh=%d raw=%r clean=%s",
                        host, psm, threshold, raw, cleaned,
                    )
                    candidates.append(cleaned)

        # Main grid search (reduced)
        for psm in psm_modes:
            for threshold in thresholds:
                for invert in try_invert:
                    for denoise in try_denoise:
                        for scale in try_scale:
                            for attempt in range(max_attempts):
                                raw = await asyncio.to_thread(
                                    _run_tesseract, image_bytes, whitelist, psm, threshold, invert, denoise, scale
                                )
                                cleaned = clean_fn(raw)
                                if len(cleaned) == expected_len:
                                    logger.warning(
                                        "OCR candidate host=%s psm=%d thresh=%d invert=%s denoise=%s scale=%d attempt=%d raw=%r clean=%s",
                                        host,
                                        psm,
                                        threshold,
                                        invert,
                                        denoise,
                                        scale,
                                        attempt,
                                        raw,
                                        cleaned,
                                    )
                                    candidates.append(cleaned)

        # Extra targeted configs
        for psm, threshold, invert, denoise, scale in extra_configs:
            for attempt in range(max_attempts):
                raw = await asyncio.to_thread(
                    _run_tesseract, image_bytes, whitelist, psm, threshold, invert, denoise, scale
                )
                cleaned = clean_fn(raw)
                if len(cleaned) == expected_len:
                    logger.warning(
                        "OCR candidate host=%s psm=%d thresh=%d invert=%s denoise=%s scale=%d attempt=%d raw=%r clean=%s (extra)",
                        host,
                        psm,
                        threshold,
                        invert,
                        denoise,
                        scale,
                        attempt,
                        raw,
                        cleaned,
                    )
                    candidates.append(cleaned)

    # Deduplicate while preserving order
    seen = set()
    unique_candidates = []
    for c in candidates:
        if c not in seen:
            seen.add(c)
            unique_candidates.append(c)
    # Increase limit to 10 to try more OCR variants
    return unique_candidates[:10]


async def _login_host(
    host: str,
    nim: str,
    password: str,
    client: httpx.AsyncClient,
) -> tuple[bool, str, list[str], dict[str, str]]:
    """Full login flow for one host in a single session.
    Returns (success, failure_reason, campus_messages, cookies).
    """
    print(f"DEBUG _login_host CALLED with host={host}")
    if host == "siakad":
        login_url = "https://students.bsi.ac.id/login"
        captcha_url = "https://students.bsi.ac.id/login/captcha/web"
        captcha_field = "captcha"
        token_field = "_token"
        username_field = "username"
        password_field = "password"
    else:
        login_url = "https://elearning.bsi.ac.id/login"
        captcha_url = "https://elearning.bsi.ac.id/reload-captcha"
        captcha_field = "captcha_answer"
        token_field = "_token"
        username_field = "username"
        password_field = "password"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Origin": login_url.rsplit("/", 1)[0],
        "Referer": login_url,
    }
    if host == "elearning":
        headers["X-Requested-With"] = "XMLHttpRequest"

    # 1. GET login page - establishes session, gets token AND captcha (for SIAKAD)
    try:
        page = await client.get(login_url, headers=headers)
        page.raise_for_status()
    except Exception as e:
        return False, "network", [f"Gagal membuka halaman login: {e}"], {}

    # Extract CSRF token
    token_match = re.search(r"name=[\"']_token[\"']\s+value=[\"']([^\"']+)[\"']", page.text)
    if not token_match:
        return False, "token", ["Token _token tidak ditemukan"], {}
    token = token_match.group(1)

    # 2. Fetch CAPTCHA image (same session!)
    try:
        if host == "elearning":
            # elearning returns JSON with svg field containing data URI
            captcha_resp = await client.get(captcha_url, headers=headers)
            captcha_resp.raise_for_status()
            data = captcha_resp.json()
            # Extract base64 from svg field
            svg = data.get("svg", "")
            match = re.search(r'data:image/[a-zA-Z]+;base64,([A-Za-z0-9+/=]+)', svg)
            if not match:
                return False, "captcha", ["Format CAPTCHA elearning tidak dikenali"], {}
            image_bytes = base64.b64decode(match.group(1))
        else:
            # siakad: Try TWO approaches:
            # Approach 1: CAPTCHA embedded in login page HTML (original) - this matches the form's CSRF token
            img_match = re.search(r'<img[^>]*data-captcha-image[^>]*src="data:image/[a-zA-Z]+;base64,([A-Za-z0-9+/=]+)"', page.text)
            if not img_match:
                # Fallback: find data:image inside login-captcha-challenge div
                img_match = re.search(r'login-captcha-challenge[^>]*>.*?<img[^>]*src="data:image/[a-zA-Z]+;base64,([A-Za-z0-9+/=]+)"', page.text, re.DOTALL)
            
            html_captcha_bytes = None
            if img_match:
                html_captcha_bytes = base64.b64decode(img_match.group(1))
            
            # Approach 2: Call CAPTCHA refresh API to get fresh CAPTCHA in session
            # This mimics user clicking "Muat ulang" button
            api_captcha_bytes = None
            try:
                captcha_resp = await client.get(captcha_url, headers=headers)
                captcha_resp.raise_for_status()
                data = captcha_resp.json()
                api_image_b64 = data.get("image", "")
                match = re.search(r'data:image/[a-zA-Z]+;base64,([A-Za-z0-9+/=]+)', api_image_b64)
                if match:
                    api_captcha_bytes = base64.b64decode(match.group(1))
            except Exception as e:
                logger.warning("SIAKAD CAPTCHA API refresh failed: %s", e)
            
            # Prefer HTML captcha (matches the form's CSRF token), fallback to API captcha
            if html_captcha_bytes:
                image_bytes = html_captcha_bytes
                logger.warning("Using SIAKAD CAPTCHA from login page HTML (matches form token)")
            elif api_captcha_bytes:
                image_bytes = api_captcha_bytes
                logger.warning("Using SIAKAD CAPTCHA from API refresh (session updated)")
            else:
                return False, "captcha", ["Format CAPTCHA SIAKAD tidak dikenali (tidak ditemukan di HTML dan API)"], {}
    except Exception as e:
        return False, "captcha", [f"Gagal ambil CAPTCHA: {e}"], {}

    # DEBUG: Save raw CAPTCHA image for inspection
    import os
    debug_dir = os.path.join(os.environ.get("TEMP", "/tmp"), "mira_captcha_debug")
    os.makedirs(debug_dir, exist_ok=True)
    debug_path = os.path.join(debug_dir, f"captcha_{host}_{int(asyncio.get_event_loop().time())}.png")
    try:
        with open(debug_path, "wb") as f:
            f.write(image_bytes)
        logger.warning("Saved %s CAPTCHA to %s (%d bytes)", host.upper(), debug_path, len(image_bytes))
    except Exception as e:
        logger.warning("Failed to save debug CAPTCHA: %s", e)

    # 3. OCR the CAPTCHA - get all candidates
    candidates = await _solve_captcha_bytes(image_bytes, host)
    if not candidates:
        return False, "captcha", ["OCR gagal membaca CAPTCHA setelah beberapa percobaan"], {}

    logger.warning("%s OCR candidates: %s", host.upper(), candidates)

    # 4. Try each candidate (max 10 attempts per CAPTCHA to avoid rate limiting)
    # IMPORTANT: SIAKAD CAPTCHA is single-use, must refresh after each failed attempt
    max_attempts_per_captcha = 10
    attempts_this_captcha = 0
    candidate_index = 0

    while candidate_index < len(candidates) and attempts_this_captcha < max_attempts_per_captcha:
        captcha_code = candidates[candidate_index]
        logger.warning(
            "Trying %s CAPTCHA candidate %d/%d: %s",
            host.upper(),
            candidate_index + 1,
            min(len(candidates), max_attempts_per_captcha),
            captcha_code,
        )

        payload = {
            token_field: token,
            username_field: nim,
            password_field: password,
            captcha_field: captcha_code,
        }
        try:
            login_resp = await client.post(login_url, data=payload, headers=headers)
        except Exception as e:
            return False, "network", [f"Gagal submit login: {e}"], {}

        logger.warning(
            "Login response for %s (candidate %s): status=%d url=%s",
            host,
            captcha_code,
            login_resp.status_code,
            login_resp.url,
        )
        logger.warning("Login response body (first 500): %s", login_resp.text[:500])

        final_url = str(login_resp.url)
        # Success: not on login page anymore, and status 200
        is_login_page = "/login" in final_url and (
            "captcha" in login_resp.text.lower() or "password" in login_resp.text.lower()
        )
        if not is_login_page and login_resp.status_code == 200:
            logger.warning("%s login SUCCESS with CAPTCHA: %s", host.upper(), captcha_code)
            return True, "", [], campus_cookie_dict(client.cookies)
        if "dashboard" in final_url or "students.bsi.ac.id/user" in final_url:
            logger.warning("%s login SUCCESS with CAPTCHA: %s", host.upper(), captcha_code)
            return True, "", [], campus_cookie_dict(client.cookies)

        # Check if CAPTCHA error (try next candidate)
        body_lower = login_resp.text.lower()
        captcha_error_indicators = [
            "captcha salah",
            "kode keamanan salah",
            "captcha tidak valid",
            "captcha tidak cocok",
            "kode keamanan tidak valid",
            "security code invalid",
            "invalid captcha",
            "wrong captcha",
            "hanya boleh berisi huruf",  # CAPTCHA validation error (e.g. digits not allowed)
        ]
        is_captcha_error = any(indicator in body_lower for indicator in captcha_error_indicators)

        # Still on login page with status 200 = CAPTCHA was wrong (form re-shown)
        # Treat as CAPTCHA error so we try next candidate
        if is_login_page and login_resp.status_code == 200:
            is_captcha_error = True

        # Check for credential errors (wrong password, account locked, etc.)
        credential_error_indicators = [
            "kredensial ditolak",
            "password salah",
            "kata sandi salah",
            "akun terkunci",
            "akun diblokir",
            "invalid credentials",
            "wrong password",
            "account locked",
            "credential rejected",
        ]
        is_credential_error = any(indicator in body_lower for indicator in credential_error_indicators)

        if is_captcha_error:
            # Log which indicator matched
            for indicator in captcha_error_indicators:
                if indicator in body_lower:
                    logger.warning("Matched CAPTCHA error indicator: %r", indicator)
                    break
            logger.warning("%s CAPTCHA candidate %s failed: CAPTCHA salah", host.upper(), captcha_code)

            # Try remaining candidates from CURRENT CAPTCHA image before refreshing
            candidate_index += 1
            attempts_this_captcha += 1
            continue

        # Credential error (wrong password, account locked) - CAPTCHA was correct but password failed
        if is_credential_error:
            logger.warning(
                "%s login failed with candidate %s: KREDENSIAL DITOLAK (CAPTCHA benar, password salah)",
                host.upper(),
                captcha_code,
            )
            return False, "credentials", ["Kredensial ditolak"], {}

        if login_resp.status_code == 429:
            return False, "throttled", ["Terlalu banyak percobaan"], {}
        # Other error (credentials, etc.) - don't try other candidates
        logger.warning(
            "%s login failed with candidate %s: non-CAPTCHA error (status=%d)",
            host.upper(),
            captcha_code,
            login_resp.status_code,
        )
        return False, "credentials", ["Kredensial ditolak"], {}

    # All candidates failed for current CAPTCHA - refresh and try again with new image
    max_total_attempts = 15
    total_attempts = attempts_this_captcha
    while total_attempts < max_total_attempts:
        # Refresh CAPTCHA for next attempt
        try:
            captcha_url = "https://students.bsi.ac.id/login/captcha/web"
            refresh_headers = {
                "Accept": "application/json",
                "X-Requested-With": "XMLHttpRequest",
                "Origin": "https://students.bsi.ac.id",
                "Referer": "https://students.bsi.ac.id/login",
                **headers,
            }
            captcha_resp = await client.get(captcha_url, headers=refresh_headers)
            captcha_resp.raise_for_status()
            data = captcha_resp.json()
            api_image_b64 = data.get("image", "")
            match = re.search(r'data:image/[a-zA-Z]+;base64,([A-Za-z0-9+/=]+)', api_image_b64)
            if match:
                image_bytes = base64.b64decode(match.group(1))
                debug_dir = os.path.join(os.environ.get("TEMP", "/tmp"), "mira_captcha_debug")
                os.makedirs(debug_dir, exist_ok=True)
                debug_path = os.path.join(debug_dir, f"captcha_{host}_{int(asyncio.get_event_loop().time())}.png")
                with open(debug_path, "wb") as f:
                    f.write(image_bytes)
                logger.warning("Refreshed %s CAPTCHA after candidates exhausted: %s (%d bytes)", host.upper(), debug_path, len(image_bytes))
                candidates = await _solve_captcha_bytes(image_bytes, host)
                if not candidates:
                    logger.warning("Failed to get OCR candidates from refreshed CAPTCHA")
                    break
                logger.warning("%s new OCR candidates after refresh: %s", host.upper(), candidates)
                candidate_index = 0
                attempts_this_captcha = 0
                while candidate_index < len(candidates) and attempts_this_captcha < max_attempts_per_captcha:
                    captcha_code = candidates[candidate_index]
                    logger.warning(
                        "Trying %s CAPTCHA candidate %d/%d: %s",
                        host.upper(),
                        candidate_index + 1,
                        min(len(candidates), max_attempts_per_captcha),
                        captcha_code,
                    )
                    payload = {
                        token_field: token,
                        username_field: nim,
                        password_field: password,
                        captcha_field: captcha_code,
                    }
                    try:
                        login_resp = await client.post(login_url, data=payload, headers=headers)
                    except Exception as e:
                        return False, "network", [f"Gagal submit login: {e}"], {}
                    logger.warning(
                        "Login response for %s (candidate %s): status=%d url=%s",
                        host,
                        captcha_code,
                        login_resp.status_code,
                        login_resp.url,
                    )
                    logger.warning("Login response body (first 500): %s", login_resp.text[:500])
                    final_url = str(login_resp.url)
                    is_login_page = "/login" in final_url and (
                        "captcha" in login_resp.text.lower() or "password" in login_resp.text.lower()
                    )
                    if not is_login_page and login_resp.status_code == 200:
                        logger.warning("%s login SUCCESS with CAPTCHA: %s", host.upper(), captcha_code)
                        return True, "", [], campus_cookie_dict(client.cookies)
                    if "dashboard" in final_url or "students.bsi.ac.id/user" in final_url:
                        logger.warning("%s login SUCCESS with CAPTCHA: %s", host.upper(), captcha_code)
                        return True, "", [], campus_cookie_dict(client.cookies)
                    body_lower = login_resp.text.lower()
                    captcha_error_indicators = [
                        "captcha salah",
                        "kode keamanan salah",
                        "captcha tidak valid",
                        "captcha tidak cocok",
                        "kode keamanan tidak valid",
                        "security code invalid",
                        "invalid captcha",
                        "wrong captcha",
                        "hanya boleh berisi huruf",
                    ]
                    is_captcha_error = any(indicator in body_lower for indicator in captcha_error_indicators)
                    if is_login_page and login_resp.status_code == 200:
                        is_captcha_error = True
                    credential_error_indicators = [
                        "kredensial ditolak",
                        "password salah",
                        "kata sandi salah",
                        "akun terkunci",
                        "akun diblokir",
                        "invalid credentials",
                        "wrong password",
                        "account locked",
                        "credential rejected",
                    ]
                    is_credential_error = any(indicator in body_lower for indicator in credential_error_indicators)
                    if is_captcha_error:
                        for indicator in captcha_error_indicators:
                            if indicator in body_lower:
                                logger.warning("Matched CAPTCHA error indicator: %r", indicator)
                                break
                        logger.warning("%s CAPTCHA candidate %s failed: CAPTCHA salah", host.upper(), captcha_code)
                        candidate_index += 1
                        attempts_this_captcha += 1
                        total_attempts += 1
                        continue
                    if is_credential_error:
                        logger.warning(
                            "%s login failed with candidate %s: KREDENSIAL DITOLAK (CAPTCHA benar, password salah)",
                            host.upper(),
                            captcha_code,
                        )
                        return False, "credentials", ["Kredensial ditolak"], {}
                    if login_resp.status_code == 429:
                        return False, "throttled", ["Terlalu banyak percobaan"], {}
                    logger.warning(
                        "%s login failed with candidate %s: non-CAPTCHA error (status=%d)",
                        host.upper(),
                        captcha_code,
                        login_resp.status_code,
                    )
                    return False, "credentials", ["Kredensial ditolak"], {}
                candidate_index += 1
                attempts_this_captcha += 1
                total_attempts += 1
                continue
        except Exception as e:
            logger.warning("Failed to refresh %s CAPTCHA: %s", host.upper(), e)
            break

    # All candidates failed after refresh
    return False, "captcha", ["CAPTCHA salah (semua kandidat OCR gagal)"], {}


@router.post("/login-auto")
async def login_auto(req_body: AutoLoginRequest, request: Request):
    """
    Full auto-login for both SIAKAD and MyBest.
    Each host uses its own isolated session (no cross-contamination).
    """
    from app.main import extract_client_ip

    client_ip = extract_client_ip(request)

    # Rate limiting
    rate_key = f"login-auto:{req_body.nim.strip()}"
    if not await limiter.is_allowed(rate_key, limit=5):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_response(
                code="RATE_LIMIT_EXCEED",
                message="Terlalu banyak percobaan login. Tunggu 1 menit.",
                module="auth",
            ),
        )

    nim = req_body.nim.strip()
    sv_pass = req_body.studentv2_pass.strip()
    el_pass = req_body.elearning_pass.strip()
    siakad_attempted = bool(sv_pass)

    # Results
    sv2_ok = False
    el_ok = False
    warnings: list[str] = []
    outcomes: dict[str, tuple[str, list[str]]] = {}

    # Proxy per NIM
    proxy = get_proxy(seed=nim)

    # ─── SIAKAD ───
    if siakad_attempted:
        async with httpx.AsyncClient(
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Origin": "https://students.bsi.ac.id",
                "Referer": "https://students.bsi.ac.id/login",
            },
            follow_redirects=True,
            timeout=30.0,
            proxy=proxy,
        ) as client:
            ok, reason, errors, sv_cookies = await _login_host("siakad", nim, sv_pass, client)
            import sys as _sys
            print(f"DEBUG ok={ok}, reason={reason}, errors={errors}, cookies={sv_cookies}", file=_sys.stderr)
            sv2_ok = ok
            outcomes["studentv2"] = (reason, errors)
            if not ok:
                logger.warning("SIAKAD auto-login failed for %s: %s (%s)", nim, reason, errors)

    # ─── MyBest (elearning) ───
    el_cookies: dict[str, str] = {}
    async with httpx.AsyncClient(
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Origin": "https://elearning.bsi.ac.id",
            "Referer": "https://elearning.bsi.ac.id/login",
        },
        follow_redirects=True,
        timeout=30.0,
        proxy=proxy,
    ) as client:
        ok, reason, errors, cookies = await _login_host("elearning", nim, el_pass, client)
        el_ok = ok
        el_cookies = cookies or {}
        outcomes["elearning"] = (reason, errors)
        if not ok:
            logger.warning("MyBest auto-login failed for %s: %s (%s)", nim, reason, errors)

    # Store elearning session cookies to campus_session_store for upstream reuse
    if el_ok and el_cookies:
        try:
            from app.campus_session_store import store_cookies
            logger.warning("DEBUG: el_cookies=%s, keys=%s", el_cookies, list(el_cookies.keys()))
            store_cookies("elearning", nim, el_cookies)
            logger.warning("Stored elearning session cookies for %s (%d cookies)", nim, len(el_cookies))
        except Exception as e:
            logger.warning("Failed to store elearning cookies for %s: %s", nim, e)
    else:
        logger.warning("DEBUG: Skipping store_cookies: el_ok=%s, el_cookies=%s", el_ok, el_cookies)

    # MyBest is mandatory
    if not el_ok:
        if "elearning" in outcomes and outcomes["elearning"][0] == "captcha":
            detail = error_response(
                code="AUTH_CAPTCHA_REQUIRED",
                message="Kampus kini mewajibkan CAPTCHA. Muat gambar CAPTCHA lalu masukkan kodenya.",
                module="auth",
            )
            detail["error"]["captcha_hosts"] = ["elearning"]
        else:
            reason, errors = outcomes.get("elearning", ("unknown", []))
            label = "MyBest"
            quoted = ""
            if errors:
                quoted = f' Pesan dari {label}: "{errors[0][:160]}".'
            detail = error_response(
                code="INVALID_CREDENTIALS",
                message=f"Password {label} ditolak kampus.{quoted} Periksa password {label} lalu coba lagi.",
                module="auth",
            )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)

    # SIAKAD optional
    effective_sv_pass = sv_pass if sv2_ok else ""
    if siakad_attempted and not sv2_ok:
        reason, errors = outcomes.get("studentv2", ("unknown", []))
        if reason == "captcha":
            sv_message = "CAPTCHA SIAKAD gagal, jadi SIAKAD tidak bisa diperiksa."
        else:
            label = "SIAKAD"
            quoted = ""
            if errors:
                quoted = f' Pesan dari {label}: "{errors[0][:160]}".'
            sv_message = f"Password {label} ditolak kampus.{quoted} Periksa password {label}."
        warnings.append(f"{sv_message} Fitur SIAKAD terkunci; hubungkan ulang di Sesi & Keamanan.")

    # Create session token
    from app.session_store import session_store

    token = await session_store.create(nim, effective_sv_pass, el_pass)

    response_data = {
        "nim": nim,
        "token": token,
        "message": "Login berhasil. Session aktif 7 hari (sliding).",
        "systems": {"siakad": bool(effective_sv_pass), "mybest": True},
        "warnings": warnings,
        "default_password": {
            "siakad": False,
            "mybest": False,
        },
    }

    from fastapi.responses import JSONResponse

    response = JSONResponse(
        status_code=status.HTTP_200_OK,
        content=success_response(data=response_data),
    )
    is_https = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    cookie_samesite = "none" if is_https else "lax"
    cookie_domain = settings.SESSION_COOKIE_DOMAIN or None
    response.set_cookie(
        key="ubsi_session",
        value=token,
        max_age=7 * 24 * 3600,
        httponly=True,
        secure=is_https,
        samesite=cookie_samesite,
        domain=cookie_domain,
    )
    return response


# ─── Also add a simple health check ───
@router.get("/health-auto")
async def health_auto():
    return {"status": "ok", "tesseract": os.path.exists(TESSERACT_CMD)}
