"use client";

import { useContext } from 'react';
import { SoundCueContext } from '@/contexts/SoundCueContext';

export const useSoundCue = () => {
  const context = useContext(SoundCueContext);
  if (context === undefined) {
    throw new Error('useSoundCue must be used within a SoundCueProvider');
  }
  return context;
};
