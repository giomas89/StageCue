
"use client";

import { useRef, useState, useEffect } from 'react';
import { useSoundCue } from '@/hooks/useSoundCue';
import type { Track } from '@/types';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Upload, Trash2, Save, FolderOpen, ListMusic, GripVertical } from 'lucide-react';
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
import { DragDropContext, Droppable, Draggable, type DropResult, type DroppableProps } from 'react-beautiful-dnd';


const formatDuration = (seconds: number | undefined) => {
    if (seconds === undefined || isNaN(seconds)) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

const isBrowser = typeof window !== 'undefined';

export default function Queue() {
  const { queue, setQueue, currentTrackIndex, playTrack, clearQueue, reorderQueue, isShuffled, selectedIndex, setSelectedIndex } = useSoundCue();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [playlistName, setPlaylistName] = useState("playlist");
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
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
          const updatedQueue = [...prevQueue, ...newTracks];
          
          updatedQueue.forEach(track => {
              if (!track.duration) {
                  const audio = new Audio();
                  audio.src = track.url;
                  audio.onloadedmetadata = () => {
                      setQueue(current => current.map(t => 
                          t.id === track.id ? { ...t, duration: audio.duration } : t
                      ));
                  };
              }
          });

          return updatedQueue;
      });

      toast({ title: "Tracks added", description: `${newTracks.length} tracks added to the queue.` });
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      addFilesToQueue(event.target.files);
    }
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  const savePlaylist = () => {
    if (!playlistName) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a playlist name." });
      return;
    }
    const m3uContent = "#EXTM3U\n" + queue.map(t => `#EXTINF:${Math.round(t.duration || 0)},${t.name}\n${t.file.name}`).join('\n');
    const blob = new Blob([m3uContent], { type: 'audio/x-mpegurl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${playlistName}.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Playlist Saved", description: `Playlist "${playlistName}.m3u" has been saved.` });
  };

  const handleLoadPlaylist = () => {
     toast({ title: "Feature not fully supported", description: "Due to browser security, audio files cannot be loaded automatically from an M3U file. Please add files manually." });
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination || isShuffled) {
      return;
    }
    reorderQueue(result.source.index, result.destination.index);
  };


  return (
    <div 
      className="h-full flex flex-col bg-card relative"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {isDraggingOver && (
        <div className="absolute inset-0 bg-primary/20 border-2 border-dashed border-primary flex items-center justify-center z-10 pointer-events-none">
          <p className="text-primary font-bold text-lg">Drop audio files here</p>
        </div>
      )}
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold flex items-center gap-2">
            <ListMusic className="w-5 h-5"/>
            Playlist
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
              <DialogHeader><DialogTitle>Save Playlist as M3U</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">File Name</Label>
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

          <Button variant="outline" size="sm" onClick={handleLoadPlaylist}>
            <FolderOpen className="mr-2 h-4 w-4" /> Load M3U
          </Button>
         
          <Button variant="destructive" size="sm" onClick={clearQueue} disabled={!queue.length}>
            <Trash2 className="mr-2 h-4 w-4" /> Clear
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <DragDropContext onDragEnd={onDragEnd}>
            {isBrowser && <Droppable droppableId="playlist" isDropDisabled={isShuffled}>
                {(provided) => (
                    <ul className="p-2" {...provided.droppableProps} ref={provided.innerRef}>
                    {queue.length > 0 ? (
                        queue.map((track, index) => (
                        <Draggable key={track.id} draggableId={track.id} index={index} isDragDisabled={isShuffled}>
                            {(provided, snapshot) => (
                            <li
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                onClick={() => setSelectedIndex(index)}
                                onDoubleClick={() => playTrack(index, true)}
                                className={cn(
                                'flex items-center justify-between p-3 rounded-md group',
                                index === currentTrackIndex ? 'bg-primary/20' : (index === selectedIndex ? 'bg-muted' : 'hover:bg-muted'),
                                snapshot.isDragging && 'bg-accent shadow-lg'
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div {...provided.dragHandleProps}>
                                        <GripVertical 
                                        className={cn(
                                            "w-5 h-5 text-muted-foreground/50 transition-opacity group-hover:opacity-100",
                                            isShuffled ? 'cursor-not-allowed opacity-25' : 'cursor-grab'
                                        )}
                                        />
                                    </div>
                                    <span className="text-sm text-muted-foreground w-6 text-right">{index + 1}.</span>
                                    <span className="font-medium cursor-default">{track.name}</span>
                                </div>
                                <span className="text-sm text-muted-foreground cursor-default">{formatDuration(track.duration)}</span>
                            </li>
                            )}
                        </Draggable>
                        ))
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center" style={{height: 'calc(100vh - 250px)'}}>
                            <ListMusic className="w-16 h-16 mb-4" />
                            <h3 className="text-lg font-semibold">Your playlist is empty</h3>
                            <p className="text-sm">Click "Add" or drag & drop files to start.</p>
                        </div>
                    )}
                    {provided.placeholder}
                    </ul>
                )}
            </Droppable>}
        </DragDropContext>
      </ScrollArea>
    </div>
  );
}

    