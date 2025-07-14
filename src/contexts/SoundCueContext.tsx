"use client";

import React, {
  createContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import type { Track, Settings, RepeatMode } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface SoundCueContextType {
  queue: Track[];
  setQueue: React.Dispatch<React.SetStateAction<Track[]>>;
  currentTrackIndex: number | null;
  setCurrentTrackIndex: React.Dispatch<React.SetStateAction<number | null>>;
  currentTrack: Track | null;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  progress: number;
  duration: number;
  volume: number;
  setVolume: (vol: number) => void;
  isMuted: boolean;
  toggleMute: () => void;
  repeatMode: RepeatMode;
  setRepeatMode: React.Dispatch<React.SetStateAction<RepeatMode>>;
  isShuffled: boolean;
  toggleShuffle: () => void;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  playTrack: (index: number) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrev: () => void;
  stopPlayback: () => void;
  clearQueue: () => void;
  seek: (percentage: number) => void;
  skipForward: () => void;
  skipBackward: () => void;
  audioOutputs: MediaDeviceInfo[];
  selectedAudioOutputId: string | null;
  setAudioOutput: (deviceId: string) => void;
}

export const SoundCueContext = createContext<SoundCueContextType | undefined>(undefined);

const defaultSettings: Settings = {
    midi: {
      inputId: null,
      mappings: {
        togglePlayPause: 60, // C4
        playNext: 62, // D4
        playPrev: 59, // B3
        stopPlayback: 57, // A3
        skipForward: 64, // E4
        skipBackward: 55, // G3
      },
    },
    osc: { ip: '127.0.0.1', port: 9000 },
    audio: { outputId: 'default' }
};

export function SoundCueProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Track[]>([]);
  const [shuffledQueue, setShuffledQueue] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setInternalVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');
  const [isShuffled, setIsShuffled] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioOutputId, setSelectedAudioOutputId] = useState<string | null>('default');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();
  const playNextRef = useRef((_isTrackEnd: boolean) => {});

  const getAudioOutputs = useCallback(async () => {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            console.warn("Media devices API not available.");
            return;
        }
        await navigator.mediaDevices.getUserMedia({ audio: true }); // Request permission
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputs = devices.filter(device => device.kind === 'audiooutput');
        setAudioOutputs(outputs);
    } catch (err) {
        console.error("Error enumerating audio devices:", err);
        toast({ variant: "destructive", title: "Audio Permission", description: "Could not list audio devices. Please grant permission." });
    }
  }, [toast]);

  useEffect(() => {
    audioRef.current = new Audio();
    getAudioOutputs();
    
    const audio = audioRef.current;
    
    const handleTimeUpdate = () => {
      if (!audio) return;
      setProgress((audio.currentTime / audio.duration) * 100 || 0);
      setDuration(audio.duration || 0);
    };
    const handleEnded = () => playNextRef.current(true);
    const handleCanPlay = () => {
        if (!audio) return;
        setDuration(audio.duration || 0);
    }
    const handleError = () => {
        toast({
            variant: "destructive",
            title: "Playback Error",
            description: "Could not play the selected audio file."
        });
        setIsPlaying(false);
    }

    navigator.mediaDevices.addEventListener('devicechange', getAudioOutputs);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getAudioOutputs);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
    };
  }, [toast, getAudioOutputs]);

  useEffect(() => {
    if (isShuffled) {
      const shuffled = [...queue].sort(() => Math.random() - 0.5);
      setShuffledQueue(shuffled);
    } else {
      setShuffledQueue([]);
    }
  }, [isShuffled, queue]);

  const currentQueue = isShuffled ? shuffledQueue : queue;
  const currentTrack = currentTrackIndex !== null ? currentQueue[currentTrackIndex] : null;
  
  const setVolume = (vol: number) => {
    if (audioRef.current) {
        audioRef.current.volume = vol;
        setInternalVolume(vol);
        if(vol > 0 && isMuted) setIsMuted(false);
    }
  }

  const setAudioOutput = useCallback(async (deviceId: string) => {
    if (audioRef.current && 'setSinkId' in HTMLAudioElement.prototype) {
      try {
        await (audioRef.current as any).setSinkId(deviceId);
        setSelectedAudioOutputId(deviceId);
        setSettings(s => ({ ...s, audio: { ...s.audio, outputId: deviceId } }));
      } catch (error) {
        console.error("Error setting audio output:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not set audio output device.",
        });
      }
    } else {
        toast({
          variant: "destructive",
          title: "Feature Not Supported",
          description: "Your browser does not support changing audio output devices.",
        });
    }
  }, [toast]);

  const toggleMute = () => {
      setIsMuted(prev => {
          if (audioRef.current) audioRef.current.muted = !prev;
          return !prev;
      })
  }

  const playTrack = useCallback((index: number) => {
    if (index >= 0 && index < currentQueue.length) {
      const track = currentQueue[index];
      setCurrentTrackIndex(index);
      if (audioRef.current) {
        audioRef.current.src = track.url;
        audioRef.current.play().then(() => setIsPlaying(true)).catch(e => console.error("Playback failed", e));
      }
    }
  }, [currentQueue]);

  const togglePlayPause = useCallback(() => {
    if (!currentTrack) return;
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      audioRef.current?.play().then(() => setIsPlaying(true));
    }
  }, [isPlaying, currentTrack]);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
    }
  }, []);

  const playNext = useCallback((isTrackEnd: boolean = false) => {
    if (currentTrackIndex === null) return;
    
    if (repeatMode === 'one' && isTrackEnd) {
        audioRef.current?.play();
        return;
    }

    let nextIndex = currentTrackIndex + 1;
    if (nextIndex >= currentQueue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        setIsPlaying(false);
        return;
      }
    }
    playTrack(nextIndex);
  }, [currentTrackIndex, currentQueue.length, playTrack, repeatMode]);
  
  playNextRef.current = playNext;

  const playPrev = useCallback(() => {
    if (currentTrackIndex === null) return;
    if ((audioRef.current?.currentTime || 0) > 3) {
      audioRef.current!.currentTime = 0;
    } else {
      const prevIndex = currentTrackIndex - 1;
      if (prevIndex >= 0) {
        playTrack(prevIndex);
      }
    }
  }, [currentTrackIndex, playTrack]);

  const clearQueue = () => {
    if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
    }
    setQueue([]);
    setCurrentTrackIndex(null);
    setProgress(0);
    setDuration(0);
  };
  
  const seek = (percentage: number) => {
      if (audioRef.current && currentTrack) {
          audioRef.current.currentTime = (percentage / 100) * duration;
      }
  }

  const skipForward = () => {
      if (audioRef.current) {
          audioRef.current.currentTime = Math.min(audioRef.current.currentTime + 10, duration);
      }
  }

  const skipBackward = () => {
      if (audioRef.current) {
          audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 10, 0);
      }
  }

  const toggleShuffle = () => setIsShuffled(prev => !prev);
  
  const value = {
    queue,
    setQueue,
    currentTrackIndex,
    setCurrentTrackIndex,
    currentTrack,
    isPlaying,
    setIsPlaying,
    progress,
    duration,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    repeatMode,
    setRepeatMode,
    isShuffled,
    toggleShuffle,
    settings,
    setSettings,
    playTrack,
    togglePlayPause,
    playNext,
    playPrev,
    stopPlayback,
    clearQueue,
    seek,
    skipForward,
    skipBackward,
    audioOutputs,
    selectedAudioOutputId,
    setAudioOutput
  };

  return <SoundCueContext.Provider value={value}>{children}</SoundCueContext.Provider>;
}
