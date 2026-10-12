"""Dependency-free local link checks; --compare REF also protects published copy."""
import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import subprocess
import re
import struct
import xml.etree.ElementTree as ET
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SITE = 'https://neo-polar.github.io/'


class Page(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.hidden = 0
        self.copy = []
        self.links = []
        self.ids = set()
        self.meta = {}
        self.icon_links = []
        self.canonical = None
        self.structured_data = []
        self.in_structured_data = False
        self.inline_styles = 0
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'style' or 'style' in attrs:
            self.inline_styles += 1
        if tag == 'meta':
            self.meta[attrs.get('property', attrs.get('name', ''))] = attrs.get('content', '')
        if tag == 'link' and 'icon' in attrs.get('rel', '').split():
            self.icon_links.append(attrs)
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonical = attrs.get('href')
        if tag == 'script' and attrs.get('type') == 'application/ld+json':
            self.in_structured_data = True
            self.structured_data.append('')
        if tag in ('script', 'style'):
            self.hidden += 1
        if 'id' in attrs:
            self.ids.add(attrs['id'])
        for key in ('href', 'src', 'action', 'data-src-ja', 'data-src-en'):
            if attrs.get(key):
                self.links.append((tag, key, attrs[key]))
        for key, value in attrs.items():
            if key.startswith('data-') or key in ('alt', 'placeholder', 'aria-label'):
                self.copy.append((tag, key, value))

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.hidden -= 1
        if tag == 'script':
            self.in_structured_data = False

    def handle_data(self, data):
        if self.in_structured_data:
            self.structured_data[-1] += data
        if not self.hidden and data.strip():
            self.copy.append(('text', data.strip()))


def uses_site_css(page):
    return any(tag == 'link' and urlsplit(value).path.endswith('css/design.css') for tag, key, value in page.links)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--compare', help='Git revision to compare text and existing links against')
    args = parser.parse_args()
    pages = {p: Page(p.read_text(encoding='utf-8')) for p in ROOT.rglob('*.html')}
    errors = []
    count = 0
    social_count = 0
    for path, page in pages.items():
        relative = path.relative_to(ROOT).as_posix()
        if page.inline_styles:
            errors.append(f'{relative}: inline styles conflict with the site CSP; use an external stylesheet')
        if uses_site_css(page):
            social_count += 1
            image_url = page.meta.get('og:image', '')
            parsed = urlsplit(image_url)
            if parsed.scheme != 'https' or parsed.netloc != 'neo-polar.github.io':
                errors.append(f'{relative}: missing or invalid absolute OG image URL')
            elif page.meta.get('twitter:image') != image_url:
                errors.append(f'{relative}: OG and Twitter image references disagree')
            else:
                image_path = ROOT / unquote(parsed.path.lstrip('/'))
                if not image_path.is_file():
                    errors.append(f'{relative}: missing social image {image_url}')
                else:
                    with image_path.open('rb') as stream:
                        header = stream.read(24)
                    if len(header) != 24 or header[:8] != b'\x89PNG\r\n\x1a\n':
                        errors.append(f'{relative}: social image is not a PNG')
                    else:
                        width, height = struct.unpack('>II', header[16:24])
                        if (str(width), str(height)) != (page.meta.get('og:image:width'), page.meta.get('og:image:height')):
                            errors.append(f'{relative}: OG dimensions disagree with PNG')
            if page.meta.get('og:image:type') != 'image/png' or not page.meta.get('og:image:alt'):
                errors.append(f'{relative}: missing social image type or description')
        for tag, key, value in page.links:
            url = urlsplit(value)
            if url.scheme or url.netloc:
                continue
            target = (ROOT / unquote(url.path.lstrip('/')) if url.path.startswith('/')
                      else path.parent / unquote(url.path)) if url.path else path
            target = target.resolve()
            if target.is_dir():
                target /= 'index.html'
            count += 1
            if not target.exists():
                errors.append(f'{relative}: missing {value}')
            elif url.fragment and target in pages and unquote(url.fragment) not in pages[target].ids:
                errors.append(f'{relative}: missing anchor {value}')
        if args.compare:
            result = subprocess.run(['git', 'show', f'{args.compare}:{relative}'], cwd=ROOT, capture_output=True)
            if result.returncode:
                errors.append(f'{relative}: cannot read comparison revision')
                continue
            before = Page(result.stdout.decode('utf-8'))
            if page.copy != before.copy:
                errors.append(f'{relative}: text or translation attributes changed')
            # New stylesheet references are allowed; original references must remain.
            def original_links(links):
                added = {
                    ('link', 'css/design.css'),
                    ('link', 'css/polar-motion.css'),
                    ('link', 'css/home.css'),
                    ('link', 'https://neo-polar.github.io/'),
                    ('script', 'js/polar-motion.js'),
                }
                normalized = []
                for link in links:
                    value = link[2].removeprefix('../')
                    if link[0] == 'link' and urlsplit(value).path.endswith('.css'):
                        value = urlsplit(value).path
                    if value == '/favicon-polar.png':
                        value = './favicon-96x96.png'
                    # Typeface choices may change; it stays one Google Fonts stylesheet.
                    if urlsplit(value).netloc == 'fonts.googleapis.com' and urlsplit(value).path == '/css2':
                        value = 'https://fonts.googleapis.com/css2'
                    candidate = (link[0], link[1], value)
                    if (candidate[0], candidate[2]) not in added:
                        normalized.append(candidate)
                return normalized
            if original_links(page.links) != original_links(before.links):
                errors.append(f'{relative}: existing links or asset references changed')

    home = pages.get(ROOT / 'index.html')
    google_icon = next((link for link in home.icon_links
                        if link.get('href') == '/favicon-polar.png'), None) if home else None
    if not google_icon or google_icon.get('type') != 'image/png' or google_icon.get('sizes') != '96x96':
        errors.append('index.html: missing stable 96x96 PNG favicon for Google Search')
    favicon = ROOT / 'favicon-polar.png'
    if not favicon.is_file():
        errors.append('missing favicon-polar.png')
    else:
        with favicon.open('rb') as stream:
            header = stream.read(24)
        if len(header) != 24 or header[:8] != b'\x89PNG\r\n\x1a\n' or struct.unpack('>II', header[16:24]) != (96, 96):
            errors.append('favicon-polar.png must be a 96x96 PNG')

    robots = ROOT / 'robots.txt'
    if not robots.is_file():
        errors.append('missing robots.txt')
    else:
        robots_text = robots.read_text(encoding='utf-8')
        if 'User-agent: *' not in robots_text or 'Sitemap: https://neo-polar.github.io/sitemap.xml' not in robots_text:
            errors.append('robots.txt must allow general crawling and declare the sitemap')

    locations = []
    sitemap = ROOT / 'sitemap.xml'
    if not sitemap.is_file():
        errors.append('missing sitemap.xml')
    else:
        try:
            sitemap_root = ET.parse(sitemap).getroot()
            namespace = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
            locations = [node.text for node in sitemap_root.findall('sm:url/sm:loc', namespace)]
            if 'https://neo-polar.github.io/' not in locations:
                errors.append('sitemap.xml must include the canonical home page')
        except ET.ParseError as error:
            errors.append(f'sitemap.xml: invalid XML ({error})')

    # Public pages need their own canonical URL, snippet and sitemap entry; a page copied
    # from another one must not keep that page's canonical URL, or search engines skip it.
    search_count = 0
    for path, page in pages.items():
        relative = path.relative_to(ROOT).as_posix()
        if not uses_site_css(page) or 'noindex' in page.meta.get('robots', ''):
            continue
        search_count += 1
        expected = SITE + ('' if relative == 'index.html' else relative)
        if page.canonical != expected:
            errors.append(f'{relative}: canonical URL must be {expected}')
        if page.meta.get('og:url', expected) != expected:
            errors.append(f'{relative}: og:url must be {expected}')
        if not page.meta.get('description'):
            errors.append(f'{relative}: missing meta description')
        if expected not in locations:
            errors.append(f'{relative}: add {expected} to sitemap.xml')
        for block in page.structured_data:
            try:
                json.loads(block)
            except json.JSONDecodeError as error:
                errors.append(f'{relative}: invalid JSON-LD structured data ({error})')
    for location in locations:
        target = ROOT / (urlsplit(location).path.lstrip('/') or 'index.html')
        if target not in pages or 'noindex' in pages[target].meta.get('robots', ''):
            errors.append(f'sitemap.xml: {location} is not a public page')
    for css in (ROOT / 'css').glob('*.css'):
        for value in re.findall(r'url\(\s*[\"\']?([^\"\')\s]+)', css.read_text(encoding='utf-8')):
            if not urlsplit(value).scheme and not value.startswith('#'):
                count += 1
                if not (css.parent / unquote(value)).is_file():
                    errors.append(f'{css.name}: missing CSS asset {value}')
    print(f'Checked {len(pages)} HTML files and {count} local references.')
    print(f'Checked social PNG references and dimensions on {social_count} pages.')
    print('Checked Google favicon, robots.txt and sitemap.xml discovery.')
    print(f'Checked canonical URLs, descriptions and structured data on {search_count} public pages.')
    if args.compare:
        print(f'Compared text, translations and original links with {args.compare}.')
    for error in errors:
        print(f'ERROR: {error}')
    if errors:
        raise SystemExit(1)
    print('PASS')


if __name__ == '__main__':
    main()
