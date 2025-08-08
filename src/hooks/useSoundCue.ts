"use client";

import { useContext } from 'react';
import { StageCueContext } from '@/contexts/SoundCueContext';

export const useStageCue = () => {
  const context = useContext(StageCueContext);
  if (context === undefined) {
    throw new Error('useStageCue must be used within a StageCueProvider');
  }
  return context;
};

// Manteniamo anche l'alias per compatibilità
export const useSoundCue = useStageCue;
