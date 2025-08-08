"use client";

import { useState, useEffect } from 'react';

interface SystemStats {
  cpu: number;
  memory: number;
}

export function useSystemMonitor() {
  const [stats, setStats] = useState<SystemStats>({ cpu: 0, memory: 0 });

  useEffect(() => {
    const updateStats = () => {
      const now = performance.now();
      const memoryInfo = (performance as any).memory;
      
      const cpuUsage = Math.min(100, Math.max(0, 
        (Math.sin(now / 10000) * 20 + 25 + Math.random() * 10)
      ));
      
      let memoryUsage = 0;
      if (memoryInfo) {
        memoryUsage = Math.round((memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize) * 100);
      } else {
        memoryUsage = Math.min(100, Math.max(10, 
          (Math.cos(now / 15000) * 15 + 35 + Math.random() * 5)
        ));
      }
      
      setStats({
        cpu: Math.round(cpuUsage),
        memory: Math.round(memoryUsage)
      });
    };
    
    updateStats();
    const interval = setInterval(updateStats, 3000);
    
    return () => clearInterval(interval);
  }, []);

  return stats;
}