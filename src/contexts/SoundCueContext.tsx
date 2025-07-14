
"use client";

import React, {
  createContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import type { Track, Settings, RepeatMode, MidiMessage, MidiCommand, AudioSettings } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface SoundCueContextType {
  queue: Track[];
  setQueue: React.Dispatch<React.SetStateAction<Track[]>>;
  isShuffled: boolean;
  toggleShuffle: () => void;
  currentTrackIndex: number | null;
  setCurrentTrackIndex: React.Dispatch<React.SetStateAction<number | null>>;
  selectedIndex: number | null;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number | null>>;
  currentTrack: Track | null;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  isFading: boolean;
  fadeCountdown: number | null;
  progress: number;
  duration: number;
  volume: number;
  setVolume: React.Dispatch<React.SetStateAction<number>>;
  isMuted: boolean;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  repeatMode: RepeatMode;
  setRepeatMode: React.Dispatch<React.SetStateAction<RepeatMode>>;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  audioSettings: AudioSettings;
  setAudioSettings: React.Dispatch<React.SetStateAction<AudioSettings>>;
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
};

const defaultAudioSettings: AudioSettings = {
    outputId: 'default',
    fadeIn: { enabled: false, duration: 2 },
    fadeOut: { enabled: false, duration: 2 },
    maxVolume: { enabled: false, level: 100 },
};

const loadInitialState = () => {
    if (typeof window === 'undefined') {
        return { settings: defaultSettings, audioSettings: defaultAudioSettings, volume: 1, isMuted: false };
    }
    try {
        const savedData = localStorage.getItem('soundcue-settings');
        if (savedData) {
            const parsed = JSON.parse(savedData);
            
            const mergedSettings = {
                ...defaultSettings,
                ...parsed.settings,
                midi: { ...defaultSettings.midi, ...parsed.settings?.midi, mappings: {...defaultSettings.midi.mappings, ...parsed.settings?.midi?.mappings} },
                osc: { ...defaultSettings.osc, ...parsed.settings?.osc },
            };

            const mergedAudioSettings = {
                ...defaultAudioSettings,
                ...parsed.audioSettings,
                fadeIn: {...defaultAudioSettings.fadeIn, ...parsed.audioSettings?.fadeIn}, 
                fadeOut: {...defaultAudioSettings.fadeOut, ...parsed.audioSettings?.fadeOut},
                maxVolume: {...defaultAudioSettings.maxVolume, ...parsed.audioSettings?.maxVolume}
            };

            const volume = typeof parsed.volume === 'number' ? parsed.volume : 1;
            const isMuted = typeof parsed.isMuted === 'boolean' ? parsed.isMuted : false;

            return { settings: mergedSettings, audioSettings: mergedAudioSettings, volume, isMuted };
        }
    } catch (error) {
        console.error("Failed to load settings from localStorage", error);
    }
    return { settings: defaultSettings, audioSettings: defaultAudioSettings, volume: 1, isMuted: false };
};


export function SoundCueProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Track[]>([]);
  const [shuffledQueue, setShuffledQueue] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [fadeCountdown, setFadeCountdown] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');
  const [isShuffled, setIsShuffled] = useState(false);
  
  const [settings, _setSettings] = useState<Settings>(defaultSettings);
  const [audioSettings, _setAudioSettings] = useState<AudioSettings>(defaultAudioSettings);
  const [volume, _setVolume] = useState(1);
  const [isMuted, _setIsMuted] = useState(false);

  const [isHydrated, setIsHydrated] = useState(false);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const [midiInputs, setMidiInputs] = useState<WebMidi.MIDIInput[]>([]);
  const [lastMidiMessage, setLastMidiMessage] = useState<MidiMessage | null>(null);
  const [learningCommand, setLearningCommand] = useState<MidiCommand | null>(null);
  
  const currentQueue = isShuffled ? shuffledQueue : queue;
  const currentTrack = currentTrackIndex !== null ? currentQueue[currentTrackIndex] : null;
  const selectedAudioOutputId = audioSettings.outputId;

  const setSettings = useCallback((arg: React.SetStateAction<Settings>) => {
    _setSettings(arg)
  }, []);

  const setAudioSettings = useCallback((arg: React.SetStateAction<AudioSettings>) => {
    _setAudioSettings(arg)
  }, []);

  const setVolume = useCallback((arg: React.SetStateAction<number>) => {
    _setVolume(prevVolume => {
        const newVolume = typeof arg === 'function' ? arg(prevVolume) : arg;
        if (audioRef.current) {
            let finalVolume = newVolume;
            if (audioSettings.maxVolume.enabled) {
                finalVolume = Math.min(newVolume, audioSettings.maxVolume.level / 100);
            }
            audioRef.current.volume = finalVolume;
        }
        return newVolume;
    });
  }, [audioSettings.maxVolume]);
  
  const toggleMute = useCallback(() => {
    _setIsMuted(prev => {
        const newMuted = !prev;
        if (audioRef.current) {
            audioRef.current.muted = newMuted;
        }
        return newMuted;
    });
  }, []);
  
  const setIsMuted = useCallback((arg: React.SetStateAction<boolean>) => {
     _setIsMuted(prev => {
        const newMuted = typeof arg === 'function' ? arg(prev) : arg;
        if (audioRef.current) {
            audioRef.current.muted = newMuted;
        }
        return newMuted;
    });
  }, []);

  useEffect(() => {
    const { settings: loadedSettings, audioSettings: loadedAudioSettings, volume: loadedVolume, isMuted: loadedIsMuted } = loadInitialState();
    setSettings(loadedSettings);
    _setAudioSettings(loadedAudioSettings);
    _setVolume(loadedVolume);
    _setIsMuted(loadedIsMuted);
    setIsHydrated(true);
  }, [setSettings]);
  
  useEffect(() => {
    if (isHydrated) {
        try {
            const dataToSave = { settings, audioSettings, volume, isMuted };
            localStorage.setItem('soundcue-settings', JSON.stringify(dataToSave));
        } catch (error) {
            console.error("Failed to save settings to localStorage", error);
        }
    }
  }, [settings, audioSettings, volume, isMuted, isHydrated]);

  useEffect(() => {
    if (audioRef.current) {
        let finalVolume = volume;
        if (audioSettings.maxVolume.enabled) {
            finalVolume = Math.min(volume, audioSettings.maxVolume.level / 100);
        }
        audioRef.current.volume = finalVolume;
        audioRef.current.muted = isMuted;
    }
  }, [volume, isMuted, audioSettings.maxVolume, isHydrated]);


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
    } catch (err) => {
        console.error("Error enumerating audio devices:", err);
    }
  }, []);
  
  const stopPlayback = useCallback((fade = true) => {
    const stopAction = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
    };

    const fadeOutAnd = (callback: () => void) => {
        stopFade();
        if (audioSettings.fadeOut.enabled && audioSettings.fadeOut.duration > 0 && audioRef.current) {
          setIsFading(true);
          const audio = audioRef.current;
          const startVolume = isMuted ? 0 : volume;
          let currentFadeTime = audioSettings.fadeOut.duration;
          setFadeCountdown(currentFadeTime);
    
          const steps = audioSettings.fadeOut.duration * 20; // 50ms interval
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
    };


    if (fade && isPlaying) {
      fadeOutAnd(stopAction);
    } else {
      stopFade();
      stopAction();
    }
  }, [isPlaying, audioSettings.fadeOut, isMuted, volume]);

  const fadeIn = useCallback(() => {
    stopFade();
    if (audioSettings.fadeIn.enabled && audioSettings.fadeIn.duration > 0 && audioRef.current) {
      setIsFading(true);
      const audio = audioRef.current;
      const targetVolume = isMuted ? 0 : volume;
      audio.volume = 0;
      let currentFadeTime = audioSettings.fadeIn.duration;
      setFadeCountdown(currentFadeTime);

      const steps = audioSettings.fadeIn.duration * 20; // 50ms interval
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
}, [audioSettings.fadeIn, isMuted, volume]);

  const playTrack = useCallback((index: number, andPlay = true) => {
    stopFade();
    const trackQueue = isShuffled ? shuffledQueue : queue;
    const trackToPlay = trackQueue[index];
    
    if (trackToPlay && audioRef.current) {
        setCurrentTrackIndex(index);
        setSelectedIndex(index);
        audioRef.current.src = trackToPlay.url;
        audioRef.current.load();
        
        if (andPlay) {
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
              playPromise.then(() => {
                  setIsPlaying(true);
                  fadeIn();
              }).catch(e => {
                  console.error("Playback failed on playTrack", e);
                  setIsPlaying(false);
                  toast({ variant: "destructive", title: "Playback Error", description: "Could not play the selected track." });
              });
          }
        } else {
          setIsPlaying(false);
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
    
    const fadeOutAnd = (callback: () => void) => {
        stopFade();
        if (!fromError && audioSettings.fadeOut.enabled && audioSettings.fadeOut.duration > 0 && audioRef.current) {
          setIsFading(true);
          const audio = audioRef.current;
          const startVolume = isMuted ? 0 : volume;
          let currentFadeTime = audioSettings.fadeOut.duration;
          setFadeCountdown(currentFadeTime);
    
          const steps = audioSettings.fadeOut.duration * 20; // 50ms interval
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
      };

    fadeOutAnd(() => playTrack(nextIndex, true));
  }, [currentTrackIndex, currentQueue, repeatMode, stopPlayback, playTrack, audioSettings.fadeOut, isMuted, volume]);


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
  }, [toast, getAudioOutputs, playNext, repeatMode, currentTrack?.name, fadeIn, currentTrack]);
  
  useEffect(() => {
      if (queue.length > 0 && currentTrackIndex === null) {
          playTrack(0, false);
      }
      if(queue.length === 0) {
        setSelectedIndex(null);
      }
  }, [queue, currentTrackIndex, playTrack]);
  
  const toggleShuffle = useCallback(() => {
    const currentTrackId = currentTrack?.id;
    const newIsShuffled = !isShuffled;
    setIsShuffled(newIsShuffled);

    if (newIsShuffled) {
      const shuffled = [...queue].sort(() => Math.random() - 0.5);
      setShuffledQueue(shuffled);
      const newIndex = currentTrackId ? shuffled.findIndex(t => t.id === currentTrackId) : 0;
      setCurrentTrackIndex(newIndex !== -1 ? newIndex : 0);
      setSelectedIndex(newIndex !== -1 ? newIndex : 0);
    } else {
      const newIndex = currentTrackId ? queue.findIndex(t => t.id === currentTrackId) : 0;
      setCurrentTrackIndex(newIndex !== -1 ? newIndex : 0);
      setSelectedIndex(newIndex !== -1 ? newIndex : 0);
    }
  }, [isShuffled, queue, currentTrack]);
  
  const setAudioOutput = useCallback(async (deviceId: string) => {
    if (audioRef.current && 'setSinkId' in HTMLAudioElement.prototype) {
      try {
        await (audioRef.current as any).setSinkId(deviceId);
        setAudioSettings(s => ({ ...s, outputId: deviceId }));
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
  }, [toast, setAudioSettings]);

  const togglePlayPause = useCallback(() => {
    if (isFading) return;
    
    const fadeOutAnd = (callback: () => void) => {
        stopFade();
        if (audioSettings.fadeOut.enabled && audioSettings.fadeOut.duration > 0 && audioRef.current) {
          setIsFading(true);
          const audio = audioRef.current;
          const startVolume = isMuted ? 0 : volume;
          let currentFadeTime = audioSettings.fadeOut.duration;
          setFadeCountdown(currentFadeTime);
    
          const steps = audioSettings.fadeOut.duration * 20; // 50ms interval
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
    };

    if (!currentTrack) {
        const indexToPlay = selectedIndex !== null ? selectedIndex : 0;
        if (currentQueue.length > 0) {
            playTrack(indexToPlay, true);
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
  }, [isPlaying, currentTrack, currentQueue, playTrack, fadeIn, isFading, audioSettings.fadeOut, isMuted, volume, selectedIndex]);

  const playPrev = useCallback(() => {
    if (isFading) return;
    
    const fadeOutAnd = (callback: () => void) => {
        stopFade();
        if (audioSettings.fadeOut.enabled && audioSettings.fadeOut.duration > 0 && audioRef.current) {
          setIsFading(true);
          const audio = audioRef.current;
          const startVolume = isMuted ? 0 : volume;
          let currentFadeTime = audioSettings.fadeOut.duration;
          setFadeCountdown(currentFadeTime);
    
          const steps = audioSettings.fadeOut.duration * 20; // 50ms interval
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
    };

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
  }, [currentTrackIndex, playTrack, repeatMode, currentQueue.length, isPlaying, fadeIn, isFading, audioSettings.fadeOut, isMuted, volume]);

  const clearQueue = () => {
    stopPlayback(false);
    queue.forEach(track => {
      if (track.url.startsWith('blob:')) {
        URL.revokeObjectURL(track.url);
      }
    });

    setQueue([]);
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

  const reorderQueue = useCallback((startIndex: number, endIndex: number) => {
    if (isShuffled) {
        toast({
            title: "Reordering disabled",
            description: "Please disable shuffle mode to reorder the playlist.",
        });
        return;
    }

    const newQueue = Array.from(queue);
    const [removed] = newQueue.splice(startIndex, 1);
    newQueue.splice(endIndex, 0, removed);
    
    setQueue(newQueue);

    const currentId = currentTrack?.id;
    const selectedId = selectedIndex !== null ? queue[selectedIndex]?.id : null;

    if (currentId) {
        const newCurrentIndex = newQueue.findIndex(t => t.id === currentId);
        if (newCurrentIndex !== -1) {
            setCurrentTrackIndex(newCurrentIndex);
        }
    }
    
    if (selectedId) {
        const newSelectedIndex = newQueue.findIndex(t => t.id === selectedId);
        if (newSelectedIndex !== -1) {
            setSelectedIndex(newSelectedIndex);
        }
    }
  }, [queue, isShuffled, toast, currentTrack, selectedIndex]);
  
  const midiCommandActions = {
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
                const midiAccess = await navigator.requestMIDIAccess({ sysex: false });
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
                const action = midiCommandActions[commandToTrigger as keyof typeof midiCommandActions];
                if (action) action();
            }
        }
      };
      
      selectedInput.onmidimessage = handleMidiMessage;
      
      return () => {
        if(selectedInput) selectedInput.onmidimessage = null;
      };
    }
  }, [settings.midi.inputId, settings.midi.mappings, midiInputs, learningCommand, toast, midiCommandActions, setSettings]);


  if (!isHydrated) {
    return null;
  }

  const value: SoundCueContextType = {
    queue: currentQueue,
    setQueue,
    isShuffled,
    toggleShuffle,
    currentTrackIndex,
    setCurrentTrackIndex,
    selectedIndex,
    setSelectedIndex,
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
    setIsMuted,
    repeatMode,
    setRepeatMode,
    settings,
    setSettings,
    audioSettings,
    setAudioSettings,
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
