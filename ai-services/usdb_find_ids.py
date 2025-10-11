import argparse, re, sys, requests
from bs4 import BeautifulSoup as BS
from boil_down import boil_down, boil_down_match

BASE = "https://usdb.animux.de"
LOGIN_URL = f"{BASE}/index.php?link=login"
LIST_URL  = f"{BASE}/?link=list"
UA = {"User-Agent": "Mozilla/5.0"}

def login(session: requests.Session, user: str, pw: str):
    r = session.post(
        LOGIN_URL,
        data={"user": user, "pass": pw, "login": "Login"},
        headers={**UA, "Origin": BASE, "Referer": LOGIN_URL},
        timeout=30
    )
    r.raise_for_status()
    # Schnellcheck: Profil nur eingeloggt erreichbar
    prof = session.get(f"{BASE}/index.php?link=profil", headers=UA, timeout=30)
    if "You are not logged in" in prof.text:
        raise RuntimeError("Login fehlgeschlagen oder Session nicht aktiv.")
    return True

def list_page(session: requests.Session, interpret: str, title: str, limit: int, start: int) -> str:
    r = session.post(
        LIST_URL,
        data={"interpret": interpret, "title": title, "limit": str(limit), "start": str(start)},
        headers={**UA, "Content-Type": "application/x-www-form-urlencoded", "Referer": LIST_URL},
        timeout=30
    )
    r.raise_for_status()
    if "You are not logged in" in r.text:
        raise RuntimeError("Nicht eingeloggt (Session-Cookie fehlt).")
    return r.text
HEADER_WORDS = {"artist", "interpret", "title", "song"}

def parse_list(html: str):
    soup = BS(html, "html.parser")
    songs = []

    for tr in soup.select("tr"):
        # Header-Zeilen sicher überspringen
        if tr.find("th"):
            continue
        # Title/Detail-Link = Song vorhanden?
        a_detail = tr.select_one('a[href*="link=detail"][href*="id="]')
        if not a_detail:
            continue

        href = a_detail.get("href") or ""
        m = re.search(r"id=(\d+)", href)
        if not m:
            continue
        song_id = int(m.group(1))
        title = a_detail.get_text(strip=True)

        # 1) Bevorzugt: interpret-Link irgendwo in der gleichen Zeile
        a_interpret = None
        for a in tr.select('a[href]'):
            h = a.get("href") or ""
            if "interpret=" in h:
                a_interpret = a
                break
        artist = a_interpret.get_text(strip=True) if a_interpret else None

        # 2) Fallback: Zelle links neben der Title-Zelle (aber Labelwörter filtern)
        if not artist:
            title_td = a_detail.find_parent("td")
            cand_td = title_td.find_previous_sibling("td") if title_td else None
            if cand_td:
                # wenn in der Zelle ein interpret-/artist-Link steckt, dessen Text nehmen
                link_in_cand = cand_td.select_one('a[href*="interpret="], a[href*="link=artist"]')
                if link_in_cand:
                    artist = link_in_cand.get_text(strip=True)
                else:
                    text = " ".join(cand_td.get_text(" ", strip=True).split())
                    if text.strip().lower() not in HEADER_WORDS and text != title:
                        artist = text

        # 3) Letzter Notnagel: expliziter link=artist
        if not artist:
            a_artist = tr.select_one('a[href*="link=artist"]')
            artist = a_artist.get_text(strip=True) if a_artist else ""

        songs.append({"id": song_id, "artist": artist, "title": title})

    return songs


def search_all_by_artist(session, artist: str, title: str = "", per_page: int = 100, max_items: int | None = None):
    start = 0
    seen = set()
    results = []
    while True:
        html = list_page(session, artist, title, limit=per_page, start=start)
        page = parse_list(html)
        # Ende, wenn nichts mehr kommt
        if not page:
            break
        # Deduplizieren & sammeln
        for s in page:
            if s["id"] in seen:
                continue
            seen.add(s["id"])
            results.append(s)
            if max_items and len(results) >= max_items:
                return results
        # Pagination
        if len(page) < per_page:
            break
        start += per_page
    return results

def main():
    ap = argparse.ArgumentParser(description="USDB: per Login alle Songs eines Interpreten (optional mit Titel-Filter) holen")
    ap.add_argument("--user", required=True, help="USDB Benutzername")
    ap.add_argument("--pass", dest="pw", required=True, help="USDB Passwort")
    ap.add_argument("--interpret", required=True, help="Künstlername (für alle Songs nur diesen angeben)")
    ap.add_argument("--title", default="", help="optional: Titel-Filter (leer = alle)")
    ap.add_argument("--per-page", type=int, default=100, help="Treffer pro Seite (Pagination)")
    ap.add_argument("--max", type=int, default=0, help="max. Gesamtanzahl (0 = alle)")
    ap.add_argument("--format", choices=["ids", "pretty", "tsv", "json"], default="pretty",
                    help="Ausgabeformat")
    args = ap.parse_args()

    max_items = args.max if args.max and args.max > 0 else None

    with requests.Session() as s:
        s.headers.update(UA)
        print("→ Login …")
        login(s, args.user, args.pw)

        print(f"→ Suche: interpret='{args.interpret}', title='{args.title or ''}'")
        songs = search_all_by_artist(
            s, args.interpret, title=args.title, per_page=args.per_page, max_items=max_items
        )

        if args.format == "ids":
            for x in songs:
                print(x["id"])
        elif args.format == "tsv":
            # ID \t Artist \t Title
            for x in songs:
                print(f"{x['id']}\t{x.get('artist') or ''}\t{x['title']}")
        elif args.format == "json":
            import json
            print(json.dumps(songs, ensure_ascii=False, indent=2))
        else:
            # pretty: "ID  Artist – Title"
            for x in songs:
                a = x.get("artist") or "?"
                print(f"{x['id']:>6}  {a} – {x['title']}")
            print(f"\n{len(songs)} Treffer.")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Fehler: {e}", file=sys.stderr)
        sys.exit(1)
