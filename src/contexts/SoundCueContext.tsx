
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
  playTrack: (index: number, andPlay?: boolean) => void;
  togglePlayPause: () => void;
  playNext: (fromError?: boolean) => void;
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
        stopPlayback: 50, // D3
        playNext: 62, // D4
        playPrev: 59, // B3
        skipForward: 64, // E4
        skipBackward: 55, // G3
      },
    },
    osc: { ip: '127.0.0.1', port: 9000 },
    audio: { outputId: 'default' }
};

const loadSettings = (): Settings => {
    if (typeof window === 'undefined') {
        return defaultSettings;
    }
    try {
        const savedSettings = localStorage.getItem('soundcue-settings');
        if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            const mergedSettings = {
                ...defaultSettings,
                ...parsed,
                midi: { ...defaultSettings.midi, ...parsed.midi, mappings: {...defaultSettings.midi.mappings, ...parsed.midi?.mappings} },
                osc: { ...defaultSettings.osc, ...parsed.osc },
                audio: { ...defaultSettings.audio, ...parsed.audio },
            };
            return mergedSettings;
        }
    } catch (error) {
        console.error("Failed to load settings from localStorage", error);
    }
    return defaultSettings;
};


export function SoundCueProvider({ children }: { children: ReactNode }) {
  const [queue, _setQueue] = useState<Track[]>([]);
  const [shuffledQueue, setShuffledQueue] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setInternalVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');
  const [isShuffled, setIsShuffled] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioOutputId, setSelectedAudioOutputId] = useState<string | null>(settings.audio.outputId);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    try {
        const settingsJson = JSON.stringify(settings);
        localStorage.setItem('soundcue-settings', settingsJson);
    } catch (error) {
        console.error("Failed to save settings to localStorage", error);
    }
  }, [settings]);

  const getAudioOutputs = useCallback(async () => {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            console.warn("Media devices API not available.");
            return;
        }
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputs = devices.filter(device => device.kind === 'audiooutput');
        setAudioOutputs(outputs);
    } catch (err) {
        console.error("Error enumerating audio devices:", err);
    }
  }, []);

  const playNext = useCallback((fromError: boolean = false) => {
    if (currentTrackIndex === null) return;
    
    let nextIndex = currentTrackIndex + 1;
    if (nextIndex >= (isShuffled ? shuffledQueue : queue).length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        stopPlayback();
        if ((isShuffled ? shuffledQueue : queue).length > 0) {
            playTrack(0, false);
        }
        return;
      }
    }
    if (nextIndex === currentTrackIndex && (isShuffled ? shuffledQueue : queue).length === 1) {
        stopPlayback();
        return;
    }
    playTrack(nextIndex, true);
  }, [currentTrackIndex, queue, shuffledQueue, isShuffled, repeatMode]);

  useEffect(() => {
    if (!audioRef.current) {
        audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    
    getAudioOutputs();
    
    if (settings.audio.outputId) {
        setAudioOutput(settings.audio.outputId);
    }
    
    const handleTimeUpdate = () => {
      if (!audio) return;
      setProgress((audio.currentTime / audio.duration) * 100 || 0);
      setDuration(audio.duration || 0);
    };

    const handleEnded = () => {
        if (repeatMode === 'one') {
            audio.currentTime = 0;
            audio.play();
        } else {
            playNext();
        }
    };
    
    const handleError = (e: any) => {
        const error = (e.target as HTMLAudioElement).error;
        if (audio?.src && error) {
             toast({
                variant: "destructive",
                title: "Playback Error",
                description: `Could not play the audio file. It might be corrupt or in an unsupported format. Code: ${error.code}, Message: ${error.message}`
            });
        }
        setIsPlaying(false);
        playNext(true);
    }

    navigator.mediaDevices.addEventListener('devicechange', getAudioOutputs);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getAudioOutputs);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [toast, getAudioOutputs, settings.audio.outputId, playNext, repeatMode]);
  
  const currentQueue = isShuffled ? shuffledQueue : queue;
  const currentTrack = currentTrackIndex !== null ? currentQueue[currentTrackIndex] : null;

  const playTrack = useCallback((index: number, andPlay = true) => {
    const trackToPlay = currentQueue[index];
    if (trackToPlay && audioRef.current) {
      setCurrentTrackIndex(index);
      audioRef.current.src = trackToPlay.url;
      audioRef.current.load();
      if (andPlay) {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(e => {
          console.error("Playback failed on playTrack", e);
          setIsPlaying(false);
        });
      } else {
        setIsPlaying(false);
      }
    }
  }, [currentQueue]);

  const setQueue = (setter: React.SetStateAction<Track[]>) => {
    const newQueue = typeof setter === 'function' ? setter(queue) : setter;
    const wasEmpty = queue.length === 0;

    _setQueue(newQueue);

    if (wasEmpty && newQueue.length > 0 && currentTrackIndex === null) {
      setTimeout(() => playTrack(0, false), 0);
    }
  };

  useEffect(() => {
    const trackBeforeShuffle = currentTrack;
    let newQueue: Track[] = [];
    if (isShuffled) {
      const shuffled = [...queue].sort(() => Math.random() - 0.5);
      setShuffledQueue(shuffled);
      newQueue = shuffled;
    } else {
      setShuffledQueue([]);
      newQueue = queue;
    }
    
    if (trackBeforeShuffle) {
        const newIndex = newQueue.findIndex(t => t.id === trackBeforeShuffle.id);
        if(newIndex !== -1) {
            setCurrentTrackIndex(newIndex);
        } else if (newQueue.length > 0) {
            setCurrentTrackIndex(0);
        } else {
            setCurrentTrackIndex(null);
        }
    }

  }, [isShuffled, queue, currentTrack]);
  
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
    } else if (deviceId !== 'default') {
        toast({
          variant: "destructive",
          title: "Feature Not Supported",
          description: "Your browser does not support changing audio output devices.",
        });
    }
  }, [toast, setSettings]);

  const toggleMute = () => {
      setIsMuted(prev => {
          if (audioRef.current) audioRef.current.muted = !prev;
          return !prev;
      })
  }

  const togglePlayPause = useCallback(() => {
    if (!currentTrack) {
        if (currentQueue.length > 0) {
            playTrack(0, true);
        }
        return;
    };
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (audioRef.current) {
          audioRef.current.play().then(() => {
            setIsPlaying(true);
          }).catch(e => {
              console.error("Playback failed on toggle", e);
              setIsPlaying(false);
          });
      }
    }
  }, [isPlaying, currentTrack, currentQueue, playTrack]);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
    }
  }, []);

  const playPrev = useCallback(() => {
    if (currentTrackIndex === null) return;
    if ((audioRef.current?.currentTime || 0) > 3) {
      audioRef.current!.currentTime = 0;
    } else {
      let prevIndex = currentTrackIndex - 1;
      if (prevIndex < 0) {
        prevIndex = repeatMode === 'all' ? currentQueue.length - 1 : -1;
      }
      if (prevIndex >= 0) {
        playTrack(prevIndex, true);
      }
    }
  }, [currentTrackIndex, playTrack, repeatMode, currentQueue.length]);

  const clearQueue = () => {
    stopPlayback();
    // Revoke old object URLs
    queue.forEach(track => URL.revokeObjectURL(track.url));

    _setQueue([]);
    setShuffledQueue([]);
    setCurrentTrackIndex(null);
    setProgress(0);
    setDuration(0);
    if(audioRef.current) {
        audioRef.current.src = "";
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
    }
  };
  
  const seek = (percentage: number) => {
      if (audioRef.current && currentTrack && isFinite(audioRef.current.duration)) {
          audioRef.current.currentTime = (percentage / 100) * audioRef.current.duration;
      }
  }

  const skipForward = () => {
      if (audioRef.current && currentTrack && isFinite(audioRef.current.duration)) {
          audioRef.current.currentTime = Math.min(audioRef.current.currentTime + 10, audioRef.current.duration);
      }
  }

  const skipBackward = () => {
      if (audioRef.current && currentTrack) {
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
