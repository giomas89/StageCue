# SoundCue - Modern Audio Player

SoundCue is a sophisticated audio playback application designed for creators, musicians, and live performers. Built with Next.js and leveraging modern web technologies, it offers precise control over audio queues, MIDI integration, and a clean, intuitive user interface.

![SoundCue Application Screenshot](https://placehold.co/800x500.png?text=SoundCue+App+UI)

## ✨ Features
- **Playlist Management**: Easily add audio files (MP3, WAV, etc.) via drag-and-drop or file selection. Save and load playlists in M3U format.
- **Advanced Playback Controls**: Play, pause, stop, skip tracks, and seek through audio with precision.
- **Audio Effects**: Configure fade-in and fade-out effects for smooth transitions.
- **Volume Limiter**: Set a maximum volume level to protect your hearing and equipment.
- **Keyboard Shortcuts**: Control playback without taking your hands off the keyboard.
- **MIDI Control**: Map playback functions (play/pause, next, stop, etc.) to your MIDI controller for hands-free operation.
- **Device Output Selection**: Choose the specific audio output device for playback.
- **Responsive Design**: A clean, dark-themed interface that works beautifully on any screen size.
- **Persistent Settings**: All your configurations, from MIDI mappings to audio settings, are automatically saved in your browser.

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (with App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [ShadCN UI](https://ui.shadcn.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **State Management**: React Context API
- **AI Integration**: [Genkit](https://firebase.google.com/docs/genkit) (for potential future AI features)

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

You need to have [Node.js](https://nodejs.org/) (version 18 or later) and npm installed on your machine.

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/your-username/soundcue.git
    cd soundcue
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

### Running the Development Server

To start the application in development mode, run the following command:

```bash
npm run dev
```

Open [http://localhost:9002](http://localhost:9002) with your browser to see the result. The application will automatically reload if you change any of the source files.

## 🎹 Usage

1.  **Add Tracks**: Drag and drop audio files onto the playlist area or use the "Add" button.
2.  **Control Playback**: Use the main player controls at the top of the application.
3.  **Configure Settings**: Click on the "Settings & Controls" panel to:
    -   Select your audio output device.
    -   Configure fade-in/fade-out effects.
    -   Set up MIDI mappings by selecting your device, clicking "Learn" next to a command, and pressing the desired key on your controller.
4.  **Use Keyboard Shortcuts**:
    -   `Spacebar`: Play/Pause
    -   `ArrowRight`: Next Track
    -   `ArrowLeft`: Previous Track
    -   `S`: Stop
    -   `L`: Skip Forward 10s
    -   `J`: Skip Backward 10s
