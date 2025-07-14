"use client";

import { useState, useEffect, useRef } from 'react';
import { useSoundCue } from '@/hooks/useSoundCue';
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

interface MidiMessage {
  command: number;
  note: number;
  velocity: number;
  timestamp: number;
}

function MidiSettings() {
  const { playTrack, togglePlayPause, playNext, playPrev } = useSoundCue();
  const [midiInputs, setMidiInputs] = useState<WebMidi.MIDIInput[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<MidiMessage | null>(null);

  useEffect(() => {
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess()
        .then(midiAccess => {
          const inputs = Array.from(midiAccess.inputs.values());
          setMidiInputs(inputs);
        })
        .catch(() => {
          console.error("Could not access your MIDI devices.");
        });
    }
  }, []);

  useEffect(() => {
    const selectedInput = midiInputs.find(input => input.id === selectedInputId);

    if (selectedInput) {
      const handleMidiMessage = (event: WebMidi.MIDIMessageEvent) => {
        const [command, note, velocity] = event.data;
        setLastMessage({ command, note, velocity, timestamp: event.timeStamp });
        
        // Basic hardcoded controls for demo
        // Note On event
        if (command === 144 && velocity > 0) {
          switch (note) {
            case 60: // C4
              togglePlayPause();
              break;
            case 62: // D4
              playNext();
              break;
            case 59: // B3
              playPrev();
              break;
            case 48: // C3
              playTrack(0);
              break;
          }
        }
      };
      
      selectedInput.onmidimessage = handleMidiMessage;
      
      return () => {
        if(selectedInput) selectedInput.onmidimessage = null;
      };
    }
  }, [selectedInputId, midiInputs, togglePlayPause, playNext, playPrev, playTrack]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>MIDI Control</CardTitle>
        <CardDescription>Control playback with a MIDI device.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select onValueChange={setSelectedInputId} value={selectedInputId || ""}>
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
              <SelectItem value="none" disabled>No MIDI devices found</SelectItem>
            )}
          </SelectContent>
        </Select>
        <div className="p-4 border rounded-md bg-muted h-32">
            <p className="text-sm font-medium">Last MIDI Message:</p>
            {lastMessage ? (
                <pre className="text-xs text-muted-foreground mt-2">
                    {`Cmd: ${lastMessage.command}, Note: ${lastMessage.note}, Vel: ${lastMessage.velocity}`}
                </pre>
            ) : <p className="text-xs text-muted-foreground mt-2">Waiting for message...</p>}
            <p className="text-xs text-muted-foreground mt-4">Note On C4 (60): Play/Pause</p>
        </div>
      </CardContent>
    </Card>
  );
}

function OscSettings() {
    const { toast } = useToast();
    return (
        <Card>
            <CardHeader>
                <CardTitle>OSC Control</CardTitle>
                <CardDescription>Control playback via OSC messages.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Direct OSC control from a web browser is not possible without a bridge application. Configure your OSC bridge to send messages to this application.</p>
                <div className="space-y-2">
                    <Label htmlFor="osc-ip">OSC Bridge IP Address</Label>
                    <Input id="osc-ip" placeholder="e.g., 127.0.0.1" />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="osc-port">OSC Bridge Port</Label>
                    <Input id="osc-port" type="number" placeholder="e.g., 9000" />
                </div>
                <Button onClick={() => toast({title: "Info", description: "This is a placeholder UI."})}>Connect</Button>
            </CardContent>
        </Card>
    );
}

function GeneralSettings() {
    const { settings, setSettings } = useSoundCue();
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
                    const importedSettings = JSON.parse(text as string);
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
    )
}

export default function SettingsPanel() {
  return (
    <Tabs defaultValue="midi" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="midi">MIDI</TabsTrigger>
        <TabsTrigger value="osc">OSC</TabsTrigger>
        <TabsTrigger value="general">General</TabsTrigger>
      </TabsList>
      <TabsContent value="midi" className="mt-4">
        <MidiSettings />
      </TabsContent>
      <TabsContent value="osc" className="mt-4">
        <OscSettings />
      </TabsContent>
       <TabsContent value="general" className="mt-4">
        <GeneralSettings />
      </TabsContent>
    </Tabs>
  );
}
