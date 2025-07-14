
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
  reorderQueue: (startIndex: number, endIndex: number) => void;
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
    audio: { 
      outputId: 'default',
      fadeIn: { enabled: false, duration: 2 },
      fadeOut: { enabled: false, duration: 2 },
    }
};

const loadSettings = (): Settings => {
    if (typeof window === 'undefined') {
        return defaultSettings;
    }
    try {
        const savedSettings = localStorage.getItem('soundcue-settings');
        if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            // Deep merge to prevent losing nested properties if they don't exist in saved settings
            const mergedSettings = {
                ...defaultSettings,
                ...parsed,
                midi: { ...defaultSettings.midi, ...parsed.midi, mappings: {...defaultSettings.midi.mappings, ...parsed.midi?.mappings} },
                osc: { ...defaultSettings.osc, ...parsed.osc },
                audio: { ...defaultSettings.audio, ...parsed.audio, fadeIn: {...defaultSettings.audio.fadeIn, ...parsed.audio?.fadeIn}, fadeOut: {...defaultSettings.audio.fadeOut, ...parsed.audio?.fadeOut} },
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
  
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isHydrated, setIsHydrated] = useState(false);

  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioOutputId, setSelectedAudioOutputId] = useState<string | null>(settings.audio.outputId);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    // Hydration-safe settings load
    setSettings(loadSettings());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
        try {
            const settingsJson = JSON.stringify(settings);
            localStorage.setItem('soundcue-settings', settingsJson);
            setSelectedAudioOutputId(settings.audio.outputId);
        } catch (error) {
            console.error("Failed to save settings to localStorage", error);
        }
    }
  }, [settings, isHydrated]);

  const getAudioOutputs = useCallback(async () => {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            return;
        }
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputs = devices.filter(device => device.kind === 'audiooutput');
        setAudioOutputs(outputs);
    } catch (err) {
        console.error("Error enumerating audio devices:", err);
    }
  }, []);
  
  const stopFade = () => {
    if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
    }
  }

  const fadeOutAnd = (callback: () => void) => {
    stopFade();
    if (settings.audio.fadeOut.enabled && settings.audio.fadeOut.duration > 0 && audioRef.current) {
      const audio = audioRef.current;
      const startVolume = isMuted ? 0 : volume;
      const step = startVolume / (settings.audio.fadeOut.duration * 20); // 50ms steps

      fadeIntervalRef.current = setInterval(() => {
        const newVolume = Math.max(0, audio.volume - step);
        audio.volume = newVolume;
        if (newVolume <= 0) {
          stopFade();
          callback();
          audio.volume = startVolume; // Reset for next play
        }
      }, 50);
    } else {
      callback();
    }
  };

  const fadeIn = () => {
      stopFade();
      if (settings.audio.fadeIn.enabled && settings.audio.fadeIn.duration > 0 && audioRef.current) {
        const audio = audioRef.current;
        const targetVolume = isMuted ? 0 : volume;
        audio.volume = 0;
        const step = targetVolume / (settings.audio.fadeIn.duration * 20); // 50ms steps

        fadeIntervalRef.current = setInterval(() => {
            const newVolume = Math.min(targetVolume, audio.volume + step);
            audio.volume = newVolume;
            if (newVolume >= targetVolume) {
                stopFade();
            }
        }, 50);
      } else if (audioRef.current) {
          audioRef.current.volume = isMuted ? 0 : volume;
      }
  }
  
  const playNext = useCallback((fromError: boolean = false) => {
    if (currentTrackIndex === null) return;
    
    let nextIndex = currentTrackIndex + 1;
    const currentQueue = isShuffled ? shuffledQueue : queue;
    
    if (nextIndex >= currentQueue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        stopPlayback();
        if (currentQueue.length > 0) {
            playTrack(0, false);
        }
        return;
      }
    }
    if (nextIndex === currentTrackIndex && currentQueue.length === 1 && !fromError) {
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
    
    const handleTimeUpdate = () => {
      if (!audio) return;
      setProgress((audio.currentTime / audio.duration) * 100 || 0);
      setDuration(audio.duration || 0);
    };

    const handleEnded = () => {
      fadeOutAnd(() => {
          if (repeatMode === 'one') {
              audio.currentTime = 0;
              audio.play().then(fadeIn);
          } else {
              playNext();
          }
      });
    };
    
    const handleError = (e: any) => {
        const error = (e.target as HTMLAudioElement).error;
        if (audio?.src && error) {
            let errorMsg = `Could not play the audio file. Code: ${error.code}, Message: ${error.message}`;
            if (error.code === MediaError.MEDIA_ERR_DECODE || error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
                 errorMsg = `The audio file might be corrupt or in an unsupported format.`;
            }
            toast({
                variant: "destructive",
                title: "Playback Error",
                description: errorMsg,
            });
            setIsPlaying(false);
            // Don't auto-skip to avoid loops with multiple bad files.
            // playNext(true); 
        }
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
  }, [toast, getAudioOutputs, playNext, repeatMode]);
  
  const currentQueue = isShuffled ? shuffledQueue : queue;
  const currentTrack = currentTrackIndex !== null ? currentQueue[currentTrackIndex] : null;

  const playTrack = useCallback((index: number, andPlay = true) => {
    const trackToPlay = (isShuffled ? shuffledQueue : queue)[index];
    if (trackToPlay && audioRef.current) {
      setCurrentTrackIndex(index);
      audioRef.current.src = trackToPlay.url;
      audioRef.current.load();
      if (andPlay) {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
          fadeIn();
        }).catch(e => {
          console.error("Playback failed on playTrack", e);
          setIsPlaying(false);
        });
      } else {
        setIsPlaying(false);
      }
    }
  }, [queue, isShuffled, shuffledQueue]);

  const setQueue = (setter: React.SetStateAction<Track[]>) => {
    _setQueue(currentQueue => {
        const newQueue = typeof setter === 'function' ? setter(currentQueue) : setter;
        const wasEmpty = currentQueue.length === 0;

        if(wasEmpty && newQueue.length > 0 && currentTrackIndex === null) {
            setTimeout(() => playTrack(0, false), 0);
        }
        return newQueue;
    });
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
    setInternalVolume(vol);
    if (audioRef.current) {
        stopFade();
        audioRef.current.volume = vol;
    }
    if(vol > 0 && isMuted) setIsMuted(false);
  }

  const setAudioOutput = useCallback(async (deviceId: string) => {
    if (audioRef.current && 'setSinkId' in HTMLAudioElement.prototype) {
      try {
        await (audioRef.current as any).setSinkId(deviceId);
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
      const newMuteState = !isMuted;
      setIsMuted(newMuteState);
      if (audioRef.current) {
        audioRef.current.muted = newMuteState;
      }
  }

  const togglePlayPause = useCallback(() => {
    if (!currentTrack) {
        if (currentQueue.length > 0) {
            playTrack(0, true);
        }
        return;
    };
    if (isPlaying) {
      fadeOutAnd(() => {
        audioRef.current?.pause();
        setIsPlaying(false);
      });
    } else {
      if (audioRef.current) {
          audioRef.current.play().then(() => {
            setIsPlaying(true);
            fadeIn();
          }).catch(e => {
              console.error("Playback failed on toggle", e);
              setIsPlaying(false);
          });
      }
    }
  }, [isPlaying, currentTrack, currentQueue, playTrack]);

  const stopPlayback = useCallback(() => {
    fadeOutAnd(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlaying(false);
        }
    })
  }, []);

  const playPrev = useCallback(() => {
    fadeOutAnd(() => {
        if (currentTrackIndex === null) return;
        if ((audioRef.current?.currentTime || 0) > 3) {
          audioRef.current!.currentTime = 0;
          if(!isPlaying) {
              setIsPlaying(true);
          }
          fadeIn();
        } else {
          let prevIndex = currentTrackIndex - 1;
          if (prevIndex < 0) {
            prevIndex = repeatMode === 'all' ? currentQueue.length - 1 : -1;
          }
          if (prevIndex >= 0) {
            playTrack(prevIndex, true);
          }
        }
    });
  }, [currentTrackIndex, playTrack, repeatMode, currentQueue.length, isPlaying]);

  const clearQueue = () => {
    stopPlayback();
    queue.forEach(track => {
      if (track.url.startsWith('blob:')) {
        URL.revokeObjectURL(track.url);
      }
    });

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
  
  const reorderQueue = (startIndex: number, endIndex: number) => {
    if (isShuffled) {
      toast({
        title: "Reordering disabled",
        description: "Please disable shuffle mode to reorder the playlist.",
      });
      return;
    }
    const result = Array.from(queue);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    _setQueue(result);

    // Update currentTrackIndex if the currently playing track was moved
    if (currentTrackIndex !== null) {
      if (currentTrackIndex === startIndex) {
        setCurrentTrackIndex(endIndex);
      } else if (startIndex < currentTrackIndex && endIndex >= currentTrackIndex) {
        setCurrentTrackIndex(currentTrackIndex - 1);
      } else if (startIndex > currentTrackIndex && endIndex <= currentTrackIndex) {
        setCurrentTrackIndex(currentTrackIndex + 1);
      }
    }
  };


  if (!isHydrated) {
    return null; // or a loading spinner
  }

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
    setAudioOutput,
    reorderQueue
  };

  return <SoundCueContext.Provider value={value}>{children}</SoundCueContext.Provider>;
}
