"""Tell Bing (Microsoft Edge), Yandex and other IndexNow engines which pages changed.

Run after deployment: python3 scripts/indexnow.py [BEFORE_SHA]
With BEFORE_SHA, only sitemap pages whose HTML changed since that commit are sent;
without it (manual run or first push), every page in sitemap.xml is sent.
"""
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
HOST = 'neo-polar.github.io'
ENDPOINT = 'https://api.indexnow.org/indexnow'


def find_key():
    for path in ROOT.glob('*.txt'):
        if re.fullmatch(r'[0-9a-f]{32}', path.stem) and path.read_text(encoding='utf-8').strip() == path.stem:
            return path.stem
    raise SystemExit('IndexNow key file (<32 hex chars>.txt at the site root) not found')


def sitemap_pages():
    namespace = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
    pages = {}
    for loc in ET.parse(ROOT / 'sitemap.xml').getroot().findall('sm:url/sm:loc', namespace):
        path = urlsplit(loc.text.strip()).path.lstrip('/')
        pages[path or 'index.html'] = loc.text.strip()
    return pages


def changed_files(before):
    if not before or set(before) == {'0'}:
        return None
    result = subprocess.run(['git', 'diff', '--name-only', before, 'HEAD'], cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        print(f'Cannot diff against {before}; sending every page.')
        return None
    return set(result.stdout.split())


def main():
    pages = sitemap_pages()
    changed = changed_files(sys.argv[1] if len(sys.argv) > 1 else '')
    urls = [url for path, url in pages.items() if changed is None or path in changed]
    if not urls:
        print('No sitemap pages changed; nothing to send.')
        return
    key = find_key()
    payload = {'host': HOST, 'key': key, 'keyLocation': f'https://{HOST}/{key}.txt', 'urlList': urls}
    request = urllib.request.Request(ENDPOINT, data=json.dumps(payload).encode('utf-8'), method='POST',
                                     headers={'Content-Type': 'application/json; charset=utf-8'})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            status = response.status
    except urllib.error.HTTPError as error:
        status = error.code
    except urllib.error.URLError as error:
        raise SystemExit(f'IndexNow request failed: {error.reason}')
    print(f'IndexNow responded {status} for {len(urls)} URL(s):')
    for url in urls:
        print(f'  {url}')
    if status not in (200, 202):
        raise SystemExit(f'IndexNow submission failed with HTTP {status}')


if __name__ == '__main__':
    main()
