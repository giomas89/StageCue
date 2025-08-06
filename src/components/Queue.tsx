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

// Importazioni per @dnd-kit
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const formatDuration = (seconds: number | undefined) => {
    if (seconds === undefined || isNaN(seconds)) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

// Componente per ogni singolo elemento draggable
function SortableTrackItem({ 
    track, 
    index, 
    isCurrentTrack, 
    isSelected, 
    onSelect, 
    onPlay, 
    isDisabled 
}: {
    track: Track;
    index: number;
    isCurrentTrack: boolean;
    isSelected: boolean;
    onSelect: () => void;
    onPlay: () => void;
    isDisabled: boolean;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: track.id,
        disabled: isDisabled,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <li
            ref={setNodeRef}
            style={style}
            onClick={onSelect}
            onDoubleClick={onPlay}
            className={cn(
                'flex items-center justify-between p-3 rounded-md group transition-colors',
                isCurrentTrack ? 'bg-primary/20' : (isSelected ? 'bg-muted' : 'hover:bg-muted'),
                isDragging && 'opacity-50',
                isDisabled && 'opacity-60'
            )}
        >
            <div className="flex items-center gap-3">
                <div
                    {...attributes}
                    {...listeners}
                    className={cn(
                        "flex items-center justify-center",
                        isDisabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
                    )}
                >
                    <GripVertical
                        className={cn(
                            "w-5 h-5 text-muted-foreground/50 transition-opacity group-hover:opacity-100",
                            isDisabled ? 'opacity-25' : ''
                        )}
                    />
                </div>
                <span className="text-sm text-muted-foreground w-6 text-right">{index + 1}.</span>
                <span className="font-medium cursor-default">{track.name}</span>
            </div>
            <span className="text-sm text-muted-foreground cursor-default">
                {formatDuration(track.duration)}
            </span>
        </li>
    );
}

export default function Queue() {
    const { 
        queue, 
        setQueue, 
        currentTrackIndex, 
        playTrack, 
        clearQueue, 
        reorderQueue, 
        isShuffled, 
        selectedIndex, 
        setSelectedIndex 
    } = useSoundCue();
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const [playlistName, setPlaylistName] = useState("playlist");
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);

    // Sensori per il drag & drop
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

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
        if (fileInputRef.current) {
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
        // Genera il nome file con timestamp
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const fileName = `stagecue-${year}${month}${day}-${hours}${minutes}.m3u`;

        const m3uContent = "#EXTM3U\n" + queue.map(t => `#EXTINF:${Math.round(t.duration || 0)},${t.name}\n${t.file.name}`).join('\n');
        const blob = new Blob([m3uContent], { type: 'audio/x-mpegurl' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: "Playlist Saved", description: `Playlist "${fileName}" has been saved.` });
    };

    const handleLoadPlaylist = () => {
        toast({ title: "Feature not fully supported", description: "Due to browser security, audio files cannot be loaded automatically from an M3U file. Please add files manually." });
    };

    // Gestione del drag start
    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    // Gestione del drag end
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (active.id !== over?.id && !isShuffled) {
            const oldIndex = queue.findIndex(track => track.id === active.id);
            const newIndex = queue.findIndex(track => track.id === over?.id);
            
            if (oldIndex !== -1 && newIndex !== -1) {
                reorderQueue(oldIndex, newIndex);
            }
        }
    };

    // Trova il track attivo per il DragOverlay
    const activeTrack = activeId ? queue.find(track => track.id === activeId) : null;

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
                    <ListMusic className="w-5 h-5" />
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
                    <Button variant="outline" size="sm" disabled={!queue.length} onClick={savePlaylist}>
                        <Save className="mr-2 h-4 w-4" /> Save
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleLoadPlaylist}>
                        <FolderOpen className="mr-2 h-4 w-4" /> Load M3U
                    </Button>
                    <Button variant="destructive" size="sm" onClick={clearQueue} disabled={!queue.length}>
                        <Trash2 className="mr-2 h-4 w-4" /> Clear
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext 
                        items={queue.map(track => track.id)} 
                        strategy={verticalListSortingStrategy}
                    >
                        <ul className="p-2">
                            {queue.length > 0 ? (
                                queue.map((track, index) => (
                                    <SortableTrackItem
                                        key={track.id}
                                        track={track}
                                        index={index}
                                        isCurrentTrack={index === currentTrackIndex}
                                        isSelected={index === selectedIndex}
                                        onSelect={() => setSelectedIndex(index)}
                                        onPlay={() => playTrack(index, true)}
                                        isDisabled={isShuffled}
                                    />
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center" style={{ height: 'calc(100vh - 250px)' }}>
                                    <ListMusic className="w-16 h-16 mb-4" />
                                    <h3 className="text-lg font-semibold">Your playlist is empty</h3>
                                    <p className="text-sm">Click "Add" or drag & drop files to start.</p>
                                </div>
                            )}
                        </ul>
                    </SortableContext>
                    
                    <DragOverlay>
                        {activeTrack ? (
                            <div className="flex items-center justify-between p-3 rounded-md bg-accent shadow-lg opacity-90">
                                <div className="flex items-center gap-3">
                                    <GripVertical className="w-5 h-5 text-muted-foreground" />
                                    <span className="font-medium">{activeTrack.name}</span>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                    {formatDuration(activeTrack.duration)}
                                </span>
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </ScrollArea>
        </div>
    );
}