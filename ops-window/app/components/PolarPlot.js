"use client";

import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';

export default function PolarPlot({ mission }) {
  const chartRef = useRef(null);
  const renderedIdRef = useRef(null);
  const resizeTimerRef = useRef(null);

  // Extract only the stable geometric properties that actually affect the plot.
  // This prevents re-renders when computedMetrics change during simulation.
  const stableMission = useMemo(() => {
    if (!mission) return null;
    return {
      mission_id: mission.mission_id,
      lat_deg: mission.lat_deg,
      lon_east_deg: mission.lon_east_deg,
      tracks: mission.tracks,
    };
  }, [mission?.mission_id, mission?.lat_deg, mission?.lon_east_deg, mission?.tracks]);

  useEffect(() => {
    if (!chartRef.current || !stableMission) return;

    const renderChart = (animate = true) => {
      d3.select(chartRef.current).selectAll('*').remove();

      const container = chartRef.current.parentElement;
      const size = Math.min(container.offsetWidth, container.offsetHeight, 600) || 300;
      const radius = size / 2 - (size > 400 ? 40 : 20);
      const cx = size / 2;
      const cy = size / 2;
      const isLarge = size > 400;

      const svg = d3.select(chartRef.current)
        .append('svg')
        .attr('width', size)
        .attr('height', size)
        .attr('role', 'img')
        .style('overflow', 'visible');

      // Definitions for gradients and glow effects
      const defs = svg.append('defs');
      
      const skyGradient = defs.append('radialGradient')
        .attr('id', 'skyGradient-' + stableMission.mission_id)
        .attr('cx', '50%')
        .attr('cy', '50%')
        .attr('r', '50%');
      skyGradient.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(14, 165, 233, 0.15)');
      skyGradient.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(5, 7, 10, 0)');

      const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

      // Dome Background
      g.append('circle')
        .attr('r', radius)
        .attr('fill', `url(#skyGradient-${stableMission.mission_id})`)
        .attr('stroke', 'rgba(255,255,255,0.1)')
        .attr('stroke-width', 1);

      const elevationScale = d3.scaleLinear()
        .domain([90, -90])
        .range([0, radius]);

      // Draw Grid Circles
      [0, 15, 30, 45, 60, 75].forEach(elev => {
        const r = elevationScale(elev);
        g.append('circle')
          .attr('cx', 0).attr('cy', 0)
          .attr('r', r)
          .attr('fill', 'none')
          .attr('stroke', elev === 0 ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.05)')
          .attr('stroke-width', elev === 0 ? 2 : 1)
          .attr('stroke-dasharray', elev === 0 ? '4 4' : '2 4');

        if (elev % 30 === 0) {
          g.append('text')
            .attr('x', r + (isLarge ? 6 : 4))
            .attr('y', 4)
            .attr('text-anchor', 'start')
            .attr('fill', 'rgba(255,255,255,0.3)')
            .attr('font-size', isLarge ? '14px' : '11px')
            .attr('font-family', 'monospace')
            .text(`${elev}°`);
        }
      });

      // Draw Compass Axes
      const directions = [
        { label: 'N', az: 0 }, { label: 'E', az: 90 },
        { label: 'S', az: 180 }, { label: 'W', az: 270 }
      ];

      directions.forEach(({ label, az }) => {
        const rad = (az - 90) * Math.PI / 180;
        const lineR = elevationScale(-5);
        g.append('line')
          .attr('x1', 0).attr('y1', 0)
          .attr('x2', Math.cos(rad) * lineR)
          .attr('y2', Math.sin(rad) * lineR)
          .attr('stroke', 'rgba(255, 255, 255, 0.1)')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '2 4');

        const labelR = radius + (isLarge ? 20 : 12);
        
        if (isLarge) {
          g.append('rect')
            .attr('x', Math.cos(rad) * labelR - 12)
            .attr('y', Math.sin(rad) * labelR - 12)
            .attr('width', 24)
            .attr('height', 24)
            .attr('rx', 12)
            .attr('fill', 'rgba(255,255,255,0.05)')
            .attr('stroke', 'rgba(255,255,255,0.1)');
        }

        g.append('text')
          .attr('x', Math.cos(rad) * labelR)
          .attr('y', Math.sin(rad) * labelR + (isLarge ? 4 : 3))
          .attr('text-anchor', 'middle')
          .attr('fill', 'rgba(255,255,255,0.8)')
          .attr('font-size', isLarge ? '14px' : '13px')
          .attr('font-weight', 'bold')
          .attr('font-family', 'sans-serif')
          .text(label);
      });

      // Center Zenith Point
      g.append('circle')
        .attr('r', 3)
        .attr('fill', '#fff')
        .style('filter', 'drop-shadow(0 0 5px #fff)');

      function polarToXY(az, el) {
        const r = elevationScale(el);
        const rad = (az - 90) * Math.PI / 180;
        return [Math.cos(rad) * r, Math.sin(rad) * r];
      }

      const drawPath = (trackData, color, glowColor) => {
        if (!trackData || trackData.length < 2) return;

        const line = d3.line()
          .x(d => polarToXY(d.az, d.el)[0])
          .y(d => polarToXY(d.az, d.el)[1])
          .curve(d3.curveCatmullRom.alpha(0.5));

        const path = g.append('path')
          .datum(trackData)
          .attr('d', line)
          .attr('fill', 'none')
          .attr('stroke', color)
          .attr('stroke-width', isLarge ? 4 : 2.5)
          .attr('stroke-linecap', 'round')
          .style('filter', `drop-shadow(0 0 ${isLarge ? 12 : 6}px ${glowColor})`);

        const totalLength = path.node().getTotalLength();
        path.attr('stroke-dasharray', totalLength);
        path.style('--path-length', totalLength);
        
        // Use native CSS animation so it survives React re-renders and modal resize events
        path.style('animation', 'drawSkyPath 4s linear infinite');

        // Glowing orb at peak elevation
        const peak = trackData.reduce((prev, current) => (prev.el > current.el) ? prev : current);
        if (peak.el > 0) {
          const [px, py] = polarToXY(peak.az, peak.el);
          const orbGroup = g.append('g')
            .attr('transform', `translate(${px},${py})`)
            .style('opacity', animate ? 0 : 1);
              
          orbGroup.append('circle')
            .attr('r', isLarge ? 8 : 4)
            .attr('fill', '#fff')
            .style('filter', `drop-shadow(0 0 ${isLarge ? 15 : 8}px ${color})`);
          
          orbGroup.append('circle')
            .attr('r', isLarge ? 4 : 2)
            .attr('fill', color);

          orbGroup.style('animation', 'orbFade 4s linear infinite');
        }
      };

      let sunTrack = stableMission.tracks?.sun;
      let earthTrack = stableMission.tracks?.earth;

      if (!sunTrack) {
        sunTrack = [];
        for (let i = 0; i <= 180; i += 10) {
          const az = 90 + i; 
          const maxEl = 90 - Math.abs(stableMission.lat_deg);
          const el = (maxEl + 10) * Math.sin((i / 180) * Math.PI) - 10;
          sunTrack.push({ az, el });
        }
      }
      
      if (!earthTrack) {
        earthTrack = [];
        const isFarSide = Math.abs(stableMission.lon_east_deg) > 90;
        if (!isFarSide) {
           const earthEl = 90 - Math.sqrt(stableMission.lat_deg*stableMission.lat_deg + stableMission.lon_east_deg*stableMission.lon_east_deg);
           const earthAz = stableMission.lat_deg > 0 ? 180 : 0; 
           earthTrack.push({ az: earthAz - 5, el: earthEl - 2 });
           earthTrack.push({ az: earthAz + 5, el: earthEl + 2 });
        } else {
           earthTrack.push({ az: 0, el: -20 });
           earthTrack.push({ az: 0, el: -20 });
        }
      }

      drawPath(sunTrack, '#fbbf24', 'rgba(251, 191, 36, 0.8)');
      drawPath(earthTrack, '#2dd4bf', 'rgba(45, 212, 191, 0.8)');

      renderedIdRef.current = stableMission.mission_id;
    };

    // Initial draw with animation
    renderChart(true);

    // Debounced resize handler — redraws WITHOUT animation to avoid flickering
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        renderChart(false);
      }, 200);
    });
    observer.observe(chartRef.current.parentElement);

    return () => {
      observer.disconnect();
      clearTimeout(resizeTimerRef.current);
    };

  }, [stableMission]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div ref={chartRef} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }} />
      {mission && (
        <div style={{ display: 'flex', gap: '20px', padding: '0', justifyContent: 'center', marginTop: 'auto', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace' }}>
            <div style={{ width: 16, height: 4, borderRadius: 2, backgroundColor: '#fbbf24', boxShadow: '0 0 8px rgba(251, 191, 36, 0.8)' }} /> Sun Path
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace' }}>
            <div style={{ width: 16, height: 4, borderRadius: 2, backgroundColor: '#2dd4bf', boxShadow: '0 0 8px rgba(45, 212, 191, 0.8)' }} /> Earth Path
          </div>
        </div>
      )}
    </div>
  );
}
