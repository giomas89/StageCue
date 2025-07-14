
"use client";

import React, {
  createContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import type { Track, Settings, RepeatMode, MidiMessage, MidiCommand } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface SoundCueContextType {
  queue: Track[];
  setQueue: React.Dispatch<React.SetStateAction<Track[]>>;
  currentTrackIndex: number | null;
  setCurrentTrackIndex: React.Dispatch<React.SetStateAction<number | null>>;
  currentTrack: Track | null;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  isFading: boolean;
  fadeCountdown: number | null;
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
  stopPlayback: (fade?: boolean) => void;
  clearQueue: () => void;
  seek: (percentage: number) => void;
  skipForward: () => void;
  skipBackward: () => void;
  audioOutputs: MediaDeviceInfo[];
  selectedAudioOutputId: string | null;
  setAudioOutput: (deviceId: string) => void;
  reorderQueue: (startIndex: number, endIndex: number) => void;
  midiInputs: WebMidi.MIDIInput[];
  lastMidiMessage: MidiMessage | null;
  learningCommand: MidiCommand | null;
  setLearningCommand: React.Dispatch<React.SetStateAction<MidiCommand | null>>;
  selectMidiInput: (id: string) => void;
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
      maxVolume: { enabled: false, level: 100 },
      volume: 1,
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
                audio: { 
                  ...defaultSettings.audio, 
                  ...parsed.audio, 
                  fadeIn: {...defaultSettings.audio.fadeIn, ...parsed.audio?.fadeIn}, 
                  fadeOut: {...defaultSettings.audio.fadeOut, ...parsed.audio?.fadeOut},
                  maxVolume: {...defaultSettings.audio.maxVolume, ...parsed.audio?.maxVolume}
                },
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
  const [isFading, setIsFading] = useState(false);
  const [fadeCountdown, setFadeCountdown] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');
  const [isShuffled, setIsShuffled] = useState(false);
  
  const [settings, _setSettings] = useState<Settings>(defaultSettings);
  const [isHydrated, setIsHydrated] = useState(false);

  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioOutputId, setSelectedAudioOutputId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const [midiInputs, setMidiInputs] = useState<WebMidi.MIDIInput[]>([]);
  const [lastMidiMessage, setLastMidiMessage] = useState<MidiMessage | null>(null);
  const [learningCommand, setLearningCommand] = useState<MidiCommand | null>(null);

  const currentQueue = isShuffled ? shuffledQueue : queue;
  const currentTrack = currentTrackIndex !== null ? currentQueue[currentTrackIndex] : null;

  useEffect(() => {
    // Hydration-safe settings load
    const loadedSettings = loadSettings();
    _setSettings(loadedSettings);
    setSelectedAudioOutputId(loadedSettings.audio.outputId);
    setIsHydrated(true);
  }, []);

  const volume = settings.audio.volume;
  
  const setVolume = (vol: number) => {
      let newVol = vol;
      if (settings.audio.maxVolume.enabled) {
          newVol = Math.min(vol, settings.audio.maxVolume.level / 100);
      }
      
      if (audioRef.current) {
          stopFade();
          audioRef.current.volume = newVol;
      }
  
      if (newVol > 0 && isMuted) {
        setIsMuted(false);
        if(audioRef.current) audioRef.current.muted = false;
      }
  
      _setSettings(s => {
        if (s.audio.volume === newVol) return s;
        return {...s, audio: {...s.audio, volume: newVol}};
      });
    }

  const setSettings = useCallback((setter: React.SetStateAction<Settings>) => {
    _setSettings(prevSettings => {
        const newSettings = typeof setter === 'function' ? setter(prevSettings) : setter;

        try {
            localStorage.setItem('soundcue-settings', JSON.stringify(newSettings));
        } catch (error) {
             console.error("Failed to save settings to localStorage", error);
        }
        
        // When max volume settings change, adjust current volume if needed
        if (newSettings.audio.maxVolume.enabled && newSettings.audio.volume > newSettings.audio.maxVolume.level / 100) {
            const adjustedVolume = newSettings.audio.maxVolume.level / 100;
             if (audioRef.current) {
                audioRef.current.volume = adjustedVolume;
            }
            return {
                ...newSettings,
                audio: {
                    ...newSettings.audio,
                    volume: adjustedVolume,
                },
            };
        } else if (newSettings.audio.maxVolume.enabled) {
            const adjustedVolume = newSettings.audio.maxVolume.level / 100;
             if (audioRef.current) {
                audioRef.current.volume = adjustedVolume;
            }
             return {
                ...newSettings,
                audio: {
                    ...newSettings.audio,
                    volume: adjustedVolume,
                },
            };
        }


        if (audioRef.current && audioRef.current.volume !== newSettings.audio.volume) {
          audioRef.current.volume = newSettings.audio.volume;
        }

        return newSettings;
    });
  }, []);

  const stopFade = () => {
    if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
    }
    setIsFading(false);
    setFadeCountdown(null);
  }

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

  const fadeOutAnd = useCallback((callback: () => void) => {
    stopFade();
    if (settings.audio.fadeOut.enabled && settings.audio.fadeOut.duration > 0 && audioRef.current) {
      setIsFading(true);
      const audio = audioRef.current;
      const startVolume = isMuted ? 0 : volume;
      let currentFadeTime = settings.audio.fadeOut.duration;
      setFadeCountdown(currentFadeTime);

      const steps = settings.audio.fadeOut.duration * 20; // 50ms interval
      const stepValue = startVolume / steps;

      fadeIntervalRef.current = setInterval(() => {
        const newVolume = Math.max(0, audio.volume - stepValue);
        audio.volume = newVolume;
        currentFadeTime -= 0.05;
        setFadeCountdown(currentFadeTime > 0 ? currentFadeTime : 0);

        if (newVolume <= 0) {
          stopFade();
          callback();
          audio.volume = startVolume; // Reset for next play
        }
      }, 50);
    } else {
      callback();
    }
  }, [settings.audio.fadeOut, isMuted, volume]);

  const fadeIn = useCallback(() => {
      stopFade();
      if (settings.audio.fadeIn.enabled && settings.audio.fadeIn.duration > 0 && audioRef.current) {
        setIsFading(true);
        const audio = audioRef.current;
        const targetVolume = isMuted ? 0 : volume;
        audio.volume = 0;
        let currentFadeTime = settings.audio.fadeIn.duration;
        setFadeCountdown(currentFadeTime);

        const steps = settings.audio.fadeIn.duration * 20; // 50ms interval
        const stepValue = targetVolume / steps;

        fadeIntervalRef.current = setInterval(() => {
            const newVolume = Math.min(targetVolume, audio.volume + stepValue);
            audio.volume = newVolume;
            currentFadeTime -= 0.05;
            setFadeCountdown(currentFadeTime > 0 ? currentFadeTime : 0);
            
            if (newVolume >= targetVolume) {
                stopFade();
            }
        }, 50);
      } else if (audioRef.current) {
          audioRef.current.volume = isMuted ? 0 : volume;
      }
  }, [settings.audio.fadeIn, isMuted, volume]);
  
  const stopPlayback = useCallback((fade = true) => {
    const stopAction = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
    };

    if (fade && isPlaying) {
      fadeOutAnd(stopAction);
    } else {
      stopFade();
      stopAction();
    }
  }, [fadeOutAnd, isPlaying]);

  const playTrack = useCallback((index: number, andPlay = true) => {
    stopFade();
    const trackToPlay = (isShuffled ? shuffledQueue : queue)[index];
    if (trackToPlay && audioRef.current) {
        setCurrentTrackIndex(index);
        audioRef.current.src = trackToPlay.url;
        audioRef.current.load();
        
        const playPromise = audioRef.current.play();

        if (playPromise !== undefined) {
            playPromise.then(() => {
                if (andPlay) {
                    setIsPlaying(true);
                    fadeIn();
                } else {
                    audioRef.current?.pause();
                    setIsPlaying(false);
                }
            }).catch(e => {
                console.error("Playback failed on playTrack", e);
                setIsPlaying(false);
                toast({ variant: "destructive", title: "Playback Error", description: "Could not play the selected track." });
            });
        }
    }
  }, [queue, shuffledQueue, isShuffled, fadeIn, toast]);

  const playNext = useCallback((fromError: boolean = false) => {
    if (currentTrackIndex === null) return;
    
    let nextIndex = currentTrackIndex + 1;
    
    if (nextIndex >= currentQueue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        stopPlayback(false);
        if (currentQueue.length > 0) {
            playTrack(0, false);
        }
        return;
      }
    }
    
    fadeOutAnd(() => playTrack(nextIndex, true));
  }, [currentTrackIndex, currentQueue, repeatMode, stopPlayback, playTrack, fadeOutAnd]);


  useEffect(() => {
    if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.volume = settings.audio.volume;
    }
    const audio = audioRef.current;
    
    getAudioOutputs();
    
    const handleTimeUpdate = () => {
      if (!audio) return;
      setProgress((audio.currentTime / audio.duration) * 100 || 0);
      setDuration(audio.duration || 0);
    };

    const handleEnded = () => {
        if (repeatMode === 'one') {
          if (audio) {
            audio.currentTime = 0;
            audio.play().then(fadeIn);
          }
        } else {
            playNext();
        }
    };
    
    const handleError = (e: Event) => {
      stopFade();
      const error = (e.target as HTMLAudioElement).error;
      if (!audio?.src || !error) return;

      const trackName = currentTrack?.name || 'Unknown Track';
      let errorMsg = `Could not play audio. Code: ${error.code}, Message: ${error.message}`;

      switch (error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          // This often happens when changing tracks, so we don't want to show an error.
          console.log(`Playback aborted for ${trackName}. This is usually normal.`);
          return;
        case MediaError.MEDIA_ERR_DECODE:
            errorMsg = `The audio file might be corrupt or in an unsupported format.`;
            break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMsg = `The audio format is not supported.`;
            break;
        case MediaError.MEDIA_ERR_NETWORK:
            errorMsg = `A network error caused the download to fail.`;
            break;
      }
      
      toast({
        variant: "destructive",
        title: `Playback Error: ${trackName}`,
        description: errorMsg,
      });

      setIsPlaying(false);
      playNext(true);
    };
    
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
  }, [toast, getAudioOutputs, playNext, repeatMode, currentTrack?.name, fadeIn, currentTrack, settings.audio.volume]);
  
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
            playTrack(0, false);
        } else {
            setCurrentTrackIndex(null);
            stopPlayback(false);
        }
    }

  }, [isShuffled, queue, playTrack, stopPlayback]); // eslint-disable-line react-hooks/exhaustive-deps
  
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
    if (isFading) return;

    if (!currentTrack) {
        if (currentQueue.length > 0) {
            playTrack(0, true);
        }
        return;
    };
    if (isPlaying) {
      fadeOutAnd(() => {
        audioRef.current?.pause();
      });
      setIsPlaying(false);
    } else {
      if (audioRef.current) {
          audioRef.current.play().then(() => {
            fadeIn();
          }).catch(e => {
              console.error("Playback failed on toggle", e);
              setIsPlaying(false);
          });
          setIsPlaying(true);
      }
    }
  }, [isPlaying, currentTrack, currentQueue, playTrack, fadeOutAnd, fadeIn, isFading]);

  const playPrev = useCallback(() => {
    if (isFading) return;
    
    const logic = () => {
        if (currentTrackIndex === null || !audioRef.current) return;
        
        if (audioRef.current.currentTime > 3) {
          audioRef.current.currentTime = 0;
          if(!isPlaying) {
            audioRef.current.play().then(fadeIn).catch(e => console.error(e));
            setIsPlaying(true);
          } else {
            fadeIn();
          }
        } else {
          let prevIndex = currentTrackIndex - 1;
          if (prevIndex < 0) {
            prevIndex = repeatMode === 'all' ? currentQueue.length - 1 : -1;
          }
          if (prevIndex >= 0) {
            playTrack(prevIndex, true);
          }
        }
    }

    if (isPlaying) {
      fadeOutAnd(logic);
    } else {
      logic();
    }
  }, [currentTrackIndex, playTrack, repeatMode, currentQueue.length, isPlaying, fadeOutAnd, fadeIn, isFading]);

  const clearQueue = () => {
    stopPlayback(false);
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

    const currentTrackId = currentTrack?.id;
    if (currentTrackIndex !== null && currentTrackId) {
      const newIndex = result.findIndex(track => track.id === currentTrackId);
      if (newIndex !== -1) {
        setCurrentTrackIndex(newIndex);
      }
    }
  };
  
  const midiCommandActions: Record<MidiCommand, () => void> = {
    togglePlayPause,
    playNext,
    playPrev,
    stopPlayback: () => stopPlayback(),
    skipForward,
    skipBackward,
  };

  const selectMidiInput = (id: string) => {
    setSettings(s => ({...s, midi: {...s.midi, inputId: id}}));
  };
  
  useEffect(() => {
    const requestMidi = async () => {
        try {
            if (navigator.requestMIDIAccess) {
                const midiAccess = await navigator.requestMIDIAccess();
                const inputs = Array.from(midiAccess.inputs.values());
                setMidiInputs(inputs);
            }
        } catch(e) {
            console.error("Could not access your MIDI devices.", e);
            if (e instanceof Error && e.name === 'SecurityError') {
                 toast({ variant: "destructive", title: "MIDI Permissions Denied", description: "MIDI access is disabled by browser permissions policy." });
            } else {
                 toast({ variant: "destructive", title: "MIDI Error", description: "Could not access MIDI devices." });
            }
        }
    }
    requestMidi();
  }, [toast]);
  
  
  useEffect(() => {
    const selectedInput = midiInputs.find(input => input.id === settings.midi.inputId);

    midiInputs.forEach(input => {
      // Clear any previous listeners
      if (input.onmidimessage) {
        input.onmidimessage = null;
      }
    });

    if (selectedInput) {
      const handleMidiMessage = (event: WebMidi.MIDIMessageEvent) => {
        const [command, note, velocity] = event.data;
        
        let type: MidiMessage['type'] = 'Unknown';
        if (command >= 144 && command <= 159) type = 'Note On';
        else if (command >= 128 && command <= 143) type = 'Note Off';
        else if (command >= 176 && command <= 191) type = 'Control Change';

        const newMessage: MidiMessage = { command, note, velocity, timestamp: event.timeStamp, type };
        setLastMidiMessage(newMessage);
        
        if (type === 'Note On' && velocity > 0) {
            if (learningCommand) {
                setSettings(s => ({
                    ...s,
                    midi: {
                        ...s.midi,
                        mappings: { ...s.midi.mappings, [learningCommand]: note }
                    }
                }));
                toast({ title: "MIDI Learned", description: `Assigned Note ${note} to ${learningCommand}`});
                setLearningCommand(null);
                return;
            }
            
            const commandToTrigger = (Object.keys(settings.midi.mappings) as MidiCommand[]).find(
                cmd => settings.midi.mappings[cmd] === note
            );

            if(commandToTrigger) {
                const action = midiCommandActions[commandToTrigger];
                if (action) action();
            }
        }
      };
      
      selectedInput.onmidimessage = handleMidiMessage;
      
      return () => {
        if(selectedInput) selectedInput.onmidimessage = null;
      };
    }
  }, [settings.midi.inputId, settings.midi.mappings, midiInputs, learningCommand, setSettings, toast, midiCommandActions]);


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
    isFading,
    fadeCountdown,
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
    stopPlayback: () => stopPlayback(),
    clearQueue,
    seek,
    skipForward,
    skipBackward,
    audioOutputs,
    selectedAudioOutputId,
    setAudioOutput,
    reorderQueue,
    midiInputs,
    lastMidiMessage,
    learningCommand,
    setLearningCommand,
    selectMidiInput
  };

  return <SoundCueContext.Provider value={value}>{children}</SoundCueContext.Provider>;
}
