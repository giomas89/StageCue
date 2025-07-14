
"use client";

import { useState, useEffect, useRef } from 'react';
import { useSoundCue } from '@/hooks/useSoundCue';
import type { MidiCommand } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Info, Timer, Volume2 } from 'lucide-react';

interface MidiMessage {
  command: number;
  note: number;
  velocity: number;
  timestamp: number;
  type: 'Note On' | 'Note Off' | 'Control Change' | 'Unknown';
}

const COMMAND_LABELS: Record<MidiCommand, string> = {
    togglePlayPause: 'Play / Pause',
    stopPlayback: 'Stop',
    playNext: 'Next Track',
    playPrev: 'Previous Track',
    skipForward: 'Skip Forward 10s',
    skipBackward: 'Skip Backward 10s'
}

const COMMAND_ORDER: MidiCommand[] = [
    'togglePlayPause',
    'stopPlayback',
    'playNext',
    'playPrev',
    'skipForward',
    'skipBackward'
];


function MidiSettings() {
  const { settings, setSettings, playTrack, togglePlayPause, playNext, playPrev, stopPlayback, skipForward, skipBackward } = useSoundCue();
  const [midiInputs, setMidiInputs] = useState<WebMidi.MIDIInput[]>([]);
  const [lastMessages, setLastMessages] = useState<MidiMessage[]>([]);
  const [learningCommand, setLearningCommand] = useState<MidiCommand | null>(null);
  const { toast } = useToast();

  const selectedInputId = settings.midi.inputId;

  const handleSelectMidiInput = (id: string) => {
    if (id === 'no-devices') return;
    setSettings(s => ({...s, midi: {...s.midi, inputId: id}}));
  };
  
  const midiCommandActions: Record<MidiCommand, () => void> = {
    togglePlayPause,
    playNext,
    playPrev,
    stopPlayback,
    skipForward,
    skipBackward,
  };

  useEffect(() => {
    const requestMidi = async () => {
        try {
            if (navigator.requestMIDIAccess) {
                const midiAccess = await navigator.requestMIDIAccess();
                const inputs = Array.from(midiAccess.inputs.values());
                setMidiInputs(inputs);
            }
        } catch(e) {
            console.error("Could not access your MIDI devices.", e);
            toast({ variant: "destructive", title: "MIDI Error", description: "Could not access MIDI devices." });
        }
    }
    requestMidi();
  }, [toast]);

  useEffect(() => {
    midiInputs.forEach(input => {
      input.onmidimessage = null;
    });

    const selectedInput = midiInputs.find(input => input.id === selectedInputId);

    if (selectedInput) {
      const handleMidiMessage = (event: WebMidi.MIDIMessageEvent) => {
        const [command, note, velocity] = event.data;
        
        let type: MidiMessage['type'] = 'Unknown';
        if (command >= 144 && command <= 159) type = 'Note On';
        else if (command >= 128 && command <= 143) type = 'Note Off';
        else if (command >= 176 && command <= 191) type = 'Control Change';

        const newMessage: MidiMessage = { command, note, velocity, timestamp: event.timeStamp, type };
        setLastMessages(prev => [newMessage, ...prev.slice(0, 49)]);
        
        if (type === 'Note On' && velocity > 0) {
            if (learningCommand) {
                setSettings(s => ({
                    ...s,
                    midi: {
                        ...s.midi,
                        mappings: { ...s.midi.mappings, [learningCommand]: note }
                    }
                }));
                toast({ title: "MIDI Learned", description: `Assigned Note ${note} to ${COMMAND_LABELS[learningCommand]}`});
                setLearningCommand(null);
            } else {
                const commandToTrigger = (Object.keys(settings.midi.mappings) as MidiCommand[]).find(
                    cmd => settings.midi.mappings[cmd] === note
                );

                if(commandToTrigger) {
                    const action = midiCommandActions[commandToTrigger];
                    if (action) action();
                }
            }
        }
      };
      
      selectedInput.onmidimessage = handleMidiMessage;
      
      return () => {
        if(selectedInput) selectedInput.onmidimessage = null;
      };
    }
  }, [selectedInputId, midiInputs, settings.midi.mappings, setSettings, learningCommand, toast, midiCommandActions, playTrack]);
  
  const formatMidiNote = (note: number | null | undefined) => {
    if (note === null || note === undefined) return 'N/A';
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(note / 12) - 1;
    const name = noteNames[note % 12];
    return `${name}${octave} (${note})`;
  }

  return (
    <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="mapping">Mapping</TabsTrigger>
            <TabsTrigger value="monitor">Monitor</TabsTrigger>
        </TabsList>
        <TabsContent value="config" className="mt-4">
             <Card>
                <CardHeader>
                    <CardTitle>MIDI Input Device</CardTitle>
                    <CardDescription>Select a MIDI device to control playback.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Select onValueChange={handleSelectMidiInput} value={selectedInputId || "no-devices"}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a MIDI input" />
                    </SelectTrigger>
                    <SelectContent>
                        {midiInputs.length > 0 ? (
                        midiInputs.map(input => (
                            <SelectItem key={input.id} value={input.id}>
                            {input.name}
                            </SelectItem>
                        ))
                        ) : (
                        <SelectItem value="no-devices" disabled>No MIDI devices found</SelectItem>
                        )}
                    </SelectContent>
                    </Select>
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="mapping" className="mt-4">
            <Card>
                <CardHeader>
                    <CardTitle>MIDI Note Mapping</CardTitle>
                    <CardDescription>Assign MIDI notes to player commands. Click "Learn" then press a key on your MIDI device.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Command</TableHead>
                                <TableHead>Assigned Note</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {COMMAND_ORDER.map(cmd => (
                            <TableRow key={cmd}>
                                <TableCell className="font-medium">{COMMAND_LABELS[cmd]}</TableCell>
                                <TableCell><code>{formatMidiNote(settings.midi.mappings[cmd])}</code></TableCell>
                                <TableCell className="text-right">
                                    <Button 
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setLearningCommand(cmd)}
                                        disabled={!selectedInputId}
                                        className={cn(learningCommand === cmd && "bg-destructive text-destructive-foreground")}
                                    >
                                        {learningCommand === cmd ? 'Listening...' : 'Learn'}
                                    </Button>
                                </TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="monitor" className="mt-4">
            <Card>
                <CardHeader>
                    <CardTitle>MIDI Monitor</CardTitle>
                    <CardDescription>Displays the last 50 MIDI messages received from the selected device.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-48 w-full rounded-md border">
                        <div className="p-4 font-mono text-xs">
                        {lastMessages.length > 0 ? (
                            lastMessages.map((msg, index) => (
                                <p key={`${msg.timestamp}-${index}`}>
                                    <span className="text-muted-foreground">[{msg.type}]</span>{' '}
                                    Cmd: {msg.command}, Note: {msg.note}, Vel: {msg.velocity}
                                </p>
                            ))
                        ) : <p className="text-muted-foreground">Waiting for messages...</p>}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </TabsContent>
    </Tabs>
  );
}

function OscSettings() {
    const { settings, setSettings } = useSoundCue();
    
    const oscCommands = [
        { command: "Play", address: "/soundcue/play" },
        { command: "Pause", address: "/soundcue/pause" },
        { command: "Stop", address: "/soundcue/stop" },
        { command: "Next", address: "/soundcue/next" },
        { command: "Previous", address: "/soundcue/prev" },
        { command: "Play Track", address: "/soundcue/play/{track_index}" },
    ];

    return (
        <Tabs defaultValue="config" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="config">Configuration</TabsTrigger>
                <TabsTrigger value="mapping">Mapping</TabsTrigger>
                <TabsTrigger value="monitor">Monitor</TabsTrigger>
            </TabsList>
             <TabsContent value="config" className="mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle>OSC Configuration</CardTitle>
                        <CardDescription>Configure the connection to your OSC bridge application.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="osc-ip">OSC Bridge IP Address</Label>
                            <Input 
                                id="osc-ip"
                                value={settings.osc.ip}
                                onChange={(e) => setSettings(s => ({...s, osc: {...s.osc, ip: e.target.value}}))}
                                placeholder="e.g., 127.0.0.1" 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="osc-port">OSC Bridge Port</Label>
                            <Input 
                                id="osc-port"
                                type="number" 
                                value={settings.osc.port}
                                onChange={(e) => setSettings(s => ({...s, osc: {...s.osc, port: Number(e.target.value)}}))}
                                placeholder="e.g., 9000" 
                            />
                        </div>
                        <Button disabled>Connect</Button>
                        <Alert>
                          <Info className="h-4 w-4" />
                          <AlertTitle>Info</AlertTitle>
                          <AlertDescription>
                            This functionality requires a separate OSC bridge application. Direct OSC listening is not possible in web browsers for security reasons.
                          </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="mapping" className="mt-4">
                 <Card>
                    <CardHeader>
                        <CardTitle>Available OSC Commands</CardTitle>
                        <CardDescription>
                            Here are the OSC addresses to control the player.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Command</TableHead>
                                    <TableHead>Address</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {oscCommands.map(cmd => (
                                    <TableRow key={cmd.address}>
                                        <TableCell className="font-medium">{cmd.command}</TableCell>
                                        <TableCell><code>{cmd.address}</code></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="monitor" className="mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle>OSC Monitor</CardTitle>
                    </CardHeader>
                     <CardContent>
                         <Alert>
                          <Info className="h-4 w-4" />
                          <AlertTitle>Info</AlertTitle>
                          <AlertDescription>
                            This monitor will display messages received from your OSC bridge application once it's connected and sending data.
                          </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    );
}

function GeneralSettings() {
    const { settings, setSettings, audioOutputs, selectedAudioOutputId, setAudioOutput } = useSoundCue();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [maxVolumeLevel, setMaxVolumeLevel] = useState(settings.audio.maxVolume.level);
    
     useEffect(() => {
        setMaxVolumeLevel(settings.audio.maxVolume.level);
    }, [settings.audio.maxVolume.level]);

    const handleMaxVolEnabledChange = (checked: boolean) => {
        setSettings(s => ({...s, audio: {...s.audio, maxVolume: {...s.audio.maxVolume, enabled: checked }}}));
    };
    
    const handleMaxVolValueChange = (value: number) => {
        setMaxVolumeLevel(value);
        setSettings(s => ({...s, audio: {...s.audio, maxVolume: {...s.audio.maxVolume, level: value}}}));
    };


    const exportSettings = () => {
        const settingsJson = JSON.stringify(settings, null, 2);
        const blob = new Blob([settingsJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'soundcue-settings.json';
        a.click();
        URL.revokeObjectURL(url);
        toast({title: "Settings Exported"});
    }

    const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target?.result;
                    if (typeof text !== 'string') throw new Error("File could not be read");
                    const importedSettings = JSON.parse(text);
                    setSettings(importedSettings);
                    toast({title: "Settings Imported"});
                } catch (error) {
                    toast({variant: "destructive", title: "Import Failed", description: "Invalid settings file."});
                }
            };
            reader.readAsText(file);
        }
    }

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label className="text-base font-semibold">Audio Output</Label>
                <p className="text-sm text-muted-foreground">Choose where to play the audio.</p>
                <Select onValueChange={setAudioOutput} value={selectedAudioOutputId || 'default'}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select an audio output" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="default">Default System Output</SelectItem>
                        {audioOutputs.map(output => (
                            <SelectItem key={output.deviceId} value={output.deviceId}>
                                {output.label || `Output ${output.deviceId.substring(0,6)}`}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-3">
                 <Label className="text-base font-semibold">Audio Effects</Label>
                 <p className="text-sm text-muted-foreground">Configure fade-in and fade-out effects.</p>
                <div className="space-y-4">
                    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4">
                        <Switch
                            id="fadein-enabled"
                            checked={settings.audio.fadeIn.enabled}
                            onCheckedChange={(checked) => setSettings(s => ({...s, audio: {...s.audio, fadeIn: {...s.audio.fadeIn, enabled: checked }}}))}
                            aria-label="Toggle Fade-in"
                        />
                        <Label htmlFor="fadein-duration" className={cn("text-sm", !settings.audio.fadeIn.enabled && "text-muted-foreground/50")}>
                            Fade-in Duration
                        </Label>
                        <div className={cn("relative w-24", !settings.audio.fadeIn.enabled && "opacity-50")}>
                            <Timer className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="fadein-duration"
                                type="number"
                                min="0.1"
                                step="0.1"
                                value={settings.audio.fadeIn.duration}
                                onChange={(e) => setSettings(s => ({...s, audio: {...s.audio, fadeIn: {...s.audio.fadeIn, duration: Math.max(0.1, Number(e.target.value)) }}}))}
                                disabled={!settings.audio.fadeIn.enabled}
                                className="pl-8 text-center"
                            />
                             <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">s</span>
                        </div>
                    </div>
                     <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4">
                        <Switch
                            id="fadeout-enabled"
                            checked={settings.audio.fadeOut.enabled}
                            onCheckedChange={(checked) => setSettings(s => ({...s, audio: {...s.audio, fadeOut: {...s.audio.fadeOut, enabled: checked }}}))}
                            aria-label="Toggle Fade-out"
                        />
                        <Label htmlFor="fadeout-duration" className={cn("text-sm", !settings.audio.fadeOut.enabled && "text-muted-foreground/50")}>
                            Fade-out Duration
                        </Label>
                        <div className={cn("relative w-24", !settings.audio.fadeOut.enabled && "opacity-50")}>
                             <Timer className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="fadeout-duration"
                                type="number"
                                min="0.1"
                                step="0.1"
                                value={settings.audio.fadeOut.duration}
                                onChange={(e) => setSettings(s => ({...s, audio: {...s.audio, fadeOut: {...s.audio.fadeOut, duration: Math.max(0.1, Number(e.target.value)) }}}))}
                                disabled={!settings.audio.fadeOut.enabled}
                                className="pl-8 text-center"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">s</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                 <Label className="text-base font-semibold">Volume Control</Label>
                 <p className="text-sm text-muted-foreground">Set a maximum volume limit for the player.</p>
                 <div className="space-y-4">
                     <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4">
                        <Switch
                            id="maxvolume-enabled"
                            checked={settings.audio.maxVolume.enabled}
                            onCheckedChange={handleMaxVolEnabledChange}
                            aria-label="Toggle Maximum Volume"
                        />
                        <Label htmlFor="maxvolume-level" className={cn("text-sm", !settings.audio.maxVolume.enabled && "text-muted-foreground/50")}>
                            Maximum Volume
                        </Label>
                        <div className={cn("relative w-24", !settings.audio.maxVolume.enabled && "opacity-50")}>
                            <Volume2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="maxvolume-level-input"
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                value={maxVolumeLevel}
                                onChange={(e) => handleMaxVolValueChange(Math.max(0, Math.min(100, Number(e.target.value))))}
                                disabled={!settings.audio.maxVolume.enabled}
                                className="pl-8 text-center"
                            />
                             <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                        </div>
                     </div>
                    <div className={cn("col-span-3", !settings.audio.maxVolume.enabled && "opacity-50 pointer-events-none")}>
                        <Slider
                            value={[maxVolumeLevel]}
                            onValueChange={(value) => handleMaxVolValueChange(value[0])}
                            max={100}
                            step={1}
                            disabled={!settings.audio.maxVolume.enabled}
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-base font-semibold">App Settings</Label>
                <p className="text-sm text-muted-foreground">Export or import your application settings.</p>
                <div className="flex gap-4">
                    <Button onClick={exportSettings}>Export Settings</Button>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Import Settings</Button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={importSettings}
                        accept="application/json"
                        className="hidden"
                        />
                </div>
            </div>
        </div>
    )
}

export default function SettingsPanel() {
  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="midi">MIDI</TabsTrigger>
        <TabsTrigger value="osc">OSC</TabsTrigger>
      </TabsList>
      <TabsContent value="general" className="mt-4">
        <GeneralSettings />
      </TabsContent>
      <TabsContent value="midi" className="mt-4">
        <MidiSettings />
      </TabsContent>
       <TabsContent value="osc" className="mt-4">
        <OscSettings />
      </TabsContent>
    </Tabs>
  );
}
