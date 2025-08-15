
export interface Track {
  id: string;
  name: string;
  url: string;
  file: File;
  duration?: number;
}

export type RepeatMode = 'none' | 'one' | 'all';

export type MidiCommand = 
  | 'togglePlayPause' 
  | 'playNext' 
  | 'playPrev' 
  | 'stopPlayback'
  | 'skipForward'
  | 'skipBackward';

export interface MidiMessage {
  command: number;
  note: number;
  velocity: number;
  timestamp: number;
  type: 'Note On' | 'Note Off' | 'Control Change' | 'Unknown';
}
  
export interface Settings {
  midi: {
    inputId: string | null;
    mappings: Record<MidiCommand, number | null | undefined>;
  };
  osc: {
    ip: string;
    port: number;
  };
}

export interface AudioSettings {
  outputId: string | null;
  fadeIn: {
    enabled: boolean;
    duration: number;
  },
  fadeOut: {
    enabled: boolean;
    duration: number;
  },
  maxVolume: {
    enabled: boolean;
    level: number;
  },
  vocalRemoval: {
    enabled: boolean;
    highPassFreq: number;
  },
}

    