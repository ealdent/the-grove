"""Pack out/*.png textures, models/*.json and the key art into the <script id="nv-assets"> blob of ../neverstill.html."""
import json, base64, glob, os, re, sys
A = os.path.dirname(os.path.abspath(__file__))
HTML = os.path.join(A, '..', 'neverstill.html')
def uri(path, mime='image/png'):
    return 'data:%s;base64,%s' % (mime, base64.b64encode(open(path, 'rb').read()).decode())
blob = {'keyart': open(A + '/keyart_datauri.txt').read().strip() if os.path.exists(A + '/keyart_datauri.txt') else '', 'tex': {}, 'mdl': {}}
for f in sorted(glob.glob(A + '/out/*.png')):
    blob['tex'][os.path.basename(f)[:-4]] = uri(f)
mdir = A + '/models'
if os.path.isdir(mdir):
    for f in sorted(glob.glob(mdir + '/*.json')):
        rec = json.load(open(f))
        blob['mdl'][os.path.basename(f)[:-5]] = rec
s = open(HTML).read()
data = json.dumps(blob, separators=(',', ':'))
new, n = re.subn(r'(<script type="application/json" id="nv-assets">)(.*?)(</script>)', lambda m: m.group(1) + data + m.group(3), s, count=1, flags=re.S)
assert n == 1
open(HTML, 'w').write(new)
print('blob bytes', len(data), 'tex', len(blob['tex']), 'models', len(blob['mdl']), 'html bytes', len(new))
