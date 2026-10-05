"use client";

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import PolarPlot from './components/PolarPlot';
import CompareChart from './components/CompareChart';
import Timeline from './components/Timeline';

const LunarMap = dynamic(() => import('./components/LunarMap'), { ssr: false });

const KNOWN_FULL_MOON = new Date('2025-01-13T22:27:00Z').getTime();
const LUNAR_MONTH_MS = 29.530588 * 24 * 60 * 60 * 1000;
const LUNAR_MONTH_HOURS = 29.530588 * 24;

// Calculates static intervals (Gantt chart blocks) for the 60-day timeline window
function calculateFixedIntervals(latDeg, lonDeg, startTimeMs, durationHours) {
  const sunIntervals = [];
  const earthIntervals = [];
  const overlapIntervals = [];
  
  let inSun = false, inEarth = false, inOverlap = false;
  let sunStart = 0, earthStart = 0, overlapStart = 0;

  const latRad = latDeg * (Math.PI / 180);
  const lonRad = lonDeg * (Math.PI / 180);
  const isEarthLOS = Math.abs(lonDeg) <= 90;
  
  const stepMs = 60 * 60 * 1000;

  for (let i = 0; i <= durationHours; i++) {
    const t = startTimeMs + (i * stepMs);
    const elapsed = t - KNOWN_FULL_MOON;
    const phase = (elapsed / LUNAR_MONTH_MS) % 1;
    
    const sunLonDeg = -(phase * 360);
    const sunLatDeg = 1.54 * Math.sin(phase * 2 * Math.PI);
    const sunLonRad = sunLonDeg * (Math.PI / 180);
    const sunLatRad = sunLatDeg * (Math.PI / 180);

    const cosC = Math.sin(latRad) * Math.sin(sunLatRad) + Math.cos(latRad) * Math.cos(sunLatRad) * Math.cos(lonRad - sunLonRad);
    const isDaylight = cosC > 0;
    const isOverlap = isDaylight && isEarthLOS;

    if (isDaylight && !inSun) { inSun = true; sunStart = i; }
    if (!isDaylight && inSun) { inSun = false; sunIntervals.push([sunStart, i]); }

    if (isEarthLOS && !inEarth) { inEarth = true; earthStart = i; }
    if (!isEarthLOS && inEarth) { inEarth = false; earthIntervals.push([earthStart, i]); }

    if (isOverlap && !inOverlap) { inOverlap = true; overlapStart = i; }
    if (!isOverlap && inOverlap) { inOverlap = false; overlapIntervals.push([overlapStart, i]); }
  }
  
  if (inSun) sunIntervals.push([sunStart, durationHours]);
  if (inEarth) earthIntervals.push([earthStart, durationHours]);
  if (inOverlap) overlapIntervals.push([overlapStart, durationHours]);

  return { sun: sunIntervals, earth: earthIntervals, overlap: overlapIntervals };
}

// Calculates live moving metrics (the next 30 days from scrubber point)
function simulateMissionMetrics(latDeg, lonDeg, startTimeMs) {
  let sunHours = 0;
  let earthHours = 0;
  let opsHours = 0;

  const latRad = latDeg * (Math.PI / 180);
  const lonRad = lonDeg * (Math.PI / 180);
  const isEarthLOS = Math.abs(lonDeg) <= 90;
  if (isEarthLOS) earthHours = LUNAR_MONTH_HOURS;

  const stepMs = 60 * 60 * 1000;
  const steps = Math.floor(LUNAR_MONTH_HOURS);

  for (let i = 0; i < steps; i++) {
    const t = startTimeMs + (i * stepMs);
    const elapsed = t - KNOWN_FULL_MOON;
    const phase = (elapsed / LUNAR_MONTH_MS) % 1;
    const sunLonDeg = -(phase * 360);
    const sunLatDeg = 1.54 * Math.sin(phase * 2 * Math.PI);
    const cosC = Math.sin(latRad) * Math.sin(sunLatDeg * Math.PI/180) + Math.cos(latRad) * Math.cos(sunLatDeg * Math.PI/180) * Math.cos(lonRad - (sunLonDeg * Math.PI/180));
    
    if (cosC > 0) {
      sunHours += 1;
      if (isEarthLOS) opsHours += 1;
    }
  }

  return {
    sunHours,
    earthHours,
    opsHours,
    opsEfficiency: (opsHours / LUNAR_MONTH_HOURS) * 100,
    opsEfficiencyRaw: opsHours / LUNAR_MONTH_HOURS
  };
}

export default function Home() {
  const [rawMissions, setRawMissions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSkyPathModalOpen, setIsSkyPathModalOpen] = useState(false);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  
  // Fixed Timeline window: 30 days back, 30 days forward (60 days total = 1440 hours)
  const [timelineStartMs] = useState(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const timelineDurationHours = 1440;

  const [simulatedTime, setSimulatedTime] = useState(Date.now());
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    fetch('/data/missions.json')
      .then(r => r.json())
      .then(d => {
        setRawMissions(d.missions);
        if (d.missions.length > 0) setActiveId(d.missions[0].mission_id);
        setLoading(false);
      })
      .catch(e => {
        console.error("Failed to load missions", e);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setSimulatedTime(t => t + (24 * 60 * 60 * 1000) * 0.1); 
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Compute fixed intervals for the Timeline chart ONLY ONCE
  const missionsWithIntervals = useMemo(() => {
    return rawMissions.map(m => {
      // Overwrite the mock intervals with mathematically accurate ones
      const intervals = calculateFixedIntervals(m.lat_deg, m.lon_east_deg, timelineStartMs, timelineDurationHours);
      return { ...m, intervals };
    });
  }, [rawMissions, timelineStartMs]);

  // Compute live metrics for the active time scrubber position
  const missions = useMemo(() => {
    return missionsWithIntervals.map(m => {
      const metrics = simulateMissionMetrics(m.lat_deg, m.lon_east_deg, simulatedTime);
      return { ...m, computedMetrics: metrics };
    });
  }, [missionsWithIntervals, simulatedTime]);

  const activeMission = missions.find(m => m.mission_id === activeId) || missions[0];

  if (loading || !activeMission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05070a] text-sky-400">
        <div className="animate-pulse font-mono tracking-widest text-sm flex items-center gap-3">
          <span className="w-4 h-4 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
          ESTABLISHING UPLINK...
        </div>
      </div>
    );
  }

  const dateObj = new Date(simulatedTime);
  const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  const formattedTime = dateObj.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

  const metrics = activeMission.computedMetrics;
  const sunPct = (metrics.sunHours / LUNAR_MONTH_HOURS) * 100;
  const earthPct = (metrics.earthHours / LUNAR_MONTH_HOURS) * 100;
  const opsPct = (metrics.opsHours / LUNAR_MONTH_HOURS) * 100;

  return (
    <div className="h-screen w-full flex flex-col selection:bg-sky-500/30 overflow-hidden bg-[#05070a] relative font-sans">
      <div className="absolute inset-0 z-0">
        <LunarMap missions={missions} activeId={activeId} onSelect={setActiveId} simulatedTime={simulatedTime} />
      </div>

      <nav className="pointer-events-none absolute top-0 left-0 right-0 z-40 p-4 md:p-6 flex items-start justify-between">
        <div className="pointer-events-auto glass-panel px-4 py-3 md:px-5 md:py-3.5 rounded-xl md:rounded-2xl flex items-center gap-3 md:gap-4">
          <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399] animate-pulse" />
          <div>
            <h1 className="text-sm md:text-base font-semibold tracking-wide text-white font-heading leading-tight">Ops Window</h1>
            <p className="text-[9px] md:text-[10px] font-mono text-white/50 uppercase tracking-[0.2em] leading-tight mt-0.5">Lunar Coverage Simulator</p>
          </div>
        </div>
      </nav>

      <div className="absolute inset-0 z-30 pointer-events-none flex justify-between items-stretch p-4 pt-24 gap-4 pb-24">
        
        <aside className="pointer-events-auto w-[380px] flex flex-col gap-4 h-full">
          <div className="glass-panel rounded-2xl flex flex-col flex-1 overflow-hidden p-4">
            <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/60 mb-2">Fleet Ops Efficiency</h3>
            <div className="flex-1 min-h-[200px]">
              <CompareChart missions={missions} selectedId={activeId} onSelect={setActiveId} />
            </div>
          </div>
          <div 
            className="glass-panel rounded-2xl flex flex-col h-[300px] overflow-hidden p-4 cursor-pointer hover:bg-white/5 transition-colors group relative"
            onClick={() => setIsTimelineModalOpen(true)}
          >
            <div className="flex items-center gap-2 mb-2">
               <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/60 group-hover:text-sky-400 transition-colors">60-Day Window Forecast</h3>
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3 text-white/40 group-hover:text-sky-400 transition-colors"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
            </div>
            <div className="flex-1">
              <Timeline 
                missions={missions} 
                selectedId={activeId} 
                onSelect={setActiveId} 
                timelineStartMs={timelineStartMs}
                simulatedTime={simulatedTime}
                durationHours={timelineDurationHours}
              />
            </div>
          </div>
        </aside>

        <aside className="pointer-events-auto w-[400px] glass-panel rounded-2xl flex flex-col h-full overflow-hidden p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-widest rounded border ${activeMission.status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                  {activeMission.status}
                </span>
              </div>
              <h2 className="text-2xl font-heading font-semibold text-white tracking-tight leading-tight">{activeMission.mission}</h2>
              <p className="text-xs text-slate-400 mt-1">{activeMission.site_name}</p>
            </div>
          </div>

          <div className="mb-5 pb-5 border-b border-white/5 relative">
            <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-emerald-400 mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Calculator
            </div>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">Ops Efficiency</div>
              </div>
              <div className="text-4xl font-mono font-medium text-white tracking-tighter drop-shadow-[0_0_15px_rgba(56,189,248,0.3)]">
                {metrics.opsEfficiency.toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <ProgressBar label="Solar Power" value={metrics.sunHours} pct={sunPct} color="bg-amber-400" text="text-amber-400" />
            <ProgressBar label="Earth Link" value={metrics.earthHours} pct={earthPct} color="bg-blue-400" text="text-blue-400" />
            <ProgressBar label="Ops Window" value={metrics.opsHours} pct={opsPct} color="bg-emerald-400" text="text-emerald-400" />
          </div>

          <div 
            className="flex-1 min-h-[220px] bg-black/20 rounded-xl border border-white/5 relative cursor-pointer hover:bg-white/5 transition-colors group"
            onClick={() => setIsSkyPathModalOpen(true)}
          >
             <div className="absolute top-3 left-3 text-[9px] font-mono uppercase tracking-[0.2em] text-white/40 group-hover:text-sky-400 transition-colors z-10 flex items-center gap-2">
               Sky Path Overlay
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
             </div>
             <PolarPlot mission={activeMission} />
          </div>
        </aside>

      </div>

      {/* Timeline Expanded Modal */}
      {isTimelineModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsTimelineModalOpen(false)} />
          <div className="glass-panel p-8 rounded-3xl w-[95vw] max-w-[1200px] h-[85vh] flex flex-col relative animate-in fade-in zoom-in duration-300">
            <button 
              onClick={() => setIsTimelineModalOpen(false)}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors z-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="mb-6">
              <h2 className="text-2xl font-heading font-semibold text-white tracking-wide">60-Day Historical Window Analysis</h2>
              <p className="text-xs font-mono text-white/40 uppercase tracking-widest mt-1">Fleet Overview</p>
            </div>
            <div className="flex-1 w-full h-full flex gap-8 overflow-hidden">
              <div className="flex-1 min-w-0 h-full relative">
                <Timeline 
                  missions={missions} 
                  selectedId={activeId} 
                  onSelect={setActiveId} 
                  timelineStartMs={timelineStartMs}
                  simulatedTime={simulatedTime}
                  durationHours={timelineDurationHours}
                />
              </div>
              <div className="w-[320px] flex-shrink-0 flex flex-col gap-6 border-l border-white/10 pl-8 overflow-y-auto scrollbar-none pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-widest rounded border ${activeMission.status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                      {activeMission.status}
                    </span>
                  </div>
                  <h3 className="text-xl font-heading font-semibold text-white">{activeMission.mission}</h3>
                  <p className="text-xs text-slate-400 mt-1">{activeMission.site_name}</p>
                </div>
                
                <div className="flex justify-between items-end pb-4 border-b border-white/5">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Ops Efficiency</div>
                  <div className="text-2xl font-mono font-medium text-sky-400 tracking-tighter">
                    {metrics.opsEfficiency.toFixed(1)}%
                  </div>
                </div>

                <div className="flex-1 min-h-[300px] w-full relative flex flex-col items-center justify-center">
                  <div className="absolute top-0 left-0 text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 w-full text-center">Sky Path Overlay</div>
                  <div className="w-full h-full mt-6">
                    <PolarPlot mission={activeMission} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sky Path Expanded Modal */}
      {isSkyPathModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsSkyPathModalOpen(false)} />
          <div className="glass-panel p-8 rounded-3xl w-[90vw] max-w-[800px] aspect-square max-h-[90vh] flex flex-col relative animate-in fade-in zoom-in duration-300">
            <button 
              onClick={() => setIsSkyPathModalOpen(false)}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors z-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="mb-4 text-center">
              <h2 className="text-xl font-heading font-semibold text-white tracking-wide">High-Resolution Sky Path</h2>
              <p className="text-xs font-mono text-white/40 uppercase tracking-widest mt-1">Observer: {activeMission.mission}</p>
            </div>
            <div className="flex-1 w-full h-full relative">
              <PolarPlot mission={activeMission} />
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
        <div className="glass-panel p-3 rounded-2xl flex items-center gap-4 w-[600px]">
          <button onClick={() => setIsPlaying(!isPlaying)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0">
            {isPlaying ? <div className="w-3 h-3 bg-white" /> : <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-1" />}
          </button>
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">Simulated Time</span>
              <span className="text-sm font-mono font-semibold text-sky-300">{formattedDate} <span className="text-white/40">{formattedTime} UTC</span></span>
            </div>
            <input type="range" min={timelineStartMs} max={timelineStartMs + timelineDurationHours * 3600000} value={simulatedTime} onChange={(e) => { setSimulatedTime(Number(e.target.value)); setIsPlaying(false); }} className="w-full h-1.5 bg-white/10 rounded-full appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-sky-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
          </div>
          <button onClick={() => setSimulatedTime(Date.now())} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-mono text-white/60">LIVE</button>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ label, value, pct, color, text }) {
  return (
    <div className="group">
      <div className="flex justify-between items-end mb-1.5">
        <span className="text-[10px] font-medium text-slate-300 uppercase tracking-wider">{label}</span>
        <span className={`text-[10px] font-mono ${text}`}>{value.toFixed(0)} hrs</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden">
        <div className={`h-full ${color} transition-all duration-300 ease-out`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}
