#!/usr/bin/env python3
"""Render the Signal edit from local clips and the original mix; see README.md."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from fractions import Fraction
from pathlib import Path


HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
MAX_SLOWDOWN = Decimal("1.25")
MAX_SPEEDUP = Decimal("1.15")


class RenderError(Exception):
    pass


@dataclass(frozen=True)
class Shot:
    index: int
    source: Path
    source_in: Decimal
    start_frame: int
    frames: int
    source_seconds: Decimal
    used_seconds: Decimal
    stretch: Decimal


def run(command: list[str]) -> str:
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode:
        message = result.stderr.strip() or result.stdout.strip() or "no diagnostic output"
        raise RenderError(f"{Path(command[0]).name} failed: {message}")
    return result.stdout


def probe(path: Path, *, count_frames: bool = False) -> dict:
    command = ["ffprobe", "-v", "error"]
    if count_frames:
        command.append("-count_frames")
    command += ["-show_streams", "-show_format", "-of", "json", str(path)]
    try:
        return json.loads(run(command))
    except json.JSONDecodeError as exc:
        raise RenderError(f"ffprobe returned invalid JSON for {path}") from exc


def stream_duration(data: dict, kind: str, path: Path) -> Decimal:
    streams = [item for item in data.get("streams", []) if item.get("codec_type") == kind]
    if not streams:
        raise RenderError(f"No {kind} stream in {path}")
    value = streams[0].get("duration") or data.get("format", {}).get("duration")
    try:
        seconds = Decimal(str(value))
        if not seconds.is_finite() or seconds <= 0:
            raise ValueError
        return seconds
    except (ValueError, ArithmeticError):
        raise RenderError(f"Cannot determine {kind} duration for {path}") from None


def frame_at(seconds: object, fps: int) -> int:
    try:
        value = Decimal(str(seconds))
        if not value.is_finite() or value < 0:
            raise ValueError
        return int((value * fps).to_integral_value(rounding=ROUND_HALF_UP))
    except (ValueError, ArithmeticError):
        raise RenderError(f"Invalid timestamp: {seconds!r}") from None


def read_edit(path: Path, clips_dir: Path) -> tuple[int, int, int, list[Shot]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RenderError(f"Cannot read edit {path}: {exc}") from exc
    try:
        fps, width, height = (int(data[key]) for key in ("fps", "width", "height"))
        entries = data["shots"]
    except (KeyError, TypeError, ValueError) as exc:
        raise RenderError("Edit needs integer fps, width and height, plus a shots list") from exc
    if fps <= 0 or width <= 0 or height <= 0 or width % 2 or height % 2:
        raise RenderError("FPS and dimensions must be positive; dimensions must be even")
    if not isinstance(entries, list) or not entries:
        raise RenderError("The edit must contain at least one shot")

    planned: list[tuple[int, Path, Decimal, int, int]] = []
    next_frame = 0
    for index, entry in enumerate(entries, 1):
        try:
            clip = entry["clip"]
            start = frame_at(entry["start"], fps)
            end = frame_at(entry["end"], fps)
        except (KeyError, TypeError) as exc:
            raise RenderError(f"Shot {index} needs clip, start and end") from exc
        if not isinstance(clip, str) or Path(clip).name != clip:
            raise RenderError(f"Shot {index} clip must be a filename in the clips directory")
        try:
            source_in = Decimal(str(entry.get("source_in", 0)))
            if not source_in.is_finite() or source_in < 0:
                raise ValueError
        except (ValueError, ArithmeticError):
            raise RenderError(f"Shot {index} source_in must be a finite nonnegative number of seconds") from None
        if start != next_frame or end <= start:
            raise RenderError(f"Shot {index} is not contiguous or has no frames")
        source = clips_dir / clip
        if not source.is_file():
            raise RenderError(f"Missing shot {index}: {source}")
        planned.append((index, source, source_in, start, end - start))
        next_frame = end

    shots: list[Shot] = []
    for index, source, source_in, start, frames in planned:
        duration = stream_duration(probe(source), "video", source)
        if source_in >= duration:
            raise RenderError(
                f"Shot {index} source_in {source_in:.3f}s is outside its {duration:.3f}s source"
            )
        available = duration - source_in
        target = Decimal(frames) / fps
        # Keep the speed-up gentle. Very short windows use only part of the
        # available source instead of rushing through it.
        used = min(available, target * MAX_SPEEDUP)
        stretch = target / used
        if stretch > MAX_SLOWDOWN:
            needed = target / MAX_SLOWDOWN
            raise RenderError(
                f"Shot {index} has {available:.3f}s remaining after source_in {source_in:.3f}s, "
                f"too short for its {target:.3f}s window; provide at least {needed:.3f}s after the offset"
            )
        shots.append(Shot(index, source, source_in, start, frames, duration, used, stretch))
    return fps, width, height, shots


def render_shot(shot: Shot, fps: int, width: int, height: int, directory: Path, preset: str, crf: int) -> Path:
    output = directory / f"shot-{shot.index:02d}.mp4"
    filters = (
        f"trim=start={shot.source_in:.9f}:duration={shot.used_seconds:.9f},"
        f"setpts=(PTS-STARTPTS)*{shot.stretch:.12f},"
        f"fps={fps}:round=near:start_time=0,"
        f"scale={width}:{height}:force_original_aspect_ratio=increase:"
        "flags=lanczos:out_color_matrix=bt709,"
        f"crop={width}:{height},setsar=1,format=yuv420p,"
        "setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709,"
        # A few cloned frames prevent rounding loss at the source endpoint;
        # -frames:v below stops at the exact lyric-aligned boundary.
        "tpad=stop_mode=clone:stop_duration=0.125"
    )
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(shot.source),
        "-map", "0:v:0", "-an", "-vf", filters, "-frames:v", str(shot.frames),
        "-c:v", "libx264", "-preset", preset, "-crf", str(crf), "-threads", "4",
        "-pix_fmt", "yuv420p", "-bf", "0", "-g", str(fps * 2),
        "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
        "-video_track_timescale", str(fps * 1000), "-movie_timescale", str(fps * 1000),
        str(output),
    ]
    run(command)
    return output


def concat_quote(path: Path) -> str:
    # ffconcat quoting is not shell quoting. Backslashes and apostrophes must
    # be escaped, including when the workspace path itself contains spaces.
    return "'" + str(path).replace("\\", "\\\\").replace("'", "'\\''") + "'"


def verify(output: Path, fps: int, width: int, height: int, frames: int) -> None:
    data = probe(output, count_frames=True)
    streams = data.get("streams", [])
    video = next((item for item in streams if item.get("codec_type") == "video"), None)
    audio = next((item for item in streams if item.get("codec_type") == "audio"), None)
    try:
        valid_video = (
            video is not None
            and video.get("codec_name") == "h264"
            and int(video["width"]) == width
            and int(video["height"]) == height
            and int(video["nb_read_frames"]) == frames
            and Fraction(video["avg_frame_rate"]) == fps
            and video.get("color_space") == "bt709"
            and video.get("color_transfer") == "bt709"
            and video.get("color_primaries") == "bt709"
        )
    except (KeyError, ValueError, ZeroDivisionError):
        valid_video = False
    audio_duration = stream_duration(data, "audio", output) if audio else Decimal(0)
    expected_duration = Decimal(frames) / fps
    valid_audio = (
        audio is not None
        and audio.get("codec_name") == "aac"
        and abs(audio_duration - expected_duration) <= Decimal(1) / fps
    )
    if not valid_video or not valid_audio:
        observed = {key: video.get(key) for key in (
            "codec_name", "width", "height", "nb_read_frames", "avg_frame_rate",
            "color_space", "color_transfer", "color_primaries",
        )} if video else None
        raise RenderError(
            f"Rendered file failed verification: video={observed}, "
            f"audio_codec={audio.get('codec_name') if audio else None}, audio_duration={audio_duration}; "
            f"expected {frames} frames at {fps} fps and {width}x{height} in BT.709"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--edit", type=Path, default=HERE / "edit.json")
    parser.add_argument("--clips", type=Path, default=HERE / "source" / "clips")
    parser.add_argument("--audio", type=Path, default=REPO / "tmp" / "save-me-a-seat" / "song" / "mix_vm.wav")
    parser.add_argument("--output", type=Path, default=HERE / "media" / "signal.mp4")
    parser.add_argument("--jobs", type=int, default=2, help="parallel clip encodes (default: 2)")
    parser.add_argument("--preset", default="medium", help="libx264 preset (default: medium)")
    parser.add_argument("--crf", type=int, default=19, help="x264 quality, 0-51 (default: 19; higher is smaller)")
    parser.add_argument("--overwrite", action="store_true", help="replace an existing output after successful verification")
    args = parser.parse_args()
    try:
        if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
            raise RenderError("ffmpeg and ffprobe must both be on PATH")
        if args.jobs < 1:
            raise RenderError("--jobs must be at least 1")
        if not 0 <= args.crf <= 51:
            raise RenderError("--crf must be between 0 and 51")
        output = args.output.resolve()
        if output.exists() and not args.overwrite:
            raise RenderError(f"Output already exists: {output}; use --overwrite to replace it")
        fps, width, height, shots = read_edit(args.edit.resolve(), args.clips.resolve())
        audio = args.audio.resolve()
        if not audio.is_file():
            raise RenderError(f"Missing mix: {audio}")
        total_frames = shots[-1].start_frame + shots[-1].frames
        duration = Decimal(total_frames) / fps
        audio_duration = stream_duration(probe(audio), "audio", audio)
        # Do not silently truncate a longer mix or pad an incomplete one.
        if audio_duration > duration:
            raise RenderError(f"Mix is {audio_duration}s, longer than the {duration}s picture")
        if duration - audio_duration > Decimal(1) / fps:
            raise RenderError(f"Mix is {audio_duration}s, more than one frame shorter than the {duration}s picture")
        print(f"Rendering {len(shots)} shots, {total_frames} frames at {fps} fps; mix {audio_duration}s.", flush=True)
        if audio_duration < duration:
            print(f"Padding the audio tail by {duration - audio_duration:.6f}s.", flush=True)

        output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="signal-render-", dir=output.parent) as temp:
            work = Path(temp)
            results: dict[int, Path] = {}
            with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as executor:
                futures = {
                    executor.submit(render_shot, shot, fps, width, height, work, args.preset, args.crf): shot
                    for shot in shots
                }
                for future in concurrent.futures.as_completed(futures):
                    shot = futures[future]
                    results[shot.index] = future.result()
                    print(f"Shot {shot.index:02d}: {shot.frames} frames, source speed {1 / shot.stretch:.3f}x.", flush=True)

            manifest = work / "concat.ffconcat"
            with manifest.open("w", encoding="utf-8", newline="\n") as handle:
                handle.write("ffconcat version 1.0\n")
                for shot in shots:
                    handle.write(f"file {concat_quote(results[shot.index])}\n")
                    handle.write(f"duration {Decimal(shot.frames) / fps:.9f}\n")
            candidate = work / "signal.mp4"
            command = [
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-f", "concat", "-safe", "0", "-i", str(manifest), "-i", str(audio),
                "-map", "0:v:0", "-map", "1:a:0", "-map_metadata", "-1",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
                "-af", f"apad=whole_dur={duration:.9f},atrim=duration={duration:.9f},asetpts=PTS-STARTPTS",
                "-t", f"{duration:.9f}", "-movflags", "+faststart",
                "-video_track_timescale", str(fps * 1000), "-movie_timescale", str(fps * 1000),
                str(candidate),
            ]
            run(command)
            verify(candidate, fps, width, height, total_frames)
            if args.overwrite:
                os.replace(candidate, output)
            else:
                # Creating the link fails atomically if another process has
                # created the output since the initial existence check.
                os.link(candidate, output)
                candidate.unlink()
        print(f"Verified and saved: {output}", flush=True)
        return 0
    except (RenderError, OSError) as exc:
        print(f"Render failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
