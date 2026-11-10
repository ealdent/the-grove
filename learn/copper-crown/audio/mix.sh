#!/bin/sh
# Lay the nine narration clips on the 60-second timeline and mux them with the
# silent render. Run from the repository root. Starts are in milliseconds and
# match the caption track in ../assets/copper-crown-captions.vtt.
set -e
A=learn/copper-crown/audio
V=learn/copper-crown/assets
ffmpeg -loglevel error -y \
  -i $A/01-intro.mp3 -i $A/02-inner-crown.mp3 -i $A/03-outer-crown.mp3 \
  -i $A/04-riser-vent.mp3 -i $A/05-trim-coil.mp3 -i $A/06-carafe.mp3 \
  -i $A/07-first-harvest.mp3 -i $A/08-second-harvest.mp3 -i $A/09-closing.mp3 \
  -filter_complex "[0]adelay=700:all=1[a0];[1]adelay=10400:all=1[a1];[2]adelay=16300:all=1[a2];[3]adelay=22000:all=1[a3];[4]adelay=28600:all=1[a4];[5]adelay=36800:all=1[a5];[6]adelay=41300:all=1[a6];[7]adelay=47100:all=1[a7];[8]adelay=57000:all=1[a8];[a0][a1][a2][a3][a4][a5][a6][a7][a8]amix=inputs=9:normalize=0,apad=whole_dur=60,atrim=0:60[mix]" \
  -map '[mix]' -ar 44100 -ac 1 -c:a flac $A/copper-crown-narration.flac
ffmpeg -loglevel error -y -i $V/copper-crown-assembly-silent.mp4 -i $A/copper-crown-narration.flac \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -movflags +faststart -t 60 \
  $V/copper-crown-narrated.mp4
