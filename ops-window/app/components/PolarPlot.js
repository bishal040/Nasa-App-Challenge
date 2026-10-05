"use client";

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export default function PolarPlot({ mission }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    d3.select(chartRef.current).selectAll('*').remove();

    if (!mission) {
      return;
    }

    const container = chartRef.current.parentElement;
    const size = Math.min(container.offsetWidth, 300) || 280;
    const radius = size / 2 - 30;
    const cx = size / 2;
    const cy = size / 2;

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', size)
      .attr('height', size)
      .attr('role', 'img')
      .attr('aria-label', `Sky plot for ${mission.mission} showing Sun and Earth paths`);

    const g = svg.append('g')
      .attr('transform', `translate(${cx},${cy})`);

    const elevationScale = d3.scaleLinear()
      .domain([90, -90])
      .range([0, radius]);

    [0, 15, 30, 45, 60, 75, 90].forEach(elev => {
      const r = elevationScale(elev);
      g.append('circle')
        .attr('cx', 0).attr('cy', 0)
        .attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', elev === 0 ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.06)')
        .attr('stroke-width', elev === 0 ? 2 : 1)
        .attr('stroke-dasharray', elev === 0 ? '6 4' : 'none');

      if (elev % 30 === 0 && elev !== 90) {
        g.append('text')
          .attr('x', r + 4)
          .attr('y', 4)
          .attr('text-anchor', 'start')
          .attr('fill', 'var(--text-dim)')
          .attr('font-size', '0.55rem')
          .attr('font-family', 'var(--font-mono)')
          .text(`${elev}°`);
      }
    });

    const directions = [
      { label: 'N', az: 0 }, { label: 'E', az: 90 },
      { label: 'S', az: 180 }, { label: 'W', az: 270 }
    ];

    directions.forEach(({ label, az }) => {
      const rad = (az - 90) * Math.PI / 180;
      const lineR = elevationScale(-10);
      g.append('line')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', Math.cos(rad) * lineR)
        .attr('y2', Math.sin(rad) * lineR)
        .attr('stroke', 'rgba(255, 255, 255, 0.08)')
        .attr('stroke-width', 1);

      const labelR = radius + 16;
      g.append('text')
        .attr('x', Math.cos(rad) * labelR)
        .attr('y', Math.sin(rad) * labelR + 4)
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--text-dim)')
        .attr('font-size', '0.7rem')
        .attr('font-family', 'var(--font-mono)')
        .text(label);
    });

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
        .attr('stroke-width', 2.5)
        .attr('stroke-linecap', 'round')
        .style('filter', `drop-shadow(0 0 4px ${glowColor})`);

      const totalLength = path.node().getTotalLength();
      path
        .attr('stroke-dasharray', totalLength)
        .attr('stroke-dashoffset', totalLength)
        .transition()
        .duration(1500)
        .ease(d3.easeCubicInOut)
        .attr('stroke-dashoffset', 0);
    };

    if (mission.tracks) {
      drawPath(mission.tracks.sun, 'var(--solar-gold)', 'var(--solar-gold-glow)');
      drawPath(mission.tracks.earth, 'var(--earth-teal)', 'var(--earth-teal-glow)');
    }

  }, [mission]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div 
        ref={chartRef} 
        style={{ 
            width: '100%', 
            height: 280, 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            position: 'relative'
        }} 
      >
        {!mission && (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-dim)',
                textAlign: 'center',
                gap: '8px',
                padding: '20px'
            }}>
                <div style={{ fontSize: '2.5rem', opacity: 0.5 }}>🔭</div>
                <p style={{ fontSize: '0.85rem', maxWidth: 250 }}>
                    Select a mission to view Sun &amp; Earth paths across the sky at that landing site
                </p>
            </div>
        )}
      </div>
      
      {mission && (
        <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            padding: '8px 16px',
            justifyContent: 'center'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            <div style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: 'var(--solar-gold)' }} /> Sun Path
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            <div style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: 'var(--earth-teal)' }} /> Earth Path
            </div>
        </div>
      )}
    </div>
  );
}
