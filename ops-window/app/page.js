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

// Grid Planner Helper (Radius ~ 450km = 15 degrees)
function hasGridCoverage(latDeg, lonDeg, towers) {
  if (!towers || towers.length === 0) return false;
  const TOWER_RADIUS_DEG = 15;
  for (const tower of towers) {
    const dLat = latDeg - tower.lat;
    const dLon = lonDeg - tower.lng;
    if (Math.sqrt(dLat*dLat + dLon*dLon) <= TOWER_RADIUS_DEG) return true;
  }
  return false;
}

// Calculates static intervals (Gantt chart blocks) for the 60-day timeline window
function calculateFixedIntervals(latDeg, lonDeg, startTimeMs, durationHours, towers) {
  const sunIntervals = [];
  const earthIntervals = [];
  const overlapIntervals = [];
  
  let inSun = false, inEarth = false, inOverlap = false;
  let sunStart = 0, earthStart = 0, overlapStart = 0;

  const latRad = latDeg * (Math.PI / 180);
  const lonRad = lonDeg * (Math.PI / 180);
  const inGrid = hasGridCoverage(latDeg, lonDeg, towers);
  const isEarthLOS = inGrid || Math.abs(lonDeg) <= 90;
  
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
    const isDaylight = inGrid || cosC > 0;
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
function simulateMissionMetrics(latDeg, lonDeg, startTimeMs, towers) {
  let sunHours = 0;
  let earthHours = 0;
  let opsHours = 0;

  const latRad = latDeg * (Math.PI / 180);
  const lonRad = lonDeg * (Math.PI / 180);
  const inGrid = hasGridCoverage(latDeg, lonDeg, towers);
  const isEarthLOS = inGrid || Math.abs(lonDeg) <= 90;
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
    const isDaylight = inGrid || cosC > 0;

    if (isDaylight) {
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
  const [compareId, setCompareId] = useState(null);
  const [isPlanningMode, setIsPlanningMode] = useState(false);
  const [towers, setTowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isSkyPathModalOpen, setIsSkyPathModalOpen] = useState(false);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  
  // Fixed Timeline window: 30 days back, 30 days forward (60 days total = 1440 hours)
  const [timelineStartMs] = useState(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const timelineDurationHours = 1440;

  const [simulatedTime, setSimulatedTime] = useState(Date.now());
  const [isPlaying, setIsPlaying] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('ALL');

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
      setSimulatedTime(t => t + (24 * 60 * 60 * 1000) * 0.3); // 3x faster playback
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Compute fixed intervals for the Timeline chart ONLY ONCE
  const missionsWithIntervals = useMemo(() => {
    return rawMissions.map(m => {
      const intervals = calculateFixedIntervals(m.lat_deg, m.lon_east_deg, timelineStartMs, timelineDurationHours, towers);
      return { ...m, intervals };
    });
  }, [rawMissions, timelineStartMs, towers]);

  // Extract unique providers for the filter dropdown
  const uniqueProviders = useMemo(() => {
    const set = new Set(rawMissions.map(m => m.provider));
    return ['ALL', ...Array.from(set).sort()];
  }, [rawMissions]);

  // Apply search and filter BEFORE computing live metrics
  const filteredMissionsWithIntervals = useMemo(() => {
    return missionsWithIntervals.filter(m => {
      const matchSearch = m.mission.toLowerCase().includes(searchQuery.toLowerCase()) || m.site_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchProvider = providerFilter === 'ALL' || m.provider === providerFilter;
      return matchSearch && matchProvider;
    });
  }, [missionsWithIntervals, searchQuery, providerFilter]);

  // Compute live metrics for the active time scrubber position
  const missions = useMemo(() => {
    return filteredMissionsWithIntervals.map(m => {
      const metrics = simulateMissionMetrics(m.lat_deg, m.lon_east_deg, simulatedTime, towers);
      return { ...m, computedMetrics: metrics };
    });
  }, [filteredMissionsWithIntervals, simulatedTime, towers]);

  const activeMission = missions.find(m => m.mission_id === activeId) || missions[0];
  const compareMission = missions.find(m => m.mission_id === compareId) || null;

  if (loading || !activeMission) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#05070a] text-sky-400 gap-6">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-sky-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-sky-400" style={{ animation: 'orbit-spin 1.2s linear infinite' }} />
          <div className="absolute inset-2 rounded-full border border-sky-500/10" />
          <div className="absolute inset-[10px] rounded-full border border-transparent border-b-sky-300/60" style={{ animation: 'orbit-spin 1.8s linear infinite reverse' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.8)]" />
          </div>
        </div>
        <div className="font-mono tracking-[0.3em] text-sm text-sky-400/80 uppercase">Establishing Uplink</div>
      </div>
    );
  }

  const dateObj = new Date(simulatedTime);
  const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  const formattedTime = dateObj.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const metrics = activeMission.computedMetrics;
  const sunPct = (metrics.sunHours / LUNAR_MONTH_HOURS) * 100;
  const earthPct = (metrics.earthHours / LUNAR_MONTH_HOURS) * 100;
  const opsPct = (metrics.opsHours / LUNAR_MONTH_HOURS) * 100;

  // Lunar phase calculation for display
  const elapsed = simulatedTime - KNOWN_FULL_MOON;
  const lunarPhase = ((elapsed / LUNAR_MONTH_MS) % 1 + 1) % 1;
  const lunarDay = (lunarPhase * 29.53).toFixed(1);

  // Determine live status
  const inGrid = hasGridCoverage(activeMission.lat_deg, activeMission.lon_east_deg, towers);
  const isEarthLOS = inGrid || Math.abs(activeMission.lon_east_deg) <= 90;
  const subsolarPhase = ((simulatedTime - KNOWN_FULL_MOON) / LUNAR_MONTH_MS) % 1;
  const subsolarLon = -(subsolarPhase * 360);
  const distToSun = Math.abs(((activeMission.lon_east_deg - subsolarLon) % 360 + 540) % 360 - 180);
  const isDaylight = inGrid || distToSun <= 90;
  const isOpsWindow = isDaylight && isEarthLOS;

  const exportBriefing = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;

      // Build an off-screen briefing document
      const doc = document.createElement('div');
      doc.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1200px;padding:60px;background:#05070a;color:#fff;font-family:ui-monospace,monospace;z-index:99999;';

      const dataDownlink = (metrics.opsHours * 45) > 1000 ? ((metrics.opsHours * 45) / 1024).toFixed(2) + ' TB' : (metrics.opsHours * 45).toFixed(0) + ' GB';
      const roverTraverse = (metrics.opsHours * 0.12).toFixed(1);

      doc.innerHTML = `
        <div style="border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:48px;background:linear-gradient(145deg,#080c12,#0a0e16);">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;">
            <div>
              <div style="font-size:11px;letter-spacing:0.3em;color:rgba(255,255,255,0.3);text-transform:uppercase;margin-bottom:8px;">Mission Briefing Report</div>
              <div style="font-size:36px;font-weight:700;color:#fff;letter-spacing:-0.02em;">${activeMission.mission}</div>
              <div style="font-size:14px;color:rgba(255,255,255,0.4);margin-top:6px;">${activeMission.site_name} • ${activeMission.provider}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:11px;letter-spacing:0.3em;color:rgba(255,255,255,0.3);text-transform:uppercase;margin-bottom:8px;">Generated</div>
              <div style="font-size:16px;color:#fff;">${formattedDate}</div>
              <div style="font-size:13px;color:rgba(255,255,255,0.4);">${formattedTime} UTC</div>
            </div>
          </div>

          <div style="display:flex;gap:16px;margin-bottom:32px;">
            <div style="flex:1;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px;">
              <div style="font-size:10px;letter-spacing:0.2em;color:rgba(52,211,153,0.7);text-transform:uppercase;margin-bottom:6px;">Ops Efficiency</div>
              <div style="font-size:42px;font-weight:600;color:#34d399;">${metrics.opsEfficiency.toFixed(1)}%</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:4px;">${metrics.opsHours.toFixed(0)} / ${LUNAR_MONTH_HOURS.toFixed(0)} hrs</div>
            </div>
            <div style="flex:1;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px;">
              <div style="font-size:10px;letter-spacing:0.2em;color:rgba(251,191,36,0.7);text-transform:uppercase;margin-bottom:6px;">Solar Exposure</div>
              <div style="font-size:42px;font-weight:600;color:#fbbf24;">${sunPct.toFixed(1)}%</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:4px;">${metrics.sunHours.toFixed(0)} hrs sunlight</div>
            </div>
            <div style="flex:1;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px;">
              <div style="font-size:10px;letter-spacing:0.2em;color:rgba(96,165,250,0.7);text-transform:uppercase;margin-bottom:6px;">Earth Comm Link</div>
              <div style="font-size:42px;font-weight:600;color:#60a5fa;">${earthPct.toFixed(1)}%</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:4px;">${metrics.earthHours.toFixed(0)} hrs LOS</div>
            </div>
          </div>

          <div style="display:flex;gap:16px;margin-bottom:32px;">
            <div style="flex:1;background:rgba(0,0,0,0.4);border:1px solid rgba(52,211,153,0.15);border-radius:12px;padding:20px;">
              <div style="font-size:10px;letter-spacing:0.2em;color:rgba(52,211,153,0.7);text-transform:uppercase;margin-bottom:6px;">Est. Data Downlink</div>
              <div style="font-size:28px;font-weight:600;color:#fff;">${dataDownlink}</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:4px;">@ 100Mbps Ka-Band</div>
            </div>
            <div style="flex:1;background:rgba(0,0,0,0.4);border:1px solid rgba(56,189,248,0.15);border-radius:12px;padding:20px;">
              <div style="font-size:10px;letter-spacing:0.2em;color:rgba(56,189,248,0.7);text-transform:uppercase;margin-bottom:6px;">Est. Rover Traverse</div>
              <div style="font-size:28px;font-weight:600;color:#fff;">${roverTraverse} km</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:4px;">@ 120m/hr driving ops</div>
            </div>
          </div>

          <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:24px;margin-bottom:24px;">
            <div style="font-size:11px;letter-spacing:0.2em;color:rgba(255,255,255,0.3);text-transform:uppercase;margin-bottom:16px;">Telemetry Parameters</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
              <div style="background:rgba(255,255,255,0.02);border-radius:8px;padding:14px;">
                <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px;">Coordinates</div>
                <div style="font-size:14px;color:#fff;">${activeMission.lat_deg.toFixed(4)}°, ${activeMission.lon_east_deg.toFixed(4)}°</div>
              </div>
              <div style="background:rgba(255,255,255,0.02);border-radius:8px;padding:14px;">
                <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px;">Landing Date</div>
                <div style="font-size:14px;color:#fff;">${activeMission.landing_utc.split('T')[0]}</div>
              </div>
              <div style="background:rgba(255,255,255,0.02);border-radius:8px;padding:14px;">
                <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px;">Mission Era</div>
                <div style="font-size:14px;color:#fbbf24;">${activeMission.era}</div>
              </div>
              <div style="background:rgba(255,255,255,0.02);border-radius:8px;padding:14px;">
                <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px;">Status</div>
                <div style="font-size:14px;color:${activeMission.status === 'success' ? '#34d399' : '#fbbf24'};text-transform:uppercase;">${activeMission.status}</div>
              </div>
              <div style="background:rgba(255,255,255,0.02);border-radius:8px;padding:14px;">
                <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px;">Ops Duration</div>
                <div style="font-size:14px;color:#fff;">${activeMission.ops_duration}</div>
              </div>
              <div style="background:rgba(255,255,255,0.02);border-radius:8px;padding:14px;">
                <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px;">Lunar Day</div>
                <div style="font-size:14px;color:#fbbf24;">Day ${lunarDay}</div>
              </div>
            </div>
          </div>

          ${towers.length > 0 ? `
          <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:24px;margin-bottom:24px;">
            <div style="font-size:11px;letter-spacing:0.2em;color:rgba(245,158,11,0.7);text-transform:uppercase;margin-bottom:12px;">Grid Infrastructure (${towers.length} Tower${towers.length > 1 ? 's' : ''} Deployed)</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
              ${towers.map((t, i) => `<div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:8px 14px;font-size:12px;color:#f59e0b;">Tower ${i+1}: ${t.lat.toFixed(2)}°, ${t.lng.toFixed(2)}°</div>`).join('')}
            </div>
          </div>
          ` : ''}

          <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:10px;color:rgba(255,255,255,0.2);letter-spacing:0.15em;text-transform:uppercase;">Ops Window • Lunar Coverage Simulator</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.2);letter-spacing:0.15em;text-transform:uppercase;">Classification: Unclassified // FOUO</div>
          </div>
        </div>
      `;

      document.body.appendChild(doc);
      const canvas = await html2canvas(doc, { backgroundColor: '#05070a', scale: 2 });
      document.body.removeChild(doc);

      const link = document.createElement('a');
      link.download = `OPS_BRIEFING_${activeMission.mission.replace(/\s+/g, '_')}_${formattedDate.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleAddTower = (lat, lng) => {
    setTowers(prev => [...prev, { lat, lng }]);
  };

  return (
    <div className={`h-screen w-full flex flex-col selection:bg-sky-500/30 overflow-hidden bg-[#05070a] relative font-sans grain-overlay ${isPlanningMode ? 'cursor-crosshair' : ''}`}>
      <div className="absolute inset-0 z-0">
        <LunarMap 
          missions={missions} 
          activeId={activeId} 
          onSelect={setActiveId} 
          simulatedTime={simulatedTime} 
          isPlanningMode={isPlanningMode}
          towers={towers}
          onAddTower={handleAddTower}
        />
      </div>

      {/* ━━━ TOP NAVIGATION BAR ━━━ */}
      <nav className="pointer-events-none absolute top-0 left-0 right-0 z-40 p-4 md:p-5 flex items-start justify-between">
        <div className="pointer-events-auto glass-panel px-5 py-3.5 rounded-2xl flex items-center gap-4">
          <div className="relative w-9 h-9 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-emerald-400/30" style={{ animation: 'orbit-spin 8s linear infinite' }} />
            <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.7)]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-wide text-white font-heading leading-tight">Ops Window</h1>
            <p className="text-sm font-mono text-white/40 uppercase tracking-[0.25em] leading-tight mt-0.5">Lunar Coverage Simulator</p>
          </div>
        </div>

        {/* Central Search & Filter Bar */}
        <div className="pointer-events-auto glass-panel px-4 py-2.5 rounded-2xl flex items-center gap-4">
          <div className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 focus-within:border-sky-500/50 focus-within:bg-black/40 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-white/40"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            <input 
              type="text" 
              placeholder="Search missions or sites..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm font-sans text-white placeholder:text-white/30 w-[180px]"
            />
          </div>
          <div className="w-[1px] h-6 bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-widest text-white/40">Provider</span>
            <select 
              value={providerFilter}
              onChange={e => setProviderFilter(e.target.value)}
              className="bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-sm text-white outline-none cursor-pointer hover:border-sky-500/30 font-sans"
            >
              {uniqueProviders.map(p => (
                <option key={p} value={p} className="bg-[#05070a] text-white">{p}</option>
              ))}
            </select>
          </div>
          <div className="w-[1px] h-6 bg-white/10" />
          <button onClick={() => { setIsPlanningMode(!isPlanningMode); if (isPlanningMode) setTowers([]); }} className={`px-4 py-1.5 rounded-lg flex items-center gap-2 transition-all border outline-none ${isPlanningMode ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-black/20 border-white/10 text-white/40 hover:text-white hover:border-white/30'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" /></svg>
            <span className="text-xs font-mono tracking-widest">{isPlanningMode ? `GRID MODE ACTIVE (${towers.length})` : 'PLAN GRID'}</span>
          </button>
        </div>

        {/* Live Clock + Lunar Day + Export */}
        <div className="pointer-events-auto glass-panel px-5 py-3.5 rounded-2xl flex items-center gap-5">
          <div className="text-right">
            <div className="text-base font-mono font-semibold text-white tracking-tight">{formattedDate}</div>
            <div className="text-sm font-mono text-white/40">{formattedTime} UTC</div>
          </div>
          <div className="w-[1px] h-8 bg-white/10" />
          <div className="text-right">
            <div className="text-base font-mono font-semibold text-amber-300">Day {lunarDay}</div>
            <div className="text-sm font-mono text-white/40">Lunar Cycle</div>
          </div>
          <div className="w-[1px] h-8 bg-white/10" />
          <button 
            onClick={exportBriefing}
            disabled={isExporting}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600/20 to-indigo-600/20 border border-sky-500/30 text-sky-400 hover:border-sky-400/50 hover:text-sky-300 hover:shadow-[0_0_20px_rgba(56,189,248,0.15)] transition-all flex items-center gap-2 text-xs font-mono uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <><div className="w-3.5 h-3.5 border-2 border-sky-400/30 border-t-sky-400 rounded-full" style={{ animation: 'orbit-spin 0.8s linear infinite' }} /><span>Generating...</span></>
            ) : (
              <><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg><span>Export Briefing</span></>
            )}
          </button>
        </div>
      </nav>

      {/* ━━━ MAIN DASHBOARD OVERLAY ━━━ */}
      <div className="absolute inset-0 z-30 pointer-events-none flex justify-between items-stretch p-4 pt-[110px] gap-4 pb-[88px]">
        
        {/* ── LEFT COLUMN: Analytics ── */}
        <aside className="pointer-events-auto w-[380px] flex flex-col gap-3 h-full">
          <div className="glass-panel rounded-2xl flex flex-col flex-1 overflow-hidden p-4">
            <h3 className="text-sm font-mono uppercase tracking-[0.2em] text-white/50 mb-2">Fleet Ops Efficiency</h3>
            <div className="flex-1 min-h-[200px]">
              <CompareChart missions={missions} selectedId={activeId} onSelect={setActiveId} />
            </div>
          </div>
          <div 
            className="glass-panel rounded-2xl flex flex-col h-[300px] overflow-hidden p-4 cursor-pointer hover:border-sky-500/20 transition-all duration-300 group relative"
            onClick={() => setIsTimelineModalOpen(true)}
          >
            <div className="flex items-center gap-2 mb-2">
               <h3 className="text-sm font-mono uppercase tracking-[0.2em] text-white/50 group-hover:text-sky-400 transition-colors">60-Day Window Forecast</h3>
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-white/30 group-hover:text-sky-400 transition-colors"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
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

        {/* ── RIGHT COLUMN: Mission Detail ── */}
        <aside className="pointer-events-auto w-[400px] glass-panel rounded-2xl flex flex-col h-full overflow-hidden">
          {/* Mission Header */}
          <div className="px-5 pt-5 pb-4 border-b border-white/[0.04]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-widest rounded-md ${activeMission.status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                    {activeMission.status}
                  </span>
                  <span className="text-xs font-mono text-white/30 uppercase tracking-widest">{activeMission.era}</span>
                </div>
                <h2 className="text-2xl font-heading font-semibold text-white tracking-tight leading-tight truncate">{activeMission.mission}</h2>
                <p className="text-sm text-slate-500 mt-1 truncate">{activeMission.site_name}</p>
              </div>
              {/* Live Status Orb */}
              <div className="flex flex-col items-center gap-1.5 pt-1">
                <div className="relative">
                  <div className={`w-4 h-4 rounded-full ${isOpsWindow ? 'bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.7)]' : isDaylight ? 'bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.7)]' : 'bg-slate-600 shadow-[0_0_8px_rgba(100,116,139,0.4)]'}`} />
                  {isOpsWindow && <div className="absolute inset-0 rounded-full border border-emerald-400/40" style={{ animation: 'ring-pulse 2s ease-out infinite' }} />}
                </div>
                <span className={`text-xs font-mono uppercase tracking-widest ${isOpsWindow ? 'text-emerald-400' : isDaylight ? 'text-amber-400' : 'text-slate-500'}`}>
                  {isOpsWindow ? 'LIVE' : isDaylight ? 'PARTIAL' : 'DARK'}
                </span>
              </div>
            </div>
          </div>

          {/* Ops Efficiency Hero Metric */}
          <div className="px-5 py-4 border-b border-white/[0.04]">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <span className="text-sm font-mono uppercase tracking-[0.2em] text-sky-400">Live Calculator</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-sm font-mono uppercase tracking-widest text-slate-600 mb-1">Ops Efficiency</div>
                <div className="text-sm font-mono text-slate-500">{metrics.opsHours.toFixed(0)} / {LUNAR_MONTH_HOURS.toFixed(0)} hrs</div>
              </div>
              <div className="text-5xl font-mono font-semibold text-shimmer tracking-tighter leading-none">
                {metrics.opsEfficiency.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Resource Bars */}
          <div className="px-5 py-4 space-y-3 border-b border-white/[0.04]">
            <ProgressBar label="Solar Power" value={metrics.sunHours} pct={sunPct} glowColor="rgba(251,191,36,0.5)" barColor="#fbbf24" textColor="text-amber-400" />
            <ProgressBar label="Earth Link" value={metrics.earthHours} pct={earthPct} glowColor="rgba(96,165,250,0.5)" barColor="#60a5fa" textColor="text-blue-400" />
            <ProgressBar label="Ops Window" value={metrics.opsHours} pct={opsPct} glowColor="rgba(52,211,153,0.5)" barColor="#34d399" textColor="text-emerald-400" />
          </div>

          {/* Mission Yield Simulator */}
          <div className="px-5 py-4 border-b border-white/[0.04] bg-gradient-to-br from-black/0 to-emerald-900/10">
            <div className="flex justify-between items-end mb-3">
              <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-white/30">Estimated Mission Yield</div>
              <div className="text-[9px] font-mono uppercase tracking-widest text-emerald-400/50">Simulated</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/40 rounded-lg p-3 border border-white/5 hover:border-emerald-500/20 transition-colors">
                <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest mb-1">Data Downlink</div>
                <div className="text-xl font-mono text-white">{(metrics.opsHours * 45) > 1000 ? ((metrics.opsHours * 45) / 1024).toFixed(2) + ' TB' : (metrics.opsHours * 45).toFixed(0) + ' GB'}</div>
                <div className="text-[9px] font-sans text-white/30 mt-1">@ 100Mbps Ka-Band</div>
              </div>
              <div className="bg-black/40 rounded-lg p-3 border border-white/5 hover:border-sky-500/20 transition-colors">
                <div className="text-[10px] font-mono text-sky-400 uppercase tracking-widest mb-1">Rover Traverse</div>
                <div className="text-xl font-mono text-white">{(metrics.opsHours * 0.12).toFixed(1)} km</div>
                <div className="text-[9px] font-sans text-white/30 mt-1">@ 120m/hr driving ops</div>
              </div>
            </div>
          </div>

          {/* Sky Path Overlay */}
          <div 
            className="flex-1 min-h-[180px] m-3 bg-black/30 rounded-xl border border-white/[0.04] relative cursor-pointer hover:border-sky-500/20 transition-all duration-300 group overflow-hidden"
            onClick={() => setIsSkyPathModalOpen(true)}
          >
             <div className="absolute top-3 left-3 text-sm font-mono uppercase tracking-[0.2em] text-white/30 group-hover:text-sky-400 transition-colors z-10 flex items-center gap-2">
               Sky Path Overlay
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
             </div>
             <PolarPlot mission={activeMission} simulatedTime={simulatedTime} />
          </div>
        </aside>

      </div>

      {/* ━━━ TIMELINE EXPANDED MODAL ━━━ */}
      {isTimelineModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setIsTimelineModalOpen(false)} />
          <div className="glass-panel p-8 rounded-3xl w-[95vw] max-w-[1200px] h-[85vh] flex flex-col relative animate-fade-slide-up">
            <ModalCloseButton onClick={() => setIsTimelineModalOpen(false)} />
            <div className="mb-6">
              <h2 className="text-3xl font-heading font-semibold text-white tracking-wide">60-Day Historical Window Analysis</h2>
              <p className="text-sm font-mono text-white/30 uppercase tracking-widest mt-1">Fleet Overview • Click any mission row to inspect</p>
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
              <div className="w-[320px] flex-shrink-0 flex flex-col gap-5 border-l border-white/[0.06] pl-8 overflow-y-auto scrollbar-none pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-widest rounded-md border ${activeMission.status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                      {activeMission.status}
                    </span>
                  </div>
                  <h3 className="text-2xl font-heading font-semibold text-white">{activeMission.mission}</h3>
                  <p className="text-sm text-slate-500 mt-1">{activeMission.site_name}</p>
                </div>
                
                <div className="flex justify-between items-end pb-4 border-b border-white/5">
                  <div className="text-sm font-mono uppercase tracking-widest text-slate-600">Ops Efficiency</div>
                  <div className="text-3xl font-mono font-medium text-shimmer tracking-tighter">
                    {metrics.opsEfficiency.toFixed(1)}%
                  </div>
                </div>

                <div className="flex-1 min-h-[300px] w-full relative flex flex-col items-center justify-center">
                  <div className="absolute top-0 left-0 text-sm font-mono uppercase tracking-[0.2em] text-white/30 w-full text-center">Sky Path Overlay</div>
                  <div className="w-full h-full mt-6">
                    <PolarPlot mission={activeMission} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ━━━ SKY PATH EXPANDED MODAL ━━━ */}
      {isSkyPathModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setIsSkyPathModalOpen(false)} />
          <div className="glass-panel p-8 rounded-3xl w-[95vw] max-w-[1200px] h-[85vh] flex flex-col relative animate-fade-slide-up">
            <ModalCloseButton onClick={() => setIsSkyPathModalOpen(false)} />

            <div className="mb-6 border-b border-white/[0.06] pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-heading font-semibold text-white tracking-wide">High-Resolution Sky Path {compareMission && 'Comparison'}</h2>
                <p className="text-sm font-mono text-white/30 uppercase tracking-widest mt-1">Observer: {activeMission.mission}</p>
              </div>
              
              <div className="flex items-center gap-3 pr-12">
                <span className="text-sm font-mono uppercase tracking-widest text-white/40">Compare vs:</span>
                <select 
                  value={compareId || ''}
                  onChange={e => setCompareId(e.target.value || null)}
                  className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none hover:border-sky-500/30 font-sans min-w-[200px] cursor-pointer"
                >
                  <option value="" className="text-white/40">Select a mission...</option>
                  {missions.filter(m => m.mission_id !== activeMission.mission_id).map(m => (
                    <option key={m.mission_id} value={m.mission_id} className="bg-[#05070a] text-white">
                      {m.mission} ({m.provider})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex-1 w-full h-full flex gap-8 overflow-hidden">
              {/* Left Column: Data HUD (Hidden in comparison mode) */}
              {!compareMission && (
                <div className="w-[320px] flex-shrink-0 flex flex-col gap-4 overflow-y-auto scrollbar-none pr-2">
                  <HudCard title="Telemetry Data" accentColor="sky">
                    <HudRow label="Coordinates" value={`${activeMission.lat_deg.toFixed(4)}°, ${activeMission.lon_east_deg.toFixed(4)}°`} mono />
                    <HudRow label="Site Name" value={activeMission.site_name} />
                    <HudRow label="Landing Date" value={activeMission.landing_utc.split('T')[0]} mono />
                    <HudRow label="Ops Duration" value={activeMission.ops_duration} noBorder />
                  </HudCard>

                  <HudCard title="Status Array">
                    <HudRow label="Provider" value={activeMission.provider} bold />
                    <HudRow label="Mission Era" value={activeMission.era} valueColor="text-amber-400" mono />
                    <div className="flex justify-between items-center mt-1 pt-3 border-t border-white/5">
                      <span className="text-sm font-mono text-slate-500 uppercase tracking-widest">Earth Link</span>
                      <span className={`text-sm font-mono px-2.5 py-1 rounded-md ${hasGridCoverage(activeMission.lat_deg, activeMission.lon_east_deg, towers) || Math.abs(activeMission.lon_east_deg) <= 90 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-red-500/15 text-red-400 border border-red-500/25'}`}>
                        {hasGridCoverage(activeMission.lat_deg, activeMission.lon_east_deg, towers) || Math.abs(activeMission.lon_east_deg) <= 90 ? 'NOMINAL' : 'BLACKOUT'}
                      </span>
                    </div>
                  </HudCard>

                  <HudCard title="Payloads" accentColor="emerald">
                    <div className="flex flex-wrap gap-1.5">
                      {activeMission.payloads?.map((p, i) => (
                        <span key={i} className="px-2.5 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-sm text-slate-300 font-mono">{p}</span>
                      ))}
                    </div>
                  </HudCard>
                </div>
              )}

              {/* Right Column: Polar Plots */}
              <div className="flex-1 h-full w-full flex gap-6">
                
                <div className="flex-1 h-full relative flex flex-col items-center justify-center bg-black/25 rounded-2xl border border-white/[0.04] p-4">
                  {compareMission && (
                    <div className="absolute top-5 left-6 right-6 flex justify-between items-start z-10 pointer-events-none">
                      <div>
                        <h3 className="text-2xl font-heading text-sky-400 drop-shadow-md">{activeMission.mission}</h3>
                        <p className="text-xs font-mono text-slate-400 mt-1 uppercase tracking-widest">Primary Observer</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-mono text-white">{activeMission.computedMetrics.opsEfficiency.toFixed(1)}%</div>
                        <p className="text-xs font-mono text-slate-400 mt-1 uppercase tracking-widest">Ops Efficiency</p>
                      </div>
                    </div>
                  )}
                  <PolarPlot mission={activeMission} simulatedTime={simulatedTime} />
                </div>

                {compareMission && (
                  <div className="flex-1 h-full relative flex flex-col items-center justify-center bg-black/25 rounded-2xl border border-white/[0.04] p-4 animate-fade-slide-up">
                    <div className="absolute top-5 left-6 right-6 flex justify-between items-start z-10 pointer-events-none">
                      <div>
                        <h3 className="text-2xl font-heading text-amber-400 drop-shadow-md">{compareMission.mission}</h3>
                        <p className="text-xs font-mono text-slate-400 mt-1 uppercase tracking-widest">Comparison Target</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-mono text-white">{compareMission.computedMetrics.opsEfficiency.toFixed(1)}%</div>
                        <p className="text-xs font-mono text-slate-400 mt-1 uppercase tracking-widest">Ops Efficiency</p>
                      </div>
                    </div>
                    <PolarPlot mission={compareMission} simulatedTime={simulatedTime} />
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      )}

      {/* ━━━ BOTTOM TIME SCRUBBER ━━━ */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-auto w-[640px]">
        <div className="glass-panel p-4 rounded-2xl flex items-center gap-5">
          {/* Play/Pause */}
          <button 
            onClick={() => setIsPlaying(!isPlaying)} 
            className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ${isPlaying ? 'bg-sky-500/20 border border-sky-500/30 shadow-[0_0_20px_rgba(56,189,248,0.25)]' : 'bg-white/[0.06] border border-white/10 hover:bg-white/10'}`}
          >
            {isPlaying ? (
              <div className="flex gap-[3px]">
                <div className="w-[3px] h-3.5 bg-sky-400 rounded-full" />
                <div className="w-[3px] h-3.5 bg-sky-400 rounded-full" />
              </div>
            ) : (
              <div className="w-0 h-0 border-t-[7px] border-t-transparent border-l-[11px] border-l-white/80 border-b-[7px] border-b-transparent ml-1" />
            )}
          </button>

          {/* Scrubber Track */}
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-mono text-white/30 uppercase tracking-[0.2em]">Simulated Time</span>
              <span className="text-sm font-mono font-medium text-white/90">{formattedDate} <span className="text-white/30">{formattedTime}</span></span>
            </div>
            <input 
              type="range" 
              className="scrubber"
              min={timelineStartMs} 
              max={timelineStartMs + timelineDurationHours * 3600000} 
              value={simulatedTime} 
              onChange={(e) => { setSimulatedTime(Number(e.target.value)); setIsPlaying(false); }} 
            />
          </div>

          {/* LIVE Button */}
          <button 
            onClick={() => setSimulatedTime(Date.now())} 
            className="px-4 py-2.5 rounded-lg bg-white/[0.04] hover:bg-sky-500/15 border border-white/[0.08] hover:border-sky-500/25 text-sm font-mono text-white/50 hover:text-sky-400 transition-all duration-200 uppercase tracking-widest"
          >
            Live
          </button>
        </div>
      </div>
    </div>
  );
}

/* ━━━ Subcomponents ━━━ */

function ProgressBar({ label, value, pct, glowColor, barColor, textColor }) {
  return (
    <div>
      <div className="flex justify-between items-end mb-2">
        <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">{label}</span>
        <span className={`text-sm font-mono ${textColor}`}>{value.toFixed(0)} hrs <span className="text-white/20">/ {LUNAR_MONTH_HOURS.toFixed(0)}</span></span>
      </div>
      <div className="w-full h-[6px] rounded-full bg-white/[0.04] overflow-hidden progress-track">
        <div 
          className="h-full rounded-full transition-all duration-500 ease-out" 
          style={{ 
            width: `${Math.min(100, pct)}%`, 
            backgroundColor: barColor,
            boxShadow: `0 0 12px ${glowColor}`
          }} 
        />
      </div>
    </div>
  );
}

function ModalCloseButton({ onClick }) {
  return (
    <button 
      onClick={onClick}
      className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/[0.08] flex items-center justify-center text-white/50 hover:text-white transition-all duration-200 z-50"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
    </button>
  );
}

function HudCard({ title, accentColor = 'white', children }) {
  const dotColor = accentColor === 'sky' ? 'bg-sky-400' : accentColor === 'emerald' ? 'bg-emerald-400' : 'bg-white/40';
  return (
    <div className="p-5 rounded-2xl border border-white/[0.06] bg-black/30 backdrop-blur-sm">
      <div className="text-sm font-mono uppercase tracking-[0.2em] text-white/40 mb-4 flex items-center gap-2">
        {accentColor !== 'white' && <span className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-pulse`} />}
        {title}
      </div>
      <div className="flex flex-col gap-3">
        {children}
      </div>
    </div>
  );
}

function HudRow({ label, value, mono, bold, valueColor, noBorder }) {
  return (
    <div className={`flex justify-between items-center ${noBorder ? '' : 'border-b border-white/[0.04] pb-2'}`}>
      <span className="text-sm font-mono text-slate-600 uppercase tracking-widest">{label}</span>
      <span className={`text-base ${valueColor || 'text-white'} ${mono ? 'font-mono' : ''} ${bold ? 'font-semibold' : ''} text-right max-w-[180px] truncate`}>{value}</span>
    </div>
  );
}
