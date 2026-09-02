#!/usr/bin/env python3
"""Ενώνει το site/raise/ σε ΕΝΑ αρχείο για δημοσίευση ως artifact
(fragment χωρίς doctype/head — το host τα δίνει), inlining CSS και JS,
και αφαιρώντας manifest/service-worker που δεν έχουν νόημα εκεί.

    tools/bundle.py site/raise out.html
"""
import re, sys, pathlib

src = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2])
html = (src / "index.html").read_text(encoding="utf-8")
body = re.search(r"<body\b[^>]*>(.*?)</body>", html, re.S).group(1)
head = re.search(r"<head\b[^>]*>(.*?)</head>", html, re.S).group(1)

title = re.search(r"<title>.*?</title>", head, re.S).group(0)
links = re.findall(r'<link\b[^>]*rel="(?:preconnect|stylesheet)"[^>]*href="https://[^"]+"[^>]*>', head)
css = (src / "app.css").read_text(encoding="utf-8")

# scripts: inline τα τοπικά, πέτα το register του SW
body = re.sub(r'<script src="(game|fx|ui)\.js"></script>',
              lambda m: "<script>\n" + (src / (m.group(1) + ".js")).read_text(encoding="utf-8") + "\n</script>", body)
body = re.sub(r"<script>\s*if \(\"serviceWorker\".*?</script>", "", body, flags=re.S)

out.write_text(title + "\n" + "\n".join(links) + "\n<style>\n" + css + "\n</style>\n" + body.strip() + "\n", encoding="utf-8")
print(f"bundled → {out} ({out.stat().st_size} bytes)")
