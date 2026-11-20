"""Small helper for querying the RuneScape wikis' "bucket" API (structured infobox data).

Works for both the OSRS wiki (default) and the RS3 wiki (pass RS3_WIKI).
"""

import re
import time

import requests

OSRS_WIKI = "https://oldschool.runescape.wiki"
RS3_WIKI = "https://runescape.wiki"
API_URL = f"{OSRS_WIKI}/api.php"
HEADERS = {"User-Agent": "OSRS-Geardle-Scraper/1.0"}
PAGE_SIZE = 5000
REQUEST_TIMEOUT = 60


def query_bucket(bucket: str, fields: list[str], wiki: str = OSRS_WIKI) -> list[dict]:
    """Fetch every row of a bucket, paging through the results."""
    select = ",".join(f"'{f}'" for f in fields)
    rows: list[dict] = []
    offset = 0
    while True:
        query = f"bucket('{bucket}').select({select}).limit({PAGE_SIZE}).offset({offset}).run()"
        response = requests.get(
            f"{wiki}/api.php",
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


def file_url(file_name: str, wiki: str = OSRS_WIKI) -> str:
    """Turn 'File:Foo bar.png' (or '[[File:Foo bar.png|30px]]') into a direct image URL."""
    match = re.search(r"(?:File:)?([^\[\]|]+\.(?:png|gif|jpg|jpeg|webp|svg))", file_name or "", re.I)
    if not match:
        return ""
    name = match.group(1).strip().replace(" ", "_")
    name = name[0].upper() + name[1:]
    return f"{wiki}/images/{requests.utils.quote(name)}"


def fetch_wikitext(titles: list[str], wiki: str = OSRS_WIKI, categories: bool = False) -> dict[str, dict]:
    """Fetch the wikitext (and optionally categories) of pages, 50 per request."""
    pages: dict[str, dict] = {}
    props = "revisions|categories" if categories else "revisions"
    for i in range(0, len(titles), 50):
        response = requests.get(
            f"{wiki}/api.php",
            params={
                "action": "query",
                "prop": props,
                "rvprop": "content",
                "rvslots": "main",
                "cllimit": "max",
                "format": "json",
                "formatversion": "2",
                "titles": "|".join(titles[i : i + 50]),
            },
            headers=HEADERS,
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        for page in response.json()["query"]["pages"]:
            pages[page["title"]] = {
                "text": page["revisions"][0]["slots"]["main"]["content"] if "revisions" in page else "",
                "categories": {c["title"] for c in page.get("categories", [])},
            }
        print(f"  fetched {len(pages)}/{len(titles)} pages")
        time.sleep(1)
    return pages


def parse_template(text: str, name: str) -> dict[str, str]:
    """Parameters of the first {{name ...}} template whose parameters are on separate lines."""
    match = re.search(r"\{\{" + re.escape(name) + r"\s*\n(.*?)\n\}\}", text or "", re.S | re.I)
    if not match:
        return {}
    return {k.lower(): v.strip() for k, v in re.findall(r"(?:^|\n)\|\s*([A-Za-z_0-9]+)\s*=(.*)", match.group(1))}


def release_year(date: str) -> str:
    match = re.search(r"\b(19|20)\d{2}\b", date or "")
    return match.group(0) if match else ""


def page_images(titles: list[str], wiki: str = OSRS_WIKI) -> dict[str, str]:
    """Main image URL of each page (MediaWiki PageImages), 50 titles per request."""
    images: dict[str, str] = {}
    for i in range(0, len(titles), 50):
        response = requests.get(
            f"{wiki}/api.php",
            params={
                "action": "query",
                "prop": "pageimages",
                "piprop": "name",
                "format": "json",
                "formatversion": "2",
                "titles": "|".join(titles[i : i + 50]),
            },
            headers=HEADERS,
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        for page in response.json()["query"]["pages"]:
            if page.get("pageimage"):
                images[page["title"]] = file_url(page["pageimage"], wiki)
        if i and i % 1000 == 0:
            print(f"  page images: {i}/{len(titles)}")
        time.sleep(0.5)
    return images
