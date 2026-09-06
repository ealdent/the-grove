#!/usr/bin/env python3
"""Build redesign/manifest.json from the section index pages plus git history.

Every section index wraps each work in an <a> carrying data-provider /
data-model / data-effort (the benchmark sections) or per-card classes (the
workshop sections). This reads those anchors, resolves the file each one
points at, and asks git when that file first appeared. Run from the repo root.
"""
import hashlib, html, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

# folder -> (display name, family, tagline)
SECTIONS = {
    'tower-def':   ('Tower Defense', 'benchmark', 'Same tower-defense brief, handed to every frontier model'),
    'svg-forest':  ('SVG Forest',    'benchmark', 'Same first-person pure-SVG world brief, model by model'),
    'time-loop':   ('Time Loop',     'benchmark', 'Same impossible shift beside your own past selves'),
    'rail-shooter':('Rail Shooter',  'benchmark', 'Same on-rails flight brief, one sortie per model'),
    'arcade':      ('Arcade',        'workshop',  'Interactive games & simulations'),
    'learn':       ('Learn',         'workshop',  'Tutorials, trainers & explainers'),
    'utils':       ('Utils',         'workshop',  'Type, infographics, visualizers & data tools'),
    'shaders':     ('Shaders',       'workshop',  'Fragment-shader experiments, computed live'),
    'depths':      ('Depths',        'workshop',  'Spinners, trackers & curiosities'),
}
APPS = [  # entry points that have no card of their own
    dict(section='greenhouse-todo', href='index.html', title='Greenhouse To-Do',
         desc='Cultivate your tasks in a WebGL greenhouse. Completed items bloom into flowers; neglected ones wilt on a half-life.',
         tag='app', provider='', model='', effort=''),
    dict(section='vector-defense', href='vector-defense.html', title='Vector Defense',
         desc='Retro tactical missile command with terrain mechanics and a CRT military aesthetic.',
         tag='game', provider='', model='', effort=''),
]
SECTIONS['greenhouse-todo'] = ('Greenhouse To-Do', 'workshop', 'A to-do list grown in a WebGL greenhouse')
SECTIONS['vector-defense']  = ('Vector Defense',   'workshop', 'Retro missile command with terrain mechanics')

PROVIDERS = {
    'anthropic': 'Anthropic', 'openai': 'OpenAI', 'google': 'Google', 'xai': 'xAI',
    'deepseek': 'DeepSeek', 'zai': 'Zhipu (GLM)', 'moonshot': 'Moonshot (Kimi)',
    'alibaba': 'Alibaba (Qwen)', 'sakana': 'Sakana', 'meta': 'Meta', 'other': 'Unattributed', '': '',
}

ANCHOR = re.compile(r'<a\s([^>]*?)href="([^"]+)"([^>]*)>(.*?)</a>', re.S)
def attr(s, name):
    m = re.search(r'\b%s="([^"]*)"' % re.escape(name), s)
    return html.unescape(m.group(1)).strip() if m else ''
def text_of(inner, cls_pat=None, tag_pat=None):
    if cls_pat:
        m = re.search(r'<(\w+)[^>]*class="[^"]*\b(?:%s)\b[^"]*"[^>]*>(.*?)</\1>' % cls_pat, inner, re.S)
    else:
        m = re.search(r'<(%s)\b[^>]*>(.*?)</\1>' % tag_pat, inner, re.S)
    if not m: return ''
    t = re.sub(r'<[^>]+>', '', m.group(2))
    return re.sub(r'\s+', ' ', html.unescape(t)).strip()

def first_added(path):
    try:
        out = subprocess.run(['git', 'log', '--diff-filter=A', '--follow', '--format=%as', '--', path],
                             capture_output=True, text=True, check=True).stdout.split()
        return out[-1] if out else ''
    except subprocess.CalledProcessError:
        return ''

works = []
for folder, (name, family, tagline) in SECTIONS.items():
    idx = os.path.join(folder, 'index.html')
    if not os.path.exists(idx): continue
    src = open(idx, encoding='utf-8').read()
    for m in ANCHOR.finditer(src):
        pre, href, post, inner = m.groups()
        if href.startswith(('../', 'http', '#', 'mailto')) or href in ('index.html', './'):
            continue
        attrs = pre + ' ' + post
        title = text_of(inner, cls_pat=r'[\w-]*title[\w-]*') or text_of(inner, tag_pat='h2|h3')
        if not title or title.lower() in ('play now', 'launch'):
            continue
        desc = text_of(inner, cls_pat=r'[\w-]*desc[\w-]*') or text_of(inner, tag_pat='p')
        works.append(dict(
            section=folder, href=href, title=title, desc=desc,
            subtitle=text_of(inner, cls_pat=r'badge-ribbon'),
            tag=text_of(inner, cls_pat=r'card-tag|tile-tag|exp-meta'),
            provider=attr(attrs, 'data-provider').lower(),
            model=attr(attrs, 'data-model') or text_of(inner, cls_pat=r'model-name|tile-model'),
            effort=(attr(attrs, 'data-effort') or text_of(inner, cls_pat=r'model-effort|effort')).lower(),
        ))
works += APPS

FAMILY = [('fable','anthropic'),('opus','anthropic'),('sonnet','anthropic'),('claude','anthropic'),
          ('gpt','openai'),('gemini','google'),('grok','xai'),('glm','zai'),('kimi','moonshot'),
          ('qwen','alibaba'),('fugu','sakana'),('deepseek','deepseek'),('muse spark','meta')]
for w in works:
    m = w['model']
    if '·' in m:
        m, eff = [x.strip() for x in m.split('·', 1)]
        w['effort'] = w['effort'] or eff.lower()
    m = re.sub(r'^claude\s+', '', m, flags=re.I)
    if m.lower() == 'fugu ultra high':
        m, w['effort'] = 'Fugu', 'ultra high'
    w['model'] = m
    if w['provider'] in ('', 'other'):
        for needle, prov in FAMILY:
            if m.lower().startswith(needle):
                w['provider'] = prov
                break

# resolve paths, dedupe duplicates that are listed in two sections (arcade re-lists rail-shooter pieces)
order = list(SECTIONS)  # benchmark sections come first, so they win the dedupe
seen = {}
for w in works:
    path = os.path.normpath(os.path.join(w['section'], w['href']))
    if w['href'].endswith('/'): path = os.path.join(path, 'index.html')
    w['path'] = path
    try:
        key = hashlib.md5(open(path, 'rb').read()).hexdigest()
    except OSError:
        key = re.sub(r'\W+', '', w['title'].lower())
    if key in seen:
        seen[key].setdefault('also_in', []).append(w['section'])
        w['_dup'] = True
    else:
        seen[key] = w
works = [w for w in works if not w.get('_dup')]

for w in works:
    w['added'] = first_added(w['path'])
    w['family'] = SECTIONS[w['section']][1]
    w['provider_name'] = PROVIDERS.get(w['provider'], w['provider'].title())
    w['id'] = re.sub(r'[^a-z0-9]+', '-', (w['section'] + '-' + w['title']).lower()).strip('-')
    try:
        w['bytes'] = os.path.getsize(w['path'])
    except OSError:
        w['bytes'] = 0

works.sort(key=lambda w: (order.index(w['section']), w['provider_name'], w['model'], w['title']))

manifest = dict(
    site='The Grove',
    generated=subprocess.run(['git', 'log', '-1', '--format=%as'], capture_output=True, text=True).stdout.strip(),
    commits=int(subprocess.run(['git', 'rev-list', '--count', 'HEAD'], capture_output=True, text=True).stdout),
    sections=[dict(key=k, name=v[0], family=v[1], tagline=v[2],
                   count=sum(1 for w in works if w['section'] == k)) for k, v in SECTIONS.items()],
    providers=PROVIDERS,
    works=works,
)
out = os.path.join(ROOT, 'redesign', 'manifest.json')
json.dump(manifest, open(out, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(f"{len(works)} works -> {out}")
for s in manifest['sections']:
    print(f"  {s['count']:3d}  {s['name']}")
missing = [w['path'] for w in works if not os.path.exists(w['path'])]
if missing: print("MISSING FILES:", *missing, sep='\n  ')
nodate = [w['title'] for w in works if not w['added']]
if nodate: print("NO DATE:", *nodate, sep='\n  ')
