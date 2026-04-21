import re
from typing import Optional
import httpx

# BeautifulSoup is optional at runtime; fall back to regex parsing when unavailable
try:
    from bs4 import BeautifulSoup  # type: ignore
    _HAVE_BS4 = True
except Exception:
    BeautifulSoup = None  # type: ignore
    _HAVE_BS4 = False


async def fetch_preview_image(url: str, timeout: float = 6.0) -> Optional[str]:
    """Attempt to discover a preview image for a URL.

    Steps (best-effort):
    - Fetch the HTML page (GET)
    - Look for Open Graph `og:image`, `twitter:image`, `link[rel=image_src]`
    - If none found, pick the largest <img> candidate by dimensions attribute or file name
    - Validate the image URL by checking content-type with a HEAD request (best-effort)
    Returns an absolute image URL or None.
    """
    if not url or not isinstance(url, str):
        return None

    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None

            content_type = resp.headers.get("content-type", "")
            if content_type.startswith("image/"):
                # URL points directly to an image
                return url

            text = resp.text or ""

            candidates = []
            imgs = []

            if _HAVE_BS4 and BeautifulSoup is not None:
                soup = BeautifulSoup(text, "html.parser")

                og = soup.find("meta", property="og:image")
                if og and og.get("content"):
                    candidates.append(og.get("content"))
                tw = soup.find("meta", attrs={"name": "twitter:image"})
                if tw and tw.get("content"):
                    candidates.append(tw.get("content"))
                link_img = soup.find("link", rel=lambda x: x and "image" in x)
                if link_img and link_img.get("href"):
                    candidates.append(link_img.get("href"))

                for img in soup.find_all("img"):
                    src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
                    if not src:
                        continue
                    imgs.append((src, img.get("width"), img.get("height")))
            else:
                # fallback: regex-based extraction for common meta tags and first image
                og_match = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', text, flags=re.IGNORECASE)
                if og_match:
                    candidates.append(og_match.group(1))
                tw_match = re.search(r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)["\']', text, flags=re.IGNORECASE)
                if tw_match:
                    candidates.append(tw_match.group(1))
                link_match = re.search(r'<link[^>]+rel=["\']?(?:image_src|icon|preload)["\']?[^>]+href=["\']([^"\']+)["\']', text, flags=re.IGNORECASE)
                if link_match:
                    candidates.append(link_match.group(1))
                img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', text, flags=re.IGNORECASE)
                if img_match:
                    imgs.append((img_match.group(1), None, None))

            # Prefer explicit meta candidates first
            for cand in candidates:
                cand_url = _absolute_url(url, cand)
                if await _validate_image_url(cand_url, timeout=timeout):
                    return cand_url

            # sort img candidates by any numeric width/height attributes
            def _score(img_tuple):
                w = _num(img_tuple[1])
                h = _num(img_tuple[2])
                return (w or 0) * (h or 0)

            imgs_sorted = sorted(imgs, key=_score, reverse=True)
            for src, _, _ in imgs_sorted:
                cand_url = _absolute_url(url, src)
                if await _validate_image_url(cand_url, timeout=timeout):
                    return cand_url

    except Exception:
        return None

    return None


def _num(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(str(value).strip())
    except Exception:
        return None


def _absolute_url(base: str, candidate: str) -> str:
    candidate = (candidate or "").strip()
    if not candidate:
        return ""
    if re.match(r"^https?://", candidate, flags=re.IGNORECASE):
        return candidate
    # handle protocol-relative
    if candidate.startswith("//"):
        return f"https:{candidate}"
    # otherwise join with base
    try:
        from urllib.parse import urljoin

        return urljoin(base, candidate)
    except Exception:
        return candidate


async def _validate_image_url(url: str, timeout: float = 6.0) -> bool:
    if not url:
        return False
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            head = await client.head(url)
            if head.status_code == 200:
                ct = head.headers.get("content-type", "")
                if ct.startswith("image/"):
                    return True
            # some servers don't respond to HEAD correctly, try GET with small range
            get = await client.get(url, timeout=timeout)
            if get.status_code == 200:
                ct = get.headers.get("content-type", "")
                return ct.startswith("image/")
    except Exception:
        return False
    return False
