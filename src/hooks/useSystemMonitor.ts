"use client";

import { useState, useEffect } from 'react';

interface SystemStats {
  cpu: number;
}

export function useSystemMonitor() {
  const [stats, setStats] = useState<SystemStats>({ cpu: 0 });

  useEffect(() => {
    const updateStats = async () => {
      try {
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
          const processStats = await (window as any).electronAPI.getProcessStats();
          setStats({
            cpu: Math.round(processStats.cpu)
          });
        } else {
          setStats({ cpu: 0 });
        }
      } catch (error) {
        console.error('Error getting process stats:', error);
      }
    };
    
    updateStats();
    const interval = setInterval(updateStats, 2000);
    
    return () => clearInterval(interval);
  }, []);

  return stats;
}