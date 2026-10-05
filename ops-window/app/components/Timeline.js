"use client";

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export default function Timeline({ missions, selectedId, onSelect }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!missions || missions.length === 0 || !chartRef.current) return;

    d3.select(chartRef.current).selectAll('*').remove();

    const rect = chartRef.current.getBoundingClientRect();
    const margin = { top: 10, right: 20, bottom: 30, left: 120 };
    const rowHeight = 50;
    const height = missions.length * rowHeight + margin.top + margin.bottom;
    const width = rect.width - margin.left - margin.right;

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', rect.width)
      .attr('height', Math.max(height, 280))
      .attr('role', 'img')
      .attr('aria-label', 'Timeline showing sun, Earth, and overlap intervals per mission');

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    let maxHour = 0;
    missions.forEach(m => {
      ['sun', 'earth', 'overlap'].forEach(key => {
        (m.intervals[key] || []).forEach(([s, e]) => {
          if (e > maxHour) maxHour = e;
        });
      });
    });

    const x = d3.scaleLinear()
      .domain([0, Math.min(maxHour, 2200)])
      .range([0, width]);

    const y = d3.scaleBand()
      .domain(missions.map(m => m.mission_id))
      .range([0, missions.length * rowHeight])
      .padding(0.3);

    g.append('g')
      .attr('class', 'chart-axis')
      .attr('transform', `translate(0,${missions.length * rowHeight})`)
      .call(d3.axisBottom(x).ticks(8).tickFormat(d => `${d}h`));

    g.append('g')
      .attr('class', 'chart-grid')
      .call(d3.axisTop(x).tickSize(-(missions.length * rowHeight)).tickFormat(''))
      .attr('transform', 'translate(0,0)');

    const barHeight = y.bandwidth() / 3 - 1;
    const colors = {
      sun: '#f59e0b',
      earth: '#14b8a6',
      overlap: '#22c55e'
    };
    const offsets = { sun: 0, earth: 1, overlap: 2 };

    missions.forEach(mission => {
      const missionG = g.append('g')
        .attr('class', 'timeline-row')
        .attr('data-mission-id', mission.mission_id);

      missionG.append('text')
        .attr('class', 'timeline-label')
        .attr('x', -8)
        .attr('y', y(mission.mission_id) + y.bandwidth() / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('fill', 'var(--text-secondary)')
        .attr('font-size', '0.75rem')
        .style('cursor', 'pointer')
        .text(mission.mission.length > 15 ? mission.mission.slice(0, 14) + '…' : mission.mission)
        .on('mouseenter', function() { d3.select(this).attr('fill', 'var(--text-primary)'); })
        .on('mouseleave', function() { d3.select(this).attr('fill', 'var(--text-secondary)'); })
        .on('click', () => { if (onSelect) onSelect(mission.mission_id); });

      ['sun', 'earth', 'overlap'].forEach(key => {
        const intervals = mission.intervals[key] || [];
        const barY = y(mission.mission_id) + offsets[key] * (barHeight + 1);

        intervals.forEach(([start, end]) => {
          const clampedStart = Math.max(0, start);
          const clampedEnd = Math.min(end, x.domain()[1]);
          if (clampedStart >= clampedEnd) return;

          missionG.append('rect')
            .attr('class', 'timeline-bar')
            .attr('x', x(clampedStart))
            .attr('y', barY)
            .attr('width', 0)
            .attr('height', barHeight)
            .attr('rx', 3)
            .attr('ry', 3)
            .attr('fill', colors[key])
            .attr('opacity', key === 'overlap' ? 0.9 : 0.5)
            .style('cursor', 'pointer')
            .style('transition', 'opacity 150ms ease')
            .on('mouseenter', function() { d3.select(this).style('opacity', '0.9'); })
            .on('mouseleave', function() { 
              const isSelected = d3.select(this.parentNode).classed('selected');
              const isDimmed = d3.select(this.parentNode).classed('dimmed');
              if (isSelected) d3.select(this).style('opacity', '1');
              else if (isDimmed) d3.select(this).style('opacity', '0.2');
              else d3.select(this).style('opacity', key === 'overlap' ? '0.9' : '0.5');
            })
            .on('click', () => { if (onSelect) onSelect(mission.mission_id); })
            .transition()
            .duration(800)
            .delay(offsets[key] * 150)
            .attr('width', x(clampedEnd) - x(clampedStart))
            .ease(d3.easeCubicOut);
        });
      });
    });

  }, [missions, onSelect]);

  useEffect(() => {
    if (!chartRef.current) return;
    
    const svg = d3.select(chartRef.current);
    
    svg.selectAll('.timeline-row').each(function() {
      const row = d3.select(this);
      const rowId = row.attr('data-mission-id');
      if (selectedId) {
        row.classed('selected', rowId === selectedId);
        row.classed('dimmed', rowId !== selectedId);
        
        row.selectAll('.timeline-bar').each(function() {
            if (rowId === selectedId) {
                d3.select(this).style('opacity', '1');
            } else {
                d3.select(this).style('opacity', '0.2');
            }
        });
      } else {
        row.classed('selected', false);
        row.classed('dimmed', false);
        row.selectAll('.timeline-bar').each(function() {
            const key = d3.select(this).attr('fill') === '#22c55e' ? 'overlap' : 'other';
            d3.select(this).style('opacity', key === 'overlap' ? '0.9' : '0.5');
        });
      }
    });
  }, [selectedId]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div 
        style={{ 
            width: '100%', 
            height: 280, 
            overflowX: 'auto', 
            overflowY: 'hidden' 
        }}
      >
        <div ref={chartRef} style={{ minWidth: 600, height: '100%' }} />
      </div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        padding: '8px 16px',
        justifyContent: 'center',
        marginTop: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          <div style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: '#f59e0b' }} /> Sun Visible
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          <div style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: '#14b8a6' }} /> Earth Visible
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          <div style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: '#22c55e' }} /> Ops Window (Overlap)
        </div>
      </div>
    </div>
  );
}
