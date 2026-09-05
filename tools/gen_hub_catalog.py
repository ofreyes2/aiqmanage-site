#!/usr/bin/env python3
"""Hub project catalog (tailnet-only): one page per hub app with hi-res screenshots, blurbs from projects.json where present,
else the app registry description. Writes ~/hubstage/projects/<slug>/index.html + projects/index.html. Deploy = scp -r to
C:\\KNIGHTSWATCH\\profitagility\\projects\\ (served at :9443/projects/)."""
import json, os, html, urllib.request, ssl, shutil
from PIL import Image
HUB = 'https://knightswatch.tailb6c44b.ts.net:9443'
OUT = os.path.expanduser('~/hubstage/projects'); SHOTS = os.path.expanduser('~/hubstage/brand/shots')
SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
apps = json.load(urllib.request.urlopen(HUB + '/apps.json', context=ctx))['apps']
proj = {p.get('shots', p['slug']): p for p in json.load(open(os.path.join(SITE, 'tools', 'projects.json'), encoding='utf-8'))}
MARK = open(os.path.join(SITE, 'assets', 'aiq-mark.svg'), encoding='utf-8').read()
E = html.escape
def slug_of(url): return (url.replace('https://', '').split('/', 1)[1] if url.startswith('https://') else url).lstrip('/').replace('/index.html', '').rstrip('/').replace('.html', '').replace('/', '_') or 'home'
def webp(src, dst, max_w):
    im = Image.open(src).convert('RGB'); w, h = im.size
    if w > max_w: im = im.resize((max_w, int(h * max_w / w)), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=86, method=6)
CSS = ''':root{--bg:#0b0e14;--panel:#151a24;--line:#2a3345;--text:#e8ecf4;--dim:#9aa5b8;--gold:#e8b33c;--blue:#5aa9ff;--sat:env(safe-area-inset-top,0px)}*{margin:0;padding:0;box-sizing:border-box}html,body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:17px;line-height:1.6}a{color:var(--blue);text-decoration:none}a:hover{text-decoration:underline}.wrap{max-width:960px;margin:0 auto;padding:calc(24px + var(--sat)) 18px 70px}header.top{display:flex;align-items:center;gap:12px;margin-bottom:20px}header.top svg{width:90px;height:54px;flex:none}header.top .brand{font-weight:800;font-size:19px}.brand b{color:var(--gold)}header.top .home{margin-left:auto;font-size:14.5px;font-weight:600}h1{font-size:32px;font-weight:800;margin:6px 0;letter-spacing:-.3px}h2{font-size:15px;text-transform:uppercase;letter-spacing:1.2px;color:var(--gold);margin:28px 0 10px}.lead{color:var(--dim);font-size:18px;max-width:64ch}p{margin:12px 0;color:#d3d9e6;max-width:70ch}.pill{display:inline-block;background:#221d10;color:var(--gold);border:1px solid #6b5a1f;border-radius:20px;padding:3px 12px;font-size:12.5px;font-weight:700;margin-left:8px;vertical-align:middle}.btns{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}.btn{display:inline-block;border:1px solid var(--line);border-radius:12px;padding:10px 16px;font-weight:700;font-size:15px;color:var(--text);background:var(--panel)}.btn.primary{background:var(--gold);color:#0b0e14;border-color:var(--gold)}.btn:hover{text-decoration:none;filter:brightness(1.08)}ul{margin:12px 0 12px 22px;max-width:70ch}li{margin:8px 0;color:#d3d9e6}.gallery{display:grid;grid-template-columns:repeat(12,1fr);gap:14px;margin:16px 0}figure{margin:0;background:var(--panel);border:1px solid var(--line);border-radius:16px;overflow:hidden}figure img{width:100%;height:auto;display:block}figcaption{font-size:12.5px;color:var(--dim);padding:8px 12px;border-top:1px solid var(--line)}figure.phone{grid-column:span 4}figure.tablet{grid-column:span 8}figure.desktop{grid-column:span 12}@media(max-width:700px){figure.phone,figure.tablet{grid-column:span 12}}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}.app{display:flex;flex-direction:column;gap:8px;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px;color:var(--text)}.app:hover{border-color:var(--gold);text-decoration:none}.t{font-weight:800;font-size:17px}.d{font-size:13.5px;color:var(--dim)}.app img{width:100%;border-radius:10px;border:1px solid var(--line);aspect-ratio:9/16;object-fit:cover;object-position:top}.filter{margin:6px 0 14px}.filter input{width:100%;font:inherit;font-size:15px;color:var(--text);background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px}footer{margin-top:40px;border-top:1px solid var(--line);padding-top:16px;color:var(--dim);font-size:14px}'''
os.makedirs(OUT, exist_ok=True); cards = []
for a in apps:
    slug = slug_of(a['url']); url = a['url'] if a['url'].startswith('http') else '/' + a['url'].lstrip('/')
    p = proj.get(slug, {}); d = os.path.join(OUT, slug); os.makedirs(d, exist_ok=True)
    shots = []
    for frame, cap in [('phone', 'iPhone'), ('tablet', 'iPad'), ('desktop', 'Mac / web')]:
        src = os.path.join(SHOTS, slug, frame + '.png')
        if os.path.exists(src): webp(src, os.path.join(d, frame + '.webp'), 1200 if frame == 'phone' else 2000); shots.append((frame, cap))
        if frame == 'phone' and os.path.exists(src): shutil.copy(src, os.path.join(d, 'phone@3x.png'))
    name = p.get('name', a['nm']); pitch = p.get('pitch', a['ds']); blurb = p.get('blurb', ''); feats = p.get('features', [])
    gallery = ''.join(f'<figure class="{f}"><img src="{f}.webp" alt="{E(name)} on {c}" loading="lazy"><figcaption>{c} · <a href="{f}.webp">web</a>{" · <a href=\"phone@3x.png\">3x PNG</a>" if f == "phone" else ""}</figcaption></figure>' for f, c in shots)
    page = f'''<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="robots" content="noindex"><title>{E(name)} — AiQ projects</title><style>{CSS}</style></head><body><div class="wrap">
<header class="top">{MARK}<div class="brand">Ai<b>Q</b> projects</div><a class="home" href="../">All projects</a></header>
<h1>{E(name)}{(' <span class="pill">' + E(p.get('status','').replace('appstore','App Store').replace('testflight','TestFlight').replace('hub','Hub app').replace('soon','Coming soon')) + '</span>') if p.get('status') else ''}</h1>
<p class="lead">{E(pitch)}</p>
<div class="btns"><a class="btn primary" href="{E(url)}">Open {E(name)}</a><a class="btn" href="/docs.html">Project docs</a></div>
{('<h2>What it does</h2><p>' + E(blurb) + '</p>') if blurb else ''}{('<ul>' + ''.join(f'<li>{E(f)}</li>' for f in feats) + '</ul>') if feats else ''}
{('<h2>Screens</h2><div class="gallery">' + gallery + '</div>') if gallery else '<p class="d">No screenshots captured yet.</p>'}
<footer>AiQ Manage · <a href="mailto:support@aiqmanage.com">support@aiqmanage.com</a> · members only</footer></div></body></html>'''
    open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(page)
    cards.append(f'<a class="app" href="{E(slug)}/" data-h="{E((name + " " + pitch).lower())}"><div class="t">{E(name)}</div><div class="d">{E(pitch)}</div>{("<img src=\"" + E(slug) + "/phone.webp\" alt=\"\" loading=\"lazy\">") if shots else ""}</a>')
open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(f'''<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="robots" content="noindex"><title>AiQ projects</title><style>{CSS}</style></head><body><div class="wrap">
<header class="top">{MARK}<div class="brand">Ai<b>Q</b> projects</div><a class="home" href="/home.html">Apps</a></header>
<h1>Project catalog</h1><p class="lead">{len(apps)} apps on the AiQ hub, with screens. Members only.</p>
<div class="filter"><input id="q" type="search" placeholder="Filter projects" autocomplete="off"></div>
<div class="grid" id="grid">{''.join(cards)}</div>
<footer>AiQ Manage · <a href="mailto:support@aiqmanage.com">support@aiqmanage.com</a></footer></div>
<script>document.getElementById('q').addEventListener('input',e=>{{const q=e.target.value.trim().toLowerCase();document.querySelectorAll('#grid .app').forEach(a=>a.style.display=!q||a.dataset.h.includes(q)?'':'none');}});</script></body></html>''')
print('catalog:', len(apps), 'pages ->', OUT)
