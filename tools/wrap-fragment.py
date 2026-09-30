#!/usr/bin/env python3
"""Wrap an artifact-style fragment (bare <title>/<link>/<style> + markup) into a
full HTML document, and strip one back to a fragment.

Artifact pages are published as fragments: the host supplies doctype, <html>,
<head> and the viewport meta. A fragment served directly over the web has no
viewport meta, so phones lay it out at 980px and shrink everything. Site copies
therefore need the real document wrapper.

    wrap-fragment.py wrap   in.html out.html "lang"
    wrap-fragment.py strip  in.html out.html
"""
import re
import sys

HEAD = '''<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#123328">
<style>
:root{{color-scheme:light dark}}
body{{margin:0}}
img{{max-width:100%}}
[hidden]{{display:none!important}}
</style>
'''


def wrap(src: str, lang: str) -> str:
    if src.lstrip().lower().startswith(("<!doctype", "<html")):
        raise SystemExit("already a full document")
    return HEAD.format(lang=lang) + src.strip() + "\n</head>\n<body>\n</body>\n</html>\n"


def strip(src: str) -> str:
    """Keep <title>, font <link>s, <style> blocks and the <body> contents."""
    head = re.search(r"<head\b[^>]*>(.*?)</head>", src, re.S | re.I)
    body = re.search(r"<body\b[^>]*>(.*?)</body>", src, re.S | re.I)
    if not head or not body:
        raise SystemExit("not a full document")
    keep = []
    for pat in (r"<title\b[^>]*>.*?</title>", r'<link\b[^>]*rel="(?:preconnect|stylesheet)"[^>]*>',
                r"<style\b[^>]*>.*?</style>"):
        keep += re.findall(pat, head.group(1), re.S | re.I)
    return "\n".join(k.strip() for k in keep) + "\n\n" + body.group(1).strip() + "\n"


def main() -> None:
    if len(sys.argv) < 4:
        raise SystemExit(__doc__)
    mode, src_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    src = open(src_path, encoding="utf-8").read()
    if mode == "wrap":
        out = wrap(src, sys.argv[4] if len(sys.argv) > 4 else "el")
    elif mode == "strip":
        out = strip(src)
    else:
        raise SystemExit(__doc__)
    open(out_path, "w", encoding="utf-8").write(out)
    print(f"{mode}: {src_path} -> {out_path} ({len(out.encode())} bytes)")


if __name__ == "__main__":
    main()
