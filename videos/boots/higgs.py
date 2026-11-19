#!/usr/bin/env python3
"""Submit Higgsfield jobs from a spec JSON, poll them, download the results (adapted from the Save Me a Seat driver).

    python3 higgs.py SPECS.json OUT_DIR [--only key,key] [--limit N]

SPECS.json: {key: {"prompt": str, "model": "nano_banana_2", "args": ["--aspect_ratio","16:9",...]}}
A spec may also carry "start": a local image path, passed as --start-image (image-to-video).
Run with the command sandbox off (the CLI's TLS and the CloudFront download both fail inside it).
Re-runnable: OUT_DIR/jobs.json records every submission, so a finished or pending key is never paid for twice.
Jobs are submitted without --wait, because --wait can time out while the job keeps running.
"""
import json
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path

CLI = '/Users/jason/.hermes/node/bin/higgsfield'
DEFAULT_ARGS = ['--aspect_ratio', '16:9', '--resolution', '2k']


def run(args, tries=1):
    for k in range(tries):
        r = subprocess.run([CLI, *args, '--json'], capture_output=True, text=True, timeout=300)
        if r.returncode == 0:
            return json.loads(r.stdout)
        err = r.stderr.strip() or r.stdout.strip()
        if k + 1 < tries and ('HTTP 5' in err or 'no response' in err):
            time.sleep(5 * (k + 1))
            continue
        raise RuntimeError(f'{args[:3]}: {err}')


def result_url(job):
    for k in ('result_url', 'min_result_url'):
        if isinstance(job.get(k), str) and job[k].startswith('http'):
            return job[k]
    for r in job.get('results') or job.get('result') or []:
        if isinstance(r, dict) and str(r.get('url', '')).startswith('http'):
            return r['url']
    return None


def main():
    specs = json.loads(Path(sys.argv[1]).read_text())
    out = Path(sys.argv[2])
    only = None
    limit = 10 ** 6
    for i, a in enumerate(sys.argv):
        if a == '--only':
            only = set(sys.argv[i + 1].split(','))
        if a == '--limit':
            limit = int(sys.argv[i + 1])
    out.mkdir(parents=True, exist_ok=True)
    jobs_p = out / 'jobs.json'
    jobs = json.loads(jobs_p.read_text()) if jobs_p.exists() else {}
    save = lambda: jobs_p.write_text(json.dumps(jobs, indent=1))
    keys = [k for k in specs if (only is None or k in only)]
    new = 0
    for key in keys:
        if key in jobs and jobs[key]['status'] != 'failed':
            continue
        if new >= limit:
            break
        spec = specs[key]
        args = ['generate', 'create', spec.get('model', 'nano_banana_2'), '--prompt', spec['prompt'], *spec.get('args', DEFAULT_ARGS)]
        if spec.get('start'):
            args += ['--start-image', spec['start']]
        try:
            ids = run(args, tries=3)
        except RuntimeError as e:
            print(key, 'SUBMIT FAILED', str(e)[:300], flush=True)
            continue
        jobs[key] = {'id': ids[0] if isinstance(ids, list) else ids.get('id'), 'status': 'submitted'}
        new += 1
        print(key, 'submitted', flush=True)
        save()

    deadline = time.time() + 2400
    pending = lambda: [k for k in keys if k in jobs and jobs[k]['status'] not in ('completed', 'failed')]
    while time.time() < deadline and pending():
        time.sleep(10)
        for key in pending():
            j = jobs[key]
            try:
                g = run(['generate', 'get', j['id']], tries=3)
            except RuntimeError as e:
                print(key, 'poll error', str(e)[:120], flush=True)
                continue
            st = str(g.get('status', '')).lower()
            if st in ('completed', 'succeeded', 'success', 'done'):
                url = result_url(g)
                if not url:
                    continue
                ext = Path(urllib.parse.urlparse(url).path).suffix or '.png'
                dst = out / f'{key}{ext}'
                subprocess.run(['curl', '-sSL', '--retry', '3', '--max-time', '300', '--max-filesize', '200000000', '-o', str(dst), url], check=True)
                j.update(status='completed', url=url, file=dst.name)
                save()
                print(key, 'done', flush=True)
            elif st in ('failed', 'error', 'cancelled', 'canceled', 'nsfw'):
                j.update(status='failed', detail=str(g)[:400])
                save()
                print(key, 'FAILED', st, str(g)[:200], flush=True)
    left = pending()
    print('completed', sum(1 for k in keys if jobs.get(k, {}).get('status') == 'completed'), 'failed', [k for k in keys if jobs.get(k, {}).get('status') == 'failed'], 'pending', left)


if __name__ == '__main__':
    main()
