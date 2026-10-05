"use client";

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export default function PolarPlot({ mission }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // We use a small delay to ensure the container has reached its final size (e.g., when modal opens)
    const renderChart = () => {
      d3.select(chartRef.current).selectAll('*').remove();
      if (!mission) return;

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
        .attr('id', 'skyGradient')
        .attr('cx', '50%')
        .attr('cy', '50%')
        .attr('r', '50%');
      skyGradient.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(14, 165, 233, 0.15)'); // Subtle sky blue core
      skyGradient.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(5, 7, 10, 0)');

      const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

      // Dome Background
      g.append('circle')
        .attr('r', radius)
        .attr('fill', 'url(#skyGradient)')
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
            .attr('font-size', isLarge ? '12px' : '9px')
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
        
        // Glassy pill background for compass labels if large
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
          .attr('font-size', isLarge ? '12px' : '10px')
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

      const drawPath = (trackData, color, glowColor, name) => {
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
        path
          .attr('stroke-dasharray', totalLength)
          .attr('stroke-dashoffset', totalLength)
          .transition()
          .duration(2000)
          .ease(d3.easeCubicOut)
          .attr('stroke-dashoffset', 0);

        // Add a glowing "Orb" at the highest elevation point of the track to look cool
        const peak = trackData.reduce((prev, current) => (prev.el > current.el) ? prev : current);
        if (peak.el > 0) {
            const [px, py] = polarToXY(peak.az, peak.el);
            const orbGroup = g.append('g')
                .attr('transform', `translate(${px},${py})`)
                .style('opacity', 0);
                
            orbGroup.append('circle')
                .attr('r', isLarge ? 8 : 4)
                .attr('fill', '#fff')
                .style('filter', `drop-shadow(0 0 ${isLarge ? 15 : 8}px ${color})`);
            
            orbGroup.append('circle')
                .attr('r', isLarge ? 4 : 2)
                .attr('fill', color);

            orbGroup.transition().delay(1500).duration(1000).style('opacity', 1);
        }
      };

      let sunTrack = mission.tracks?.sun;
      let earthTrack = mission.tracks?.earth;

      if (!sunTrack) {
        sunTrack = [];
        for (let i = 0; i <= 180; i += 10) {
          const az = 90 + i; 
          const maxEl = 90 - Math.abs(mission.lat_deg);
          const el = (maxEl + 10) * Math.sin((i / 180) * Math.PI) - 10;
          sunTrack.push({ az, el });
        }
      }
      
      if (!earthTrack) {
        earthTrack = [];
        const isFarSide = Math.abs(mission.lon_east_deg) > 90;
        if (!isFarSide) {
           const earthEl = 90 - Math.sqrt(mission.lat_deg*mission.lat_deg + mission.lon_east_deg*mission.lon_east_deg);
           const earthAz = mission.lat_deg > 0 ? 180 : 0; 
           earthTrack.push({ az: earthAz - 5, el: earthEl - 2 });
           earthTrack.push({ az: earthAz + 5, el: earthEl + 2 });
        } else {
           earthTrack.push({ az: 0, el: -20 });
           earthTrack.push({ az: 0, el: -20 });
        }
      }

      drawPath(sunTrack, '#fbbf24', 'rgba(251, 191, 36, 0.8)', 'Sun');
      drawPath(earthTrack, '#2dd4bf', 'rgba(45, 212, 191, 0.8)', 'Earth');
    };

    // Use ResizeObserver to re-render when container size changes (like modal opening)
    const observer = new ResizeObserver(() => {
        renderChart();
    });
    observer.observe(chartRef.current.parentElement);

    return () => observer.disconnect();

  }, [mission]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div ref={chartRef} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }} />
      {mission && (
        <div style={{ display: 'flex', gap: '16px', padding: '0', justifyContent: 'center', marginTop: 'auto', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>
            <div style={{ width: 12, height: 3, borderRadius: 2, backgroundColor: '#fbbf24', boxShadow: '0 0 8px rgba(251, 191, 36, 0.8)' }} /> Sun Path
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>
            <div style={{ width: 12, height: 3, borderRadius: 2, backgroundColor: '#2dd4bf', boxShadow: '0 0 8px rgba(45, 212, 191, 0.8)' }} /> Earth Path
          </div>
        </div>
      )}
    </div>
  );
}
