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
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';

interface MidiMessage {
  command: number;
  note: number;
  velocity: number;
  timestamp: number;
  type: 'Note On' | 'Note Off' | 'Control Change' | 'Unknown';
}

const COMMAND_LABELS: Record<MidiCommand, string> = {
    togglePlayPause: 'Play / Pause',
    playNext: 'Next Track',
    playPrev: 'Previous Track',
    stopPlayback: 'Stop',
    skipForward: 'Skip Forward 10s',
    skipBackward: 'Skip Backward 10s'
}

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
        }
    }
    requestMidi();
  }, []);

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
        
        // Note On event
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
                 // Trigger command based on mapping
                const commandToTrigger = (Object.keys(settings.midi.mappings) as MidiCommand[]).find(
                    cmd => settings.midi.mappings[cmd] === note
                );

                if(commandToTrigger) {
                    const action = midiCommandActions[commandToTrigger];
                    if (action) action();
                    else if (commandToTrigger.startsWith('playTrack_')) {
                        const index = parseInt(commandToTrigger.split('_')[1], 10);
                        playTrack(index);
                    }
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
  
  const formatMidiNote = (note: number | null) => {
    if (note === null) return 'N/A';
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(note / 12) - 1;
    const name = noteNames[note % 12];
    return `${name}${octave} (${note})`;
  }

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>MIDI Configuration</CardTitle>
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
        <Card>
            <CardHeader>
                <CardTitle>MIDI Mapping</CardTitle>
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
                        {(Object.keys(COMMAND_LABELS) as MidiCommand[]).map(cmd => (
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
         <Card>
            <CardHeader>
                <CardTitle>MIDI Monitor</CardTitle>
                <CardDescription>Displays the last 50 MIDI messages received.</CardDescription>
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
    </div>
  );
}

function OscSettings() {
    const { toast } = useToast();
    const [oscMessages, setOscMessages] = useState<{timestamp: string, address: string, args: string}[]>([]);
    
    // This is a mock. Real OSC would require a WebSocket bridge.
    useEffect(() => {
        const mockInterval = setInterval(() => {
             const commands = [
                { address: "/soundcue/play", args: ""},
                { address: "/soundcue/stop", args: ""},
                { address: "/soundcue/play", args: "3"},
             ];
             const randomCommand = commands[Math.floor(Math.random()*commands.length)];
             const newMessage = {
                timestamp: new Date().toLocaleTimeString(),
                address: randomCommand.address,
                args: randomCommand.args
             }
             setOscMessages(prev => [newMessage, ...prev.slice(0, 49)]);
        }, 5000);

        toast({title: "OSC Demo", description: "OSC monitor is showing mock data. Full OSC control requires a bridge application.", duration: 5000});

        return () => clearInterval(mockInterval);
    }, [toast]);


    const oscCommands = [
        { command: "Play", address: "/soundcue/play" },
        { command: "Pause", address: "/soundcue/pause" },
        { command: "Stop", address: "/soundcue/stop" },
        { command: "Next", address: "/soundcue/next" },
        { command: "Previous", address: "/soundcue/prev" },
        { command: "Play Track", address: "/soundcue/play {track_index}" },
    ];

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>OSC Configuration</CardTitle>
                    <CardDescription>Configure the connection to your OSC bridge application.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="osc-ip">OSC Bridge IP Address</Label>
                        <Input id="osc-ip" placeholder="e.g., 127.0.0.1" defaultValue="127.0.0.1" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="osc-port">OSC Bridge Port</Label>
                        <Input id="osc-port" type="number" placeholder="e.g., 9000" defaultValue="9000" />
                    </div>
                    <Button onClick={() => toast({title: "Info", description: "This is a placeholder UI."})}>Connect</Button>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Available OSC Commands (Mapping)</CardTitle>
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
             <Card>
                <CardHeader>
                    <CardTitle>OSC Monitor</CardTitle>
                    <CardDescription>Displays incoming OSC messages from the bridge.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-48 w-full rounded-md border">
                        <div className="p-4 font-mono text-xs">
                        {oscMessages.length > 0 ? (
                            oscMessages.map((msg, index) => (
                                <p key={`${msg.timestamp}-${index}`}>
                                    <span className="text-muted-foreground">[{msg.timestamp}]</span>{' '}
                                    {msg.address} <span className="text-primary">{msg.args}</span>
                                </p>
                            ))
                        ) : <p className="text-muted-foreground">Waiting for messages...</p>}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}

function GeneralSettings() {
    const { settings, setSettings, audioOutputs, selectedAudioOutputId, setAudioOutput } = useSoundCue();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

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
                    // Add validation here if needed
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
            <Card>
                <CardHeader>
                    <CardTitle>Audio Output</CardTitle>
                    <CardDescription>Choose where to play the audio.</CardDescription>
                </CardHeader>
                <CardContent>
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
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>App Settings</CardTitle>
                    <CardDescription>Export or import your application settings.</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-4">
                    <Button onClick={exportSettings}>Export Settings</Button>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Import Settings</Button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={importSettings}
                        accept="application/json"
                        className="hidden"
                        />
                </CardContent>
            </Card>
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
