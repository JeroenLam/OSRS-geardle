import csv
import re
import requests

from pathlib import Path
from bs4 import BeautifulSoup

# ==========================================
# Configuration
# ==========================================

URLS_FILE = Path("table_links.txt")
OUTPUT_DIR = Path("../output")

REQUEST_TIMEOUT = 30

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; EquipmentScraper/1.0)"}


# ==========================================
# CSV configuration
# ==========================================

COLUMNS = [
    "equipment_slot",
    "image",
    "name",
    "is_member",
    "stab_attack",
    "slash_attack",
    "crush_attack",
    "magic_attack",
    "range_attack",
    "stab_defence",
    "slash_defence",
    "crush_defence",
    "magic_defence",
    "range_defence",
    "strength",
    "range_strength",
    "magic_strength",
    "prayer",
    "weight",
    "attack_speed",
]


# ==========================================
# HTML parsing
# ==========================================


def parse_html(html: str, page_url: str, equipment_slot: str) -> list:
    soup = BeautifulSoup(html, "html.parser")

    rows = []

    for tr in soup.select("tr"):
        cells = tr.find_all("td", recursive=False)

        # 18 columns without attack speed,
        # 19 columns with attack speed.
        if len(cells) not in (18, 19):
            continue

        # Image
        img = cells[0].find("img")

        image = (
            requests.compat.urljoin(page_url, img["src"])
            if img and img.get("src")
            else ""
        )

        # Name
        link = cells[1].find("a")
        name = link.get_text(strip=True) if link else ""

        # Membership
        is_member = cells[2].find("img", src=re.compile(r"Member_icon")) is not None

        # Stats
        values = [cell.get_text(strip=True) for cell in cells[3:]]

        # Optional attack speed
        if len(cells) == 18:
            values.append("")

        rows.append([equipment_slot, image, name, is_member, *values])

    return rows


# ==========================================
# Download and export
# ==========================================


def scrape_page(equipment_slot: str, url: str, output_dir: Path):
    try:
        print(f"Downloading [{equipment_slot}]: {url}")

        response = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)

        response.raise_for_status()

        rows = parse_html(response.text, url, equipment_slot)

        if not rows:
            print(f"  No equipment rows found: {url}")
            return

        # Use equipment slot as filename
        filename = re.sub(r'[<>:"/\\|?*]', "_", equipment_slot).strip()

        output_path = output_dir / f"{filename}.csv"

        # Export CSV
        with open(output_path, "w", newline="", encoding="utf-8-sig") as file:

            writer = csv.writer(file)
            writer.writerow(COLUMNS)
            writer.writerows(rows)

        print(f"  Exported {len(rows)} items -> {output_path}")

    except requests.RequestException as e:
        print(f"  Download error: {e}")

    except Exception as e:
        print(f"  Parsing/export error: {e}")


# ==========================================
# Read links file
# ==========================================


def read_links(file_path: Path) -> list:
    links = []

    for line_number, line in enumerate(
        file_path.read_text(encoding="utf-8").splitlines(), start=1
    ):
        line = line.strip()

        # Skip empty lines and comments
        if not line or line.startswith("#"):
            continue

        try:
            equipment_slot, url = line.split(",", 1)

            equipment_slot = equipment_slot.strip()
            url = url.strip()

            if not equipment_slot or not url:
                raise ValueError("Name or URL is empty")

            links.append((equipment_slot, url))

        except ValueError as e:
            print(f"Invalid line {line_number}: {line} ({e})")

    return links


# ==========================================
# Main
# ==========================================


def main():
    if not URLS_FILE.exists():
        print(f"URL list not found: {URLS_FILE}")
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    links = read_links(URLS_FILE)

    print(f"Found {len(links)} URLs")
    print("-" * 50)

    for equipment_slot, url in links:
        scrape_page(equipment_slot, url, OUTPUT_DIR)

    print("-" * 50)
    print("Scraping completed!")


if __name__ == "__main__":
    main()
