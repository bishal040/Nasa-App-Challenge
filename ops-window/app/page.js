"use client";

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';

const LunarMap = dynamic(() => import('./components/LunarMap'), { ssr: false });

const KNOWN_FULL_MOON = new Date('2025-01-13T22:27:00Z').getTime();
const LUNAR_MONTH_MS = 29.530588 * 24 * 60 * 60 * 1000;
const LUNAR_MONTH_HOURS = 29.530588 * 24;

// High-fidelity orbital simulator
// Runs a 1-month simulation hour-by-hour to calculate exact constraints
function simulateMissionMetrics(latDeg, lonDeg, startTimeMs) {
  let sunHours = 0;
  let earthHours = 0;
  let opsHours = 0;

  const latRad = latDeg * (Math.PI / 180);
  const lonRad = lonDeg * (Math.PI / 180);
  
  // Earth is always roughly at 0,0 (ignoring 8° libration wobble for this calculation)
  const isEarthLOS = Math.abs(lonDeg) <= 90;
  if (isEarthLOS) earthHours = LUNAR_MONTH_HOURS;

  const stepMs = 60 * 60 * 1000; // 1 hour steps
  const steps = Math.floor(LUNAR_MONTH_HOURS);

  for (let i = 0; i < steps; i++) {
    const t = startTimeMs + (i * stepMs);
    const elapsed = t - KNOWN_FULL_MOON;
    const phase = (elapsed / LUNAR_MONTH_MS) % 1;
    
    const sunLonDeg = -(phase * 360);
    const sunLatDeg = 1.54 * Math.sin(phase * 2 * Math.PI);
    
    const sunLonRad = sunLonDeg * (Math.PI / 180);
    const sunLatRad = sunLatDeg * (Math.PI / 180);

    // Spherical distance to subsolar point
    const cosC = Math.sin(latRad) * Math.sin(sunLatRad) + Math.cos(latRad) * Math.cos(sunLatRad) * Math.cos(lonRad - sunLonRad);
    
    // If cosC > 0, the angle is < 90 degrees (Daylight)
    if (cosC > 0) {
      sunHours += 1;
      if (isEarthLOS) opsHours += 1;
    }
  }

  return {
    sunHours,
    earthHours,
    opsHours,
    opsEfficiency: (opsHours / LUNAR_MONTH_HOURS) * 100 // Efficiency relative to a full lunar month
  };
}

export default function Home() {
  const [missions, setMissions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  
  // Time Simulation State
  const [simulatedTime, setSimulatedTime] = useState(Date.now());
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    fetch('/data/missions.json')
      .then(r => r.json())
      .then(d => {
        setMissions(d.missions);
        if (d.missions.length > 0) setActiveId(d.missions[0].id);
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

  const activeMission = missions.find(m => m.id === activeId) || missions[0];

  // Dynamically calculate metrics whenever the mission or time changes
  const computedMetrics = useMemo(() => {
    if (!activeMission) return null;
    // We simulate 1 month starting from the CURRENT simulated time
    return simulateMissionMetrics(activeMission.lat_deg, activeMission.lon_east_deg, simulatedTime);
  }, [activeMission, simulatedTime]);

  if (loading || !activeMission || !computedMetrics) {
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

  // Calculate percentages for the UI bars
  const sunPct = (computedMetrics.sunHours / LUNAR_MONTH_HOURS) * 100;
  const earthPct = (computedMetrics.earthHours / LUNAR_MONTH_HOURS) * 100;
  const opsPct = (computedMetrics.opsHours / LUNAR_MONTH_HOURS) * 100;

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

        <button 
          onClick={() => setPanelOpen(!panelOpen)}
          className="lg:hidden pointer-events-auto glass-panel px-4 py-3 rounded-xl text-xs font-mono font-medium text-white/80"
        >
          {panelOpen ? 'HIDE' : 'SHOW'}
        </button>
      </nav>

      <div className="absolute inset-0 z-30 pointer-events-none flex flex-col lg:flex-row justify-end lg:justify-between items-end p-4 md:p-6 pt-24 lg:pt-24 gap-6">
        
        <div className="flex flex-col gap-4 w-full lg:w-auto">
          <div className="pointer-events-auto glass-panel p-4 rounded-2xl flex items-center gap-4 w-full lg:w-[600px]">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0 transition-colors"
            >
              {isPlaying ? <div className="w-3 h-3 bg-white" /> : <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-1" />}
            </button>
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">Simulated Time</span>
                <span className="text-sm font-mono font-semibold text-sky-300">{formattedDate} <span className="text-white/40">{formattedTime} UTC</span></span>
              </div>
              <input 
                type="range" 
                min={Date.now() - 30 * 24 * 60 * 60 * 1000} 
                max={Date.now() + 30 * 24 * 60 * 60 * 1000} 
                value={simulatedTime}
                onChange={(e) => { setSimulatedTime(Number(e.target.value)); setIsPlaying(false); }}
                className="w-full h-1.5 bg-white/10 rounded-full appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-sky-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
              />
            </div>
            <button onClick={() => setSimulatedTime(Date.now())} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-mono text-white/60 transition-colors">LIVE</button>
          </div>

          <div className="hidden lg:flex pointer-events-auto glass-panel p-2 rounded-2xl max-w-[600px] overflow-x-auto scrollbar-none gap-2">
            {missions.filter(x => ['apollo-11', 'surveyor-1', 'im-1', 'change-4'].includes(x.id)).map(mission => {
              const isActive = activeId === mission.id;
              return (
                <button 
                  key={mission.id}
                  onClick={() => setActiveId(mission.id)}
                  className={`flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive ? 'bg-white/10 shadow-inner ring-1 ring-white/20' : 'hover:bg-white/5'}`}
                >
                  <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-sky-400 shadow-[0_0_8px_#38bdf8]' : 'bg-white/20'}`} />
                  <div className={`text-sm font-medium ${isActive ? 'text-white' : 'text-white/60'}`}>{mission.name}</div>
                </button>
              )
            })}
          </div>
        </div>

        <aside className={`pointer-events-auto w-full lg:w-[420px] max-w-[500px] glass-panel rounded-2xl md:rounded-3xl flex flex-col transition-all duration-500 ease-in-out transform origin-bottom lg:origin-right
          ${panelOpen ? 'opacity-100 scale-100 translate-y-0 lg:translate-x-0' : 'opacity-0 scale-95 translate-y-8 lg:translate-y-0 lg:translate-x-8 pointer-events-none'}`}
          style={{ maxHeight: 'calc(100vh - 120px)' }}
        >
          <div className="p-5 md:p-8 overflow-y-auto scrollbar-none flex-1">
            
            <div className="flex items-start justify-between gap-4 mb-6 md:mb-8">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className={`px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-widest rounded border ${activeMission.status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                    {activeMission.status}
                  </span>
                  <span className="text-[10px] font-mono text-white/40 tracking-wider">
                    {activeMission.lat_deg.toFixed(4)}°, {activeMission.lon_east_deg.toFixed(4)}°
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-heading font-semibold text-white tracking-tight leading-tight">{activeMission.name}</h2>
                <p className="text-xs md:text-sm text-slate-400 mt-1.5">{activeMission.site_name}</p>
              </div>
            </div>

            <div className="mb-6 pb-6 border-b border-white/5 relative">
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-emerald-400 mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Calculator Active
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">Ops Efficiency</div>
                  <div className="text-xs text-slate-400">(Sun + Earth Overlap / 708hr Month)</div>
                </div>
                <div className="text-4xl md:text-5xl font-mono font-medium text-white tracking-tighter drop-shadow-[0_0_15px_rgba(56,189,248,0.3)]">
                  {computedMetrics.opsEfficiency.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Visualizer */}
            <div className="space-y-5 md:space-y-6 mb-8 md:mb-10">
              <div className="group">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-medium text-slate-300 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" /> Solar Power
                  </span>
                  <span className="text-[10px] font-mono text-amber-400 transition-colors">{computedMetrics.sunHours} hrs</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden">
                  <div className="h-full bg-amber-400 transition-all duration-300 ease-out" style={{ width: `${Math.min(100, sunPct)}%` }} />
                </div>
              </div>

              <div className="group">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-medium text-slate-300 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa]" /> Earth Link
                  </span>
                  <span className="text-[10px] font-mono text-blue-400 transition-colors">{computedMetrics.earthHours.toFixed(0)} hrs</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden">
                  <div className="h-full bg-blue-400 transition-all duration-300 ease-out" style={{ width: `${Math.min(100, earthPct)}%` }} />
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" /> 
                    Ops Window (Overlap)
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400">{computedMetrics.opsHours} hrs</span>
                </div>
                <div className="w-full h-3 rounded-full bg-black/50 p-[1px] border border-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399] transition-all duration-300 ease-out" style={{ width: `${Math.min(100, opsPct)}%` }} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <MetricBox label="Landing Date" value={activeMission.landing_utc} />
              <MetricBox label="Duration" value={activeMission.ops_duration} />
              <MetricBox label="Provider" value={activeMission.provider} />
              <MetricBox label="Confidence" value={<span className="capitalize">{activeMission.confidence}</span>} />
            </div>

            {activeMission.payloads && activeMission.payloads.length > 0 && (
              <div className="mt-3 md:mt-4 glass-panel-light p-3 md:p-4 rounded-xl md:rounded-2xl">
                <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-1.5 block">Payloads</span>
                <span className="text-xs text-slate-300 leading-relaxed">{activeMission.payloads.join(', ')}</span>
              </div>
            )}
          </div>
        </aside>

      </div>
    </div>
  );
}

function MetricBox({ label, value }) {
  return (
    <div className="glass-panel-light p-3 md:p-4 rounded-xl flex flex-col justify-center">
      <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-1.5 block truncate">{label}</span>
      <span className="text-xs font-medium text-white truncate">{value}</span>
    </div>
  );
}
