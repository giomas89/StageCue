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

export default function Queue() {
  const { queue, setQueue, currentTrackIndex, playTrack, clearQueue } = useSoundCue();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [playlistName, setPlaylistName] = useState("");
  const [playlists, setPlaylists] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    const keys = Object.keys(localStorage).filter(k => k.startsWith('playlist_'));
    return keys.map(k => k.replace('playlist_', ''));
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newTracks: Track[] = Array.from(files)
        .filter(file => file.type.startsWith('audio/'))
        .map(file => ({
          id: `${file.name}-${file.size}-${file.lastModified}`,
          name: file.name.replace(/\.[^/.]+$/, ""),
          file,
          url: URL.createObjectURL(file),
        }));

      setQueue(prevQueue => {
        const existingIds = new Set(prevQueue.map(t => t.id));
        const uniqueNewTracks = newTracks.filter(t => !existingIds.has(t.id));

        if (uniqueNewTracks.length < newTracks.length) {
            toast({ variant: "default", title: "Duplicate tracks skipped", description: "Some tracks were already in the queue." });
        }

        if (uniqueNewTracks.length > 0) {
             toast({ title: "Tracks added", description: `${uniqueNewTracks.length} tracks added to the queue.` });
        }
        
        return [...prevQueue, ...uniqueNewTracks];
      });
    }
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
    // This is a placeholder. Full implementation requires storing and retrieving Blob/File objects which is complex with localStorage.
    // A real-world app would use IndexedDB for this.
    // For now, it shows the saved playlist names.
  };

  const deletePlaylist = (name: string) => {
    localStorage.removeItem(`playlist_${name}`);
    setPlaylists(prev => prev.filter(p => p !== name));
    toast({ title: "Playlist Deleted", description: `Playlist "${name}" has been deleted.` });
  }

  return (
    <div className="h-full flex flex-col bg-card">
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
                <span className="font-medium">{index + 1}. {track.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
            <ListMusic className="w-16 h-16 mb-4" />
            <h3 className="text-lg font-semibold">Your queue is empty</h3>
            <p className="text-sm">Click "Add" to start building your queue.</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
