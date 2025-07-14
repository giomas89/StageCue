
'use client';

import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Volume1,
  VolumeX,
  Shuffle,
  Repeat,
  Repeat1,
  FastForward,
  Rewind,
  Music,
  Square,
} from 'lucide-react';
import { useSoundCue } from '@/hooks/useSoundCue';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const formatTime = (seconds: number) => {
  if (isNaN(seconds)) return '00:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(
    2,
    '0'
  )}`;
};

export default function Player() {
  const {
    currentTrack,
    isPlaying,
    isFading,
    fadeCountdown,
    togglePlayPause,
    playNext,
    playPrev,
    stopPlayback,
    progress,
    duration,
    seek,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    repeatMode,
    setRepeatMode,
    isShuffled,
    toggleShuffle,
    skipForward,
    skipBackward,
    audioSettings,
  } = useSoundCue();

  const VolumeIcon = isMuted ? VolumeX : volume > 0.5 ? Volume2 : volume > 0 ? Volume1 : VolumeX;

  const handleProgressChange = (value: number[]) => {
    seek(value[0]);
  };
  
  const handleVolumeChange = (value: number[]) => {
    let newVolume = value[0] / 100;
    if (audioSettings.maxVolume.enabled) {
      newVolume = Math.min(newVolume, audioSettings.maxVolume.level / 100);
    }
    setVolume(newVolume);
  };

  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;
  
  const maxVolume = audioSettings.maxVolume.enabled ? audioSettings.maxVolume.level : 100;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-4">
        <div className="bg-card border rounded-lg w-24 h-24 flex items-center justify-center shrink-0">
          <Music className="w-12 h-12 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold truncate">{currentTrack?.name || 'No track selected'}</h2>
          <p className="text-sm text-muted-foreground truncate">{currentTrack?.file.type || '---'}</p>
        </div>
      </div>
      
      <div className="flex flex-col gap-2">
        <Slider
            value={[progress]}
            max={100}
            step={0.1}
            onValueChange={handleProgressChange}
            disabled={!currentTrack}
            className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime((progress / 100) * duration)}</span>
            <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={toggleShuffle} className={cn(isShuffled && 'text-primary')}>
                      <Shuffle className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Shuffle</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setRepeatMode(prev => prev === 'none' ? 'all' : prev === 'all' ? 'one' : 'none')} className={cn(repeatMode !== 'none' && 'text-primary')}>
                      <RepeatIcon className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Repeat Mode: {repeatMode}</p>
                </TooltipContent>
              </Tooltip>
             </TooltipProvider>
          </div>

          <div className="flex items-center gap-2">
              <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={playPrev} disabled={!currentTrack}>
                      <SkipBack className="w-6 h-6" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Previous (←)</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={skipBackward} disabled={!currentTrack}>
                      <Rewind className="w-6 h-6" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Back 10s (J)</p></TooltipContent>
              </Tooltip>
              
              <Button size="lg" className="rounded-full w-16 h-16 bg-primary hover:bg-primary/90 text-2xl font-bold" onClick={togglePlayPause} disabled={!currentTrack || isFading}>
                  {isFading && fadeCountdown !== null ? (
                    <span>{Math.round(fadeCountdown)}</span>
                  ) : isPlaying ? (
                    <Pause className="w-8 h-8 fill-primary-foreground" />
                  ) : (
                    <Play className="w-8 h-8 fill-primary-foreground" />
                  )}
              </Button>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => stopPlayback()} disabled={!currentTrack}>
                      <Square className="w-6 h-6" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Stop (S)</p></TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={skipForward} disabled={!currentTrack}>
                      <FastForward className="w-6 h-6" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Forward 10s (L)</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={playNext} disabled={!currentTrack}>
                      <SkipForward className="w-6 h-6" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Next (→)</p></TooltipContent>
              </Tooltip>
             </TooltipProvider>
          </div>

          <div className="flex items-center gap-2 w-[150px]">
            <Button variant="ghost" size="icon" onClick={toggleMute}>
              <VolumeIcon className="w-5 h-5" />
            </Button>
            <Slider
              value={[isMuted ? 0 : volume * 100]}
              max={maxVolume}
              step={1}
              onValueChange={handleVolumeChange}
              className="w-full"
              disabled={!currentTrack}
            />
          </div>
      </div>
    </div>
  );
}

    