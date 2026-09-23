#!/bin/bash
# Announcer lines in the game's style (macOS `say`, Daniel, pitched down). Needs the command sandbox off.
set -e
cd "$(dirname "$0")"; mkdir -p vox
say -v Daniel -r 150 -o vox/warn_raw.aiff "Warning. A huge enemy is approaching."
say -v Daniel -r 160 -o vox/clear_raw.aiff "Stage clear!"
for f in warn clear; do
  ffmpeg -hide_banner -loglevel error -y -i vox/${f}_raw.aiff -ac 2 -af "aresample=48000,asetrate=48000*0.84,aresample=48000,atempo=1.08,highpass=f=120,lowpass=f=6500,acompressor=threshold=-18dB:ratio=3:attack=5:release=80,aecho=0.8:0.5:60|110:0.25|0.15,volume=1.4" vox/${f}.wav
done
