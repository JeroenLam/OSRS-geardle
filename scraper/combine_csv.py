import csv
from pathlib import Path

OUTPUT_DIR = Path("../output")
COMBINED_FILE = Path("combined_equipment.csv")


def combine_csvs():
    csv_files = sorted(
        file
        for file in OUTPUT_DIR.glob("*.csv")
        if file.resolve() != COMBINED_FILE.resolve()
    )

    if not csv_files:
        print(f"No CSV files found in {OUTPUT_DIR}")
        return

    rows_written = 0
    header = None

    with COMBINED_FILE.open("w", newline="", encoding="utf-8-sig") as outfile:
        writer = None

        for csv_file in csv_files:
            print(f"Reading {csv_file.name}...")

            with csv_file.open("r", newline="", encoding="utf-8-sig") as infile:
                reader = csv.DictReader(infile)

                if not reader.fieldnames:
                    print(f"Skipping {csv_file.name}: no header found")
                    continue

                if header is None:
                    header = reader.fieldnames
                    writer = csv.DictWriter(outfile, fieldnames=header)
                    writer.writeheader()
                elif reader.fieldnames != header:
                    print(f"Skipping {csv_file.name}: columns don't match")
                    continue

                for row in reader:
                    writer.writerow(row)
                    rows_written += 1

    if rows_written:
        print(f"\nCombined {len(csv_files)} CSV files.")
        print(f"Total rows: {rows_written}")
        print(f"Saved to: {COMBINED_FILE}")
    else:
        print("No rows were combined.")


if __name__ == "__main__":
    combine_csvs()
