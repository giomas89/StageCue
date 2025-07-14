export interface Track {
  id: string;
  name: string;
  url: string;
  file: File;
}

export type RepeatMode = 'none' | 'one' | 'all';

export interface Settings {
  midi: {
    inputId: string | null;
  };
  osc: {
    ip: string;
    port: number;
  };
  audio: {
    outputId: string | null;
  }
}
