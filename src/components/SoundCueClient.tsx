"use client";

import { useEffect } from 'react';
import {
  Settings,
  ListMusic,
  Github,
  Music,
} from 'lucide-react';
import { useSoundCue } from '@/hooks/useSoundCue';
import Player from '@/components/Player';
import Queue from '@/components/Queue';
import SettingsPanel from '@/components/Settings';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Separator } from './ui/separator';

const SoundCueLogo = () => (
  <div className="flex items-center gap-2">
    <Music className="text-primary h-6 w-6" />
    <h1 className="text-xl font-bold text-foreground">SoundCue</h1>
  </div>
);


export default function SoundCueClient() {
  const {
    togglePlayPause,
    playNext,
    playPrev,
    skipForward,
    skipBackward,
    stopPlayback,
  } = useSoundCue();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowRight':
          e.preventDefault();
          playNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          playPrev();
          break;
        case 'KeyS':
            e.preventDefault();
            stopPlayback();
            break;
        case 'KeyL':
           e.preventDefault();
           skipForward();
           break;
        case 'KeyJ':
            e.preventDefault();
            skipBackward();
            break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePlayPause, playNext, playPrev, skipForward, skipBackward, stopPlayback]);
  
  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground overflow-hidden">
      <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 md:px-6">
        <SoundCueLogo />
        <div className="flex items-center gap-2">
           <a href="https://github.com/firebase/studio-extra-sauce/tree/main/sound-cue" target="_blank" rel="noopener noreferrer">
            <Github className="h-6 w-6 text-muted-foreground hover:text-foreground transition-colors" />
           </a>
        </div>
      </header>
      <main className="flex-1">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={65} minSize={40}>
            <div className="flex flex-col h-full">
              <Player />
              <Separator />
              <div className="flex-1 overflow-hidden">
                <Queue />
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={35} minSize={25}>
            <div className="flex flex-col h-full">
               <div className="p-4 border-b">
                 <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Settings & Controls
                 </h2>
               </div>
               <div className="flex-1 overflow-y-auto p-4">
                 <SettingsPanel />
               </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </div>
  );
}
