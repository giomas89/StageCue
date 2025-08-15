"use client";

import { useState, useEffect } from 'react';

interface SystemStats {
  cpu: number;
  memory: number;
}

export function useSystemMonitor() {
  const [stats, setStats] = useState<SystemStats>({ cpu: 0, memory: 0 });

  useEffect(() => {
    const updateStats = async () => {
      try {
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
          const processStats = await (window as any).electronAPI.getProcessStats();
          setStats({
            cpu: Math.round(processStats.cpu),
            memory: Math.round(processStats.memory)
          });
        } else {
          // Fallback per browser
          const memoryInfo = (performance as any).memory;
          let memoryUsage = 0;
          if (memoryInfo) {
            memoryUsage = Math.round((memoryInfo.usedJSHeapSize / (1024 * 1024 * 100)) * 100); // ~100MB base
          }
          setStats({ cpu: 0, memory: memoryUsage });
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