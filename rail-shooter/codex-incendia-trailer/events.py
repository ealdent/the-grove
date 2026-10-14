# Print the notable sfx events of each take (frame numbers), to place in-points so hits land on beats.
import json, os, sys
skip = {'sfxShoot', 'sfxRicochet'}
for f in sorted(os.listdir('logs')):
    name = f[:-5]
    if len(sys.argv) > 1 and name not in sys.argv[1:]: continue
    L = json.load(open('logs/' + f))
    ev = [f"{round(t * 60)}:{k[3:]}{'!' if a and a[0] is True else ''}" for t, k, a in L['sfx'] if k not in skip]
    print(f"{name:10s} {L['frames']:4d}  " + ' '.join(ev))
