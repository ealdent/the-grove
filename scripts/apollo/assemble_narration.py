"""Place measured ElevenLabs takes on the film timeline, without changing pace.

Usage: python3 scripts/apollo/assemble_narration.py /path/to/takes
The directory contains cover.mp3, state.mp3, injection.mp3, intercept.mp3,
encounter.mp3, and correction.mp3, generated from narration.json.
Requires Python 3 and ffmpeg/ffprobe. No network or paid generation occurs here.
"""
from pathlib import Path
import argparse
import json
import re
import subprocess
import tempfile
import textwrap


def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True)


def timestamp(seconds):
    milliseconds = round(seconds * 1000)
    minutes, remainder = divmod(milliseconds, 60000)
    seconds, milliseconds = divmod(remainder, 1000)
    return f"00:{minutes:02}:{seconds:02}.{milliseconds:03}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("takes", type=Path)
    args = parser.parse_args()
    source = Path(__file__).resolve().parent
    assets = source.parents[1] / "learn" / "apollo-assets"
    manifest = json.loads((source / "narration.json").read_text())
    duration = manifest["duration"]
    inputs, filters, cues, timing = [], [], ["WEBVTT\n"], []
    previous_end = 0

    for i, chapter in enumerate(manifest["chapters"]):
        take = args.takes / f"{chapter['id']}.mp3"
        length = float(run("ffprobe", "-v", "error", "-show_entries", "format=duration",
                           "-of", "csv=p=0", str(take)).stdout)
        detection = run("ffmpeg", "-hide_banner", "-i", str(take), "-af",
                        "silencedetect=noise=-50dB:d=0.15", "-t", str(duration),
                        "-f", "null", "-").stderr
        # Remove only verified trailing silence, retaining a 100 ms tail.
        silences = re.findall(r"silence_start: ([\d.]+).*?silence_end: ([\d.]+)",
                              detection, re.S)
        if silences and abs(float(silences[-1][1]) - length) < .05:
            length = min(length, float(silences[-1][0]) + .1)
        start, limit = chapter["start"], chapter["end"]
        end = start + length
        if not (previous_end <= start < end <= limit <= duration):
            raise ValueError(f"{chapter['id']}: take ends at {end:.3f}s; window ends at {limit}s. "
                             "Rewrite and regenerate the take; do not truncate speech.")
        previous_end = end
        inputs += ["-i", str(take)]
        filters.append(f"[{i}:a]atrim=duration={length:.6f},asetpts=PTS-STARTPTS,"
                       f"adelay={round(start * 1000)}:all=1[a{i}]")
        cues.append(f"{timestamp(start)} --> {timestamp(end)}\n"
                    + "\n".join(textwrap.wrap(chapter["text"], width=68)) + "\n")
        timing.append({"chapter": chapter["id"], "start": start, "end": round(end, 3),
                       "speech_file_seconds": round(length, 3)})

    filters.append("".join(f"[a{i}]" for i in range(len(timing)))
                   + f"amix=inputs={len(timing)}:normalize=0,apad=whole_dur={duration},"
                   f"atrim=duration={duration},loudnorm=I=-16:TP=-1.5:LRA=11[out]")
    with tempfile.TemporaryDirectory(prefix="apollo-narration-") as work:
        master = Path(work) / "apollo-narration.flac"
        run("ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *inputs,
            "-filter_complex", ";".join(filters), "-map", "[out]", "-ar", "44100",
            "-ac", "1", "-sample_fmt", "s16", "-c:a", "flac", "-t", str(duration),
            "-fs", "15000000", str(master))
        measured = float(run("ffprobe", "-v", "error", "-show_entries", "format=duration",
                             "-of", "csv=p=0", str(master)).stdout)
        if abs(measured - duration) > .01:
            raise ValueError(f"Unexpected audio master duration: {measured}")
        (assets / "apollo-narration.flac").write_bytes(master.read_bytes())
    (assets / "apollo-flight-plan.vtt").write_text("\n".join(cues))
    print(json.dumps(timing, indent=2))


if __name__ == "__main__":
    main()
