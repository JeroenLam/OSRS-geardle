"""Small helper for querying the OSRS Wiki "bucket" API (structured infobox data)."""

import re
import time

import requests

API_URL = "https://oldschool.runescape.wiki/api.php"
HEADERS = {"User-Agent": "OSRS-Geardle-Scraper/1.0"}
PAGE_SIZE = 5000
REQUEST_TIMEOUT = 60


def query_bucket(bucket: str, fields: list[str]) -> list[dict]:
    """Fetch every row of a bucket, paging through the results."""
    select = ",".join(f"'{f}'" for f in fields)
    rows: list[dict] = []
    offset = 0
    while True:
        query = f"bucket('{bucket}').select({select}).limit({PAGE_SIZE}).offset({offset}).run()"
        response = requests.get(
            API_URL,
            params={"action": "bucket", "format": "json", "query": query},
            headers=HEADERS,
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
        if "error" in data:
            raise RuntimeError(f"Bucket query failed: {data['error']}")

        page = data.get("bucket", [])
        rows.extend(page)
        print(f"  {bucket}: fetched {len(rows)} rows")
        if len(page) < PAGE_SIZE:
            return rows
        offset += PAGE_SIZE
        time.sleep(1)


_REF_MARKER = re.compile(r"\x7f'\"`UNIQ--.*?--QINU`\"'\x7f")
_WIKI_LINK = re.compile(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]")
_HTML_TAG = re.compile(r"<[^>]+>")


def clean_text(value) -> str:
    """Strip wiki markup leftovers (ref markers, links, tags) from a text field."""
    if value is None:
        return ""
    if isinstance(value, list):
        value = value[0] if value else ""
    text = _REF_MARKER.sub("", str(value))
    text = _WIKI_LINK.sub(r"\1", text)
    text = _HTML_TAG.sub("", text)
    text = text.replace("'''", "").replace("''", "")
    return " ".join(text.split())


def file_url(file_name: str) -> str:
    """Turn 'File:Foo bar.png' into a direct image URL."""
    name = file_name.removeprefix("File:").strip().replace(" ", "_")
    return f"https://oldschool.runescape.wiki/images/{requests.utils.quote(name)}"


def release_year(date: str) -> str:
    match = re.search(r"\b(19|20)\d{2}\b", date or "")
    return match.group(0) if match else ""
