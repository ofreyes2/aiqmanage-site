#!/usr/bin/env python3
"""AiQ Manage project pages. Reads projects.json, writes apps/<slug>/index.html (+ copies web-sized screenshots), and apps/index.html gallery.
Only projects with "public": true are written. Screenshots come from ~/hubstage/brand/shots/<shots>/{phone,tablet,desktop}.png (3x PNG) and are
saved next to the page as WebP (and the phone PNG kept full-res for App Store use)."""
import json, os, html, shutil
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.expanduser('~/hubstage/brand/shots')
P = json.load(open(os.path.join(ROOT, 'tools', 'projects.json'), encoding='utf-8'))
MARK = open(os.path.join(ROOT, 'assets', 'aiq-mark.svg'), encoding='utf-8').read().replace('#0b0e14', 'var(--bg)')
E = html.escape
STATUS = {'appstore': 'On the App Store', 'testflight': 'TestFlight', 'hub': 'Private app on the AiQ hub', 'soon': 'Coming soon'}

def webp(src, dst, max_w):
    im = Image.open(src).convert('RGB'); w, h = im.size
    if w > max_w: im = im.resize((max_w, int(h * max_w / w)), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=86, method=6)

def page(p):
    slug = p['slug']; d = os.path.join(ROOT, 'apps', slug); os.makedirs(d, exist_ok=True)
    shots = []
    for frame, cap in [('phone', 'iPhone'), ('tablet', 'iPad'), ('desktop', 'Mac / web')]:
        src = os.path.join(SHOTS, p.get('shots', slug), frame + '.png')
        if os.path.exists(src):
            webp(src, os.path.join(d, frame + '.webp'), 1200 if frame == 'phone' else 2000)
            if frame == 'phone': shutil.copy(src, os.path.join(d, 'phone@3x.png'))
            shots.append((frame, cap))
    links = ''.join(f'<a class="btn{" primary" if i == 0 else ""}" href="{E(u)}">{E(t)}</a>' for i, (t, u) in enumerate(p.get('links', [])))
    feats = ''.join(f'<li>{E(f)}</li>' for f in p.get('features', []))
    gallery = ''.join(f'<figure class="{f}"><img src="{f}.webp" alt="{E(p["name"])} on {c}" loading="lazy"><figcaption>{c}</figcaption></figure>' for f, c in shots)
    return f'''<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="icon" type="image/svg+xml" href="../../favicon.svg"><meta name="description" content="{E(p['pitch'])}">
<title>{E(p['name'])} — AiQ Manage</title>
<style>
:root{{--bg:#0b0e14;--panel:#151a24;--line:#2a3345;--text:#e8ecf4;--dim:#9aa5b8;--gold:#e8b33c;--blue:#5aa9ff;--sat:env(safe-area-inset-top,0px)}}
*{{margin:0;padding:0;box-sizing:border-box}}html,body{{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:17px;line-height:1.6}}
a{{color:var(--blue);text-decoration:none}}a:hover{{text-decoration:underline}}
.wrap{{max-width:900px;margin:0 auto;padding:calc(28px + var(--sat)) 20px 60px}}
header.top{{display:flex;align-items:center;gap:12px;margin-bottom:24px}}header.top svg{{width:100px;height:60px;flex:none}}header.top .brand{{font-weight:800;font-size:19px}}.brand b{{color:var(--gold)}}header.top .home{{margin-left:auto;font-size:14.5px;font-weight:600}}
h1{{font-size:34px;font-weight:800;margin:6px 0;letter-spacing:-.3px}}h2{{font-size:15px;text-transform:uppercase;letter-spacing:1.2px;color:var(--gold);margin:30px 0 10px}}
.lead{{color:var(--dim);font-size:19px;max-width:62ch}}p{{margin:12px 0;color:#d3d9e6;max-width:70ch}}
.pill{{display:inline-block;background:#221d10;color:var(--gold);border:1px solid #6b5a1f;border-radius:20px;padding:3px 12px;font-size:12.5px;font-weight:700;margin-left:8px;vertical-align:middle}}
.btns{{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}}.btn{{display:inline-block;border:1px solid var(--line);border-radius:12px;padding:10px 16px;font-weight:700;font-size:15px;color:var(--text);background:var(--panel)}}.btn.primary{{background:var(--gold);color:#0b0e14;border-color:var(--gold)}}.btn:hover{{text-decoration:none;filter:brightness(1.08)}}
ul{{margin:12px 0 12px 22px;max-width:70ch}}li{{margin:8px 0;color:#d3d9e6}}
.gallery{{display:grid;grid-template-columns:repeat(12,1fr);gap:14px;margin:18px 0}}figure{{margin:0;background:var(--panel);border:1px solid var(--line);border-radius:16px;overflow:hidden}}figure img{{width:100%;height:auto;display:block}}figcaption{{font-size:12.5px;color:var(--dim);padding:8px 12px;border-top:1px solid var(--line)}}
figure.phone{{grid-column:span 4}}figure.tablet{{grid-column:span 8}}figure.desktop{{grid-column:span 12}}@media(max-width:700px){{figure.phone,figure.tablet{{grid-column:span 12}}}}
footer{{margin-top:44px;border-top:1px solid var(--line);padding-top:18px;color:var(--dim);font-size:14px}}
</style></head><body><div class="wrap">
<header class="top">{MARK}<div class="brand">{E(p.get('brandword', p['name']))}</div><a class="home" href="../../">AiQ Manage</a></header>
<h1>{E(p['name'])} <span class="pill">{E(STATUS.get(p.get('status','hub'), p.get('status','')))}</span></h1>
<p class="lead">{E(p['pitch'])}</p>
<div class="btns">{links}</div>
<h2>What it does</h2><p>{E(p['blurb'])}</p>{('<ul>' + feats + '</ul>') if feats else ''}
{('<h2>Screens</h2><div class="gallery">' + gallery + '</div>') if gallery else ''}
{('<h2>Privacy</h2><p>' + E(p['privacy']) + '</p>') if p.get('privacy') else ''}
<footer>AiQ Manage · <a href="mailto:support@aiqmanage.com">support@aiqmanage.com</a> · <a href="../../privacy/">Privacy</a> · <a href="../../support/">Support</a></footer>
</div></body></html>'''

pub = [p for p in P if p.get('public')]
for p in pub:
    htmltext = page(p)
    open(os.path.join(ROOT, 'apps', p['slug'], 'index.html'), 'w', encoding='utf-8').write(htmltext); print('wrote apps/%s/' % p['slug'])
cards = ''.join(f'<a class="app" href="{E(p["slug"])}/"><div class="hd"><div class="t">{E(p["name"])}</div><span class="pill">{E(STATUS.get(p.get("status","hub"),""))}</span></div><div class="d">{E(p["pitch"])}</div>{("<img src=\"" + E(p["slug"]) + "/phone.webp\" alt=\"\" loading=\"lazy\">") if os.path.exists(os.path.join(ROOT,"apps",p["slug"],"phone.webp")) else ""}</a>' for p in pub)
open(os.path.join(ROOT, 'apps', 'index.html'), 'w', encoding='utf-8').write(f'''<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" type="image/svg+xml" href="../favicon.svg"><title>Apps — AiQ Manage</title>
<style>:root{{--bg:#0b0e14;--panel:#151a24;--line:#2a3345;--text:#e8ecf4;--dim:#9aa5b8;--gold:#e8b33c;--blue:#5aa9ff}}*{{margin:0;padding:0;box-sizing:border-box}}html,body{{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:17px;line-height:1.55}}a{{color:var(--blue);text-decoration:none}}
.wrap{{max-width:1040px;margin:0 auto;padding:36px 20px 60px}}header.top{{display:flex;align-items:center;gap:12px;margin-bottom:20px}}header.top svg{{width:100px;height:60px}}header.top .brand{{font-weight:800;font-size:19px}}.brand b{{color:var(--gold)}}header.top .home{{margin-left:auto;font-weight:600;font-size:14.5px}}
h1{{font-size:32px;font-weight:800;margin:6px 0 18px}}.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}}
.app{{display:flex;flex-direction:column;gap:8px;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px;color:var(--text)}}.app:hover{{border-color:var(--gold)}}.hd{{display:flex;align-items:center;justify-content:space-between;gap:8px}}.t{{font-weight:800;font-size:17px}}.d{{font-size:14px;color:var(--dim);flex:1}}.app img{{width:100%;border-radius:10px;border:1px solid var(--line);margin-top:6px}}
.pill{{background:#221d10;color:var(--gold);border:1px solid #6b5a1f;border-radius:20px;padding:2px 9px;font-size:11px;font-weight:700;white-space:nowrap}}footer{{margin-top:40px;border-top:1px solid var(--line);padding-top:16px;color:var(--dim);font-size:14px}}</style></head>
<body><div class="wrap"><header class="top">{MARK}<div class="brand">Ai<b>Q</b> Manage</div><a class="home" href="../">Home</a></header><h1>Apps</h1><div class="grid">{cards}</div>
<footer>AiQ Manage · <a href="mailto:support@aiqmanage.com">support@aiqmanage.com</a></footer></div></body></html>''')
print('gallery: apps/index.html with', len(pub), 'apps')
