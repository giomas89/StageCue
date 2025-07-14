"use client";

import { useRef, useState } from 'react';
import { useSoundCue } from '@/hooks/useSoundCue';
import type { Track } from '@/types';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Upload, Trash2, Save, FolderOpen, ListMusic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from './ui/input';
import { Label } from './ui/label';

const formatDuration = (seconds: number | undefined) => {
    if (seconds === undefined || isNaN(seconds)) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

export default function Queue() {
  const { queue, setQueue, currentTrackIndex, playTrack, clearQueue, playNext } = useSoundCue();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [playlistName, setPlaylistName] = useState("");
  const [playlists, setPlaylists] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    const keys = Object.keys(localStorage).filter(k => k.startsWith('playlist_'));
    return keys.map(k => k.replace('playlist_', ''));
  });
  const [isDragging, setIsDragging] = useState(false);

  const addFilesToQueue = (files: FileList) => {
    if (files) {
      const newTracks: Track[] = Array.from(files)
        .filter(file => file.type.startsWith('audio/'))
        .map(file => ({
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
          name: file.name.replace(/\.[^/.]+$/, ""),
          file,
          url: URL.createObjectURL(file),
        }));

      if (newTracks.length === 0) {
        toast({ variant: "destructive", title: "No audio files selected." });
        return;
      }
      
      setQueue(prevQueue => {
          const newQueue = [...prevQueue, ...newTracks];
          if(prevQueue.length === 0 && newQueue.length > 0) {
              // If queue was empty, set the first track.
              // We need a small delay to let the state update.
              setTimeout(() => playTrack(0, false), 0);
          }
          return newQueue;
      });


      toast({ title: "Tracks added", description: `${newTracks.length} tracks added to the queue.` });

      // Get duration for new tracks
      newTracks.forEach(track => {
        const audio = new Audio(track.url);
        audio.onloadedmetadata = () => {
          setQueue(prevQueue => {
            return prevQueue.map(t => 
              t.id === track.id ? { ...t, duration: audio.duration } : t
            );
          });
        };
      });
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    addFilesToQueue(event.target.files!);
    // Reset file input to allow uploading the same file again
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    addFilesToQueue(e.dataTransfer.files);
  };

  const savePlaylist = () => {
    if (!playlistName) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a playlist name." });
      return;
    }
    const trackMetadata = queue.map(t => ({ name: t.name, type: t.file.type, originalName: t.file.name }));
    localStorage.setItem(`playlist_${playlistName}`, JSON.stringify(trackMetadata));
    setPlaylists(prev => [...new Set([...prev, playlistName])]);
    toast({ title: "Playlist Saved", description: `Playlist "${playlistName}" has been saved.` });
    setPlaylistName("");
  };

  const loadPlaylist = (name: string) => {
    toast({ title: "Feature not implemented", description: "Loading playlists with audio files is not yet supported in this demo." });
  };

  const deletePlaylist = (name: string) => {
    localStorage.removeItem(`playlist_${name}`);
    setPlaylists(prev => prev.filter(p => p !== name));
    toast({ title: "Playlist Deleted", description: `Playlist "${name}" has been deleted.` });
  }

  return (
    <div 
      className="h-full flex flex-col bg-card relative"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {isDragging && (
        <div className="absolute inset-0 bg-primary/20 border-2 border-dashed border-primary flex items-center justify-center z-10 pointer-events-none">
          <p className="text-primary font-bold text-lg">Drop audio files here</p>
        </div>
      )}
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold flex items-center gap-2">
            <ListMusic className="w-5 h-5"/>
            Track Queue
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Add
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            accept="audio/mpeg, audio/wav, audio/mp3, audio/ogg"
            className="hidden"
          />
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={!queue.length}>
                <Save className="mr-2 h-4 w-4" /> Save
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Save Playlist</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input id="name" value={playlistName} onChange={(e) => setPlaylistName(e.target.value)} className="col-span-3" placeholder="My Awesome Mix"/>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" onClick={savePlaylist}>Save</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
               <Button variant="outline" size="sm">
                <FolderOpen className="mr-2 h-4 w-4" /> Load
              </Button>
            </DialogTrigger>
            <DialogContent>
               <DialogHeader><DialogTitle>Load Playlist</DialogTitle></DialogHeader>
               <div className="py-4">
                {playlists.length > 0 ? (
                  <ul className="space-y-2">
                    {playlists.map(p => (
                      <li key={p} className="flex justify-between items-center p-2 rounded-md border">
                        <span>{p}</span>
                        <div className="flex gap-2">
                           <Button size="sm" variant="secondary" onClick={() => loadPlaylist(p)}>Load</Button>
                           <DialogClose asChild>
                             <Button size="sm" variant="destructive" onClick={() => deletePlaylist(p)}>Delete</Button>
                           </DialogClose>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-muted-foreground">No saved playlists.</p>}
               </div>
            </DialogContent>
          </Dialog>
         
          <Button variant="destructive" size="sm" onClick={clearQueue} disabled={!queue.length}>
            <Trash2 className="mr-2 h-4 w-4" /> Clear
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        {queue.length > 0 ? (
          <ul className="p-2">
            {queue.map((track, index) => (
              <li
                key={track.id}
                onClick={() => playTrack(index)}
                className={cn(
                  'flex items-center justify-between p-3 rounded-md cursor-pointer hover:bg-muted',
                  index === currentTrackIndex && 'bg-primary/20 text-primary-foreground'
                )}
              >
                <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-6 text-right">{index + 1}.</span>
                    <span className="font-medium">{track.name}</span>
                </div>
                <span className="text-sm text-muted-foreground">{formatDuration(track.duration)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
            <ListMusic className="w-16 h-16 mb-4" />
            <h3 className="text-lg font-semibold">Your queue is empty</h3>
            <p className="text-sm">Click "Add" or drag & drop files to start.</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
