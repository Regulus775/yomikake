"""Configure the public Google OAuth client ID in both upstream HTML files."""
import argparse
import re
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("client_id", help="Public client ID, not the client secret")
    args = parser.parse_args()
    if not re.fullmatch(r"\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com", args.client_id):
        parser.error("Invalid Google OAuth client ID")

    root = Path(__file__).resolve().parent.parent
    pattern = re.compile(rb"(?m)^const GOOGLE_CLIENT_ID = '[^']*';")
    replacement = f"const GOOGLE_CLIENT_ID = '{args.client_id}';".encode("ascii")
    updates = []
    for name in ("yomikake.html", "yomikake_ios.html"):
        path = root / name
        source = path.read_bytes()
        if len(pattern.findall(source)) != 1:
            parser.error(f"Expected one GOOGLE_CLIENT_ID in {name}; no files changed")
        updates.append((path, pattern.sub(replacement, source)))

    for path, content in updates:
        path.write_bytes(content)
    print("Configured Google Drive client ID in both HTML files.")


if __name__ == "__main__":
    main()
