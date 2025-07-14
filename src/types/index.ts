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

export interface Settings {
  midi: {
    inputId: string | null;
    mappings: Record<MidiCommand, number | null | undefined>;
  };
  osc: {
    ip: string;
    port: number;
  };
  audio: {
    outputId: string | null;
  }
}
