#!/bin/sh
# usage: mixaudio.sh FILM_LENGTH_SECONDS : the narrator over the music -> mus/mix.wav
# (voice/narration.wav: every page laid at the second its page begins; mus/b.mp3: the score, take B)
S=/tmp/claude-0/-home-user-game/9db9e6f7-f322-58a8-a673-ecffb8a05976/scratchpad/gem
L=$1; T=$(python3 -c "print(round(129.85/($L-2.0),4))")
# the score is drawn out to the film's new length (tempo only, the pitch stays), and fades away under the last card
ffmpeg -v error -y -i $S/mus/b.mp3 -af "rubberband=tempo=$T:pitchq=quality,apad=whole_dur=$L,atrim=0:$L,afade=t=in:st=0:d=1.5,afade=t=out:st=$(python3 -c "print($L-4.8)"):d=4.5" -ar 48000 -c:a pcm_s16le $S/mus/b_long.wav
# the voice a little evened and lifted; the music sinks about 10 dB while she speaks and comes back in the gaps
ffmpeg -v error -y -i $S/voice/narration.wav -i $S/mus/b_long.wav -filter_complex "[0:a]highpass=f=70,acompressor=threshold=-28dB:ratio=2.5:attack=15:release=250:makeup=6dB,volume=6dB,aformat=channel_layouts=stereo,asplit=2[v][vk];[1:a]volume=-9dB[m0];[m0][vk]sidechaincompress=threshold=0.015:ratio=3:attack=250:release=1200[m];[v][m]amix=inputs=2:normalize=0,volume=2dB,alimiter=limit=0.89[out]" -map "[out]" -ar 48000 -c:a pcm_s16le $S/mus/mix.wav
