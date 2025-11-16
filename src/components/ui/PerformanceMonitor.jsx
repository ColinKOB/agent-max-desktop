/**
 * Performance Monitor Component
 * Real-time performance metrics with liquid glass styling
 */
import React, { useState, useEffect, useRef } from 'react';
import { Activity, Cpu, HardDrive, Wifi, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { LiquidGlassCard } from './LiquidGlassCard';
import { formatFileSize, formatPercentage, formatDuration } from '../../utils/formatters';

export function PerformanceMonitor({ mini = false }) {
  const [metrics, setMetrics] = useState({
    fps: 60,
    memory: { used: 0, total: 0, percent: 0 },
    cpu: 0,
    network: { latency: 0, bandwidth: 0 },
    renderTime: 0,
    componentCount: 0,
    apiCalls: 0,
    cacheHitRate: 0
  });
  
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(performance.now());
  const animationFrameRef = useRef();

  // Calculate FPS
  const calculateFPS = () => {
    frameCountRef.current++;
    const now = performance.now();
    const delta = now - lastFrameTimeRef.current;
    
    if (delta >= 1000) {
      const fps = Math.round((frameCountRef.current * 1000) / delta);
      frameCountRef.current = 0;
      lastFrameTimeRef.current = now;
      
      setMetrics(prev => ({ ...prev, fps }));
    }
    
    animationFrameRef.current = requestAnimationFrame(calculateFPS);
  };

  // Monitor performance
  useEffect(() => {
    // Start FPS monitoring
    animationFrameRef.current = requestAnimationFrame(calculateFPS);
    
    // Monitor memory (if available)
    const memoryInterval = setInterval(() => {
      if (performance.memory) {
        const used = performance.memory.usedJSHeapSize;
        const total = performance.memory.jsHeapSizeLimit;
        const percent = (used / total) * 100;
        
        setMetrics(prev => ({
          ...prev,
          memory: { used, total, percent }
        }));
      }
    }, 1000);
    
    // Monitor network latency
    const latencyInterval = setInterval(async () => {
      const start = performance.now();
      try {
        await fetch('/health', { method: 'HEAD' }).catch(() => {});
        const latency = performance.now() - start;
        setMetrics(prev => ({
          ...prev,
          network: { ...prev.network, latency }
        }));
      } catch (e) {
        // Network error
      }
    }, 5000);
    
    // Monitor React components
    const componentInterval = setInterval(() => {
      // Count React Fiber nodes
      const root = document.getElementById('root');
      if (root && root._reactRootContainer) {
        const fiberRoot = root._reactRootContainer._internalRoot;
        let count = 0;
        
        const countFibers = (fiber) => {
          if (!fiber) return;
          count++;
          if (fiber.child) countFibers(fiber.child);
          if (fiber.sibling) countFibers(fiber.sibling);
        };
        
        countFibers(fiberRoot.current);
        setMetrics(prev => ({ ...prev, componentCount: count }));
      }
    }, 2000);
    
    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      clearInterval(memoryInterval);
      clearInterval(latencyInterval);
      clearInterval(componentInterval);
    };
  }, []);

  // Get performance color
  const getPerformanceColor = (value, thresholds) => {
    if (value >= thresholds.good) return 'text-green-600';
    if (value >= thresholds.fair) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get FPS color
  const getFPSColor = (fps) => {
    if (fps >= 50) return 'text-green-600';
    if (fps >= 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get memory color
  const getMemoryColor = (percent) => {
    if (percent <= 50) return 'text-green-600';
    if (percent <= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get latency color
  const getLatencyColor = (latency) => {
    if (latency <= 100) return 'text-green-600';
    if (latency <= 300) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Mini view for status bar
  if (mini) {
    return (
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1">
          <Activity className="w-3 h-3" />
          <span className={getFPSColor(metrics.fps)}>{metrics.fps} FPS</span>
        </div>
        <div className="flex items-center gap-1">
          <HardDrive className="w-3 h-3" />
          <span className={getMemoryColor(metrics.memory.percent)}>
            {formatPercentage(metrics.memory.percent / 100)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Wifi className="w-3 h-3" />
          <span className={getLatencyColor(metrics.network.latency)}>
            {Math.round(metrics.network.latency)}ms
          </span>
        </div>
      </div>
    );
  }

  // Full view
  return (
    <LiquidGlassCard variant="elevated" className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Performance Monitor
        </h3>
        <div className="flex items-center gap-2 text-sm">
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full">
            Healthy
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* FPS */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
            <Zap className="w-3 h-3" />
            Frame Rate
          </div>
          <div className={`text-2xl font-bold ${getFPSColor(metrics.fps)}`}>
            {metrics.fps}
          </div>
          <div className="text-xs text-gray-500">FPS</div>
          <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${
                metrics.fps >= 50 ? 'bg-green-500' :
                metrics.fps >= 30 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, (metrics.fps / 60) * 100)}%` }}
            />
          </div>
        </div>
        
        {/* Memory */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
            <HardDrive className="w-3 h-3" />
            Memory
          </div>
          <div className={`text-2xl font-bold ${getMemoryColor(metrics.memory.percent)}`}>
            {formatPercentage(metrics.memory.percent / 100)}
          </div>
          <div className="text-xs text-gray-500">
            {formatFileSize(metrics.memory.used)} / {formatFileSize(metrics.memory.total)}
          </div>
          <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${
                metrics.memory.percent <= 50 ? 'bg-green-500' :
                metrics.memory.percent <= 80 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${metrics.memory.percent}%` }}
            />
          </div>
        </div>
        
        {/* Network Latency */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
            <Wifi className="w-3 h-3" />
            Network
          </div>
          <div className={`text-2xl font-bold ${getLatencyColor(metrics.network.latency)}`}>
            {Math.round(metrics.network.latency)}
          </div>
          <div className="text-xs text-gray-500">ms latency</div>
          <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${
                metrics.network.latency <= 100 ? 'bg-green-500' :
                metrics.network.latency <= 300 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, (100 / metrics.network.latency) * 100)}%` }}
            />
          </div>
        </div>
        
        {/* Component Count */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
            <Cpu className="w-3 h-3" />
            Components
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {metrics.componentCount}
          </div>
          <div className="text-xs text-gray-500">React nodes</div>
          <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${Math.min(100, (metrics.componentCount / 1000) * 100)}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Performance Tips */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
          Performance Tips
        </h4>
        <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
          {metrics.fps < 30 && (
            <li>• Low FPS detected. Consider reducing animations or closing other tabs.</li>
          )}
          {metrics.memory.percent > 80 && (
            <li>• High memory usage. Try refreshing the page or clearing cache.</li>
          )}
          {metrics.network.latency > 300 && (
            <li>• High network latency. Check your internet connection.</li>
          )}
          {metrics.componentCount > 1000 && (
            <li>• Many components rendered. Consider pagination or virtualization.</li>
          )}
        </ul>
      </div>
    </LiquidGlassCard>
  );
}

// Performance observer hook
export function usePerformanceObserver() {
  const [performanceData, setPerformanceData] = useState({
    loadTime: 0,
    renderTime: 0,
    interactionTime: 0
  });

  useEffect(() => {
    // Observe navigation timing
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          setPerformanceData(prev => ({
            ...prev,
            loadTime: entry.loadEventEnd - entry.fetchStart
          }));
        }
        
        if (entry.entryType === 'measure') {
          if (entry.name.includes('render')) {
            setPerformanceData(prev => ({
              ...prev,
              renderTime: entry.duration
            }));
          }
        }
        
        if (entry.entryType === 'first-input') {
          setPerformanceData(prev => ({
            ...prev,
            interactionTime: entry.processingStart - entry.startTime
          }));
        }
      }
    });

    observer.observe({ 
      entryTypes: ['navigation', 'measure', 'first-input'] 
    });

    return () => observer.disconnect();
  }, []);

  return performanceData;
}
