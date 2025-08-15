"use client";

import { useEffect, useState } from 'react';
import {
  Settings,
  Music,
  Menu,
  X,
  Cpu,
  MemoryStick
} from 'lucide-react';
import { useSoundCue } from '@/hooks/useSoundCue';
import { useSystemMonitor } from '@/hooks/useSystemMonitor';
import Player from '@/components/Player';
import Queue from '@/components/Queue';
import SettingsPanel from '@/components/Settings';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Separator } from './ui/separator';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { Badge } from './ui/badge';

const StageCueLogo = () => (
  <div className="flex items-center gap-2">
    <Music className="text-primary h-6 w-6" />
    <h1 className="text-xl font-bold text-foreground">StageCue</h1>
  </div>
);

const SystemStats = () => {
  const { cpu, memory } = useSystemMonitor();
  
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex items-center gap-1">
        <Cpu className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">CPU:</span>
        <Badge variant={cpu > 80 ? "destructive" : cpu > 60 ? "secondary" : "outline"} className="text-xs">
          {cpu}%
        </Badge>
      </div>
      <div className="flex items-center gap-1">
        <MemoryStick className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">RAM:</span>
        <Badge variant={memory > 80 ? "destructive" : memory > 60 ? "secondary" : "outline"} className="text-xs">
          {memory}%
        </Badge>
      </div>
    </div>
  );
};


export default function StageCueClient() {
  const {
    togglePlayPause,
    playNext,
    playPrev,
    skipForward,
    skipBackward,
    stopPlayback,
  } = useSoundCue();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
  
  const SettingsSidebar = () => (
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
  );
  
  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground overflow-hidden">
      <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 md:px-6">
        <StageCueLogo />
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-xs font-mono">
            v0.3.2
          </Badge>
          <SystemStats />
          {isMobile && (
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[400px] sm:w-[540px] p-0">
                <SettingsSidebar />
              </SheetContent>
            </Sheet>
          )}
        </div>
      </header>
      <main className="flex-1">
        {isMobile ? (
          <div className="flex flex-col h-full">
            <Player />
            <Separator />
            <div className="flex-1 overflow-hidden">
              <Queue />
            </div>
          </div>
        ) : (
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
              <SettingsSidebar />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </main>
    </div>
  );
}
