"use client";

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export default function Timeline({ missions, selectedId, onSelect, timelineStartMs, simulatedTime, durationHours }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const renderChart = () => {
      if (!missions || missions.length === 0) return;
      d3.select(chartRef.current).selectAll('*').remove();

      const rect = chartRef.current.parentElement.getBoundingClientRect();
      const isLarge = rect.height > 400; // Detect if it's running in the expanded modal
      
      const margin = { top: 10, right: 20, bottom: 30, left: isLarge ? 160 : 100 };
      const rowHeight = isLarge ? 45 : 35; // Taller rows in modal
      const height = missions.length * rowHeight + margin.top + margin.bottom;
      const width = rect.width - margin.left - margin.right;

      const svg = d3.select(chartRef.current)
        .append('svg')
        .attr('width', rect.width)
        .attr('height', Math.max(height, 200))
        .attr('role', 'img');

      const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const x = d3.scaleLinear()
        .domain([0, durationHours || 1440])
        .range([0, width]);

      const y = d3.scaleBand()
        .domain(missions.map(m => m.mission_id))
        .range([0, missions.length * rowHeight])
        .padding(0.3);

      g.append('g')
        .attr('transform', `translate(0,${missions.length * rowHeight})`)
        .call(d3.axisBottom(x).ticks(isLarge ? 16 : 8).tickFormat(d => `${d}h`))
        .attr('color', 'rgba(255,255,255,0.2)')
        .selectAll('text')
        .attr('font-size', isLarge ? '14px' : '12px');

      g.append('g')
        .attr('class', 'chart-grid')
        .call(d3.axisTop(x).tickSize(-(missions.length * rowHeight)).tickFormat(''))
        .attr('color', 'rgba(255,255,255,0.05)');

      const barHeight = Math.max(2, y.bandwidth() / 3 - 1);
      const colors = { sun: '#fbbf24', earth: '#2dd4bf', overlap: '#34d399' };
      const offsets = { sun: 0, earth: 1, overlap: 2 };

      missions.forEach(mission => {
        const missionG = g.append('g')
          .attr('class', 'timeline-row')
          .attr('data-mission-id', mission.mission_id);

        missionG.append('text')
          .attr('x', -8)
          .attr('y', y(mission.mission_id) + y.bandwidth() / 2)
          .attr('text-anchor', 'end')
          .attr('dominant-baseline', 'middle')
          .attr('fill', 'rgba(255,255,255,0.5)')
          .attr('font-size', isLarge ? '14px' : '12px')
          .attr('font-family', 'monospace')
          .style('cursor', 'pointer')
          .text(mission.mission.length > (isLarge ? 20 : 12) ? mission.mission.slice(0, isLarge ? 19 : 11) + '…' : mission.mission)
          .on('mouseenter', function() { d3.select(this).attr('fill', '#fff'); })
          .on('mouseleave', function() { d3.select(this).attr('fill', 'rgba(255,255,255,0.5)'); })
          .on('click', () => { if (onSelect) onSelect(mission.mission_id); });

        ['sun', 'earth', 'overlap'].forEach(key => {
          const intervals = mission.intervals?.[key] || [];
          const barY = y(mission.mission_id) + offsets[key] * (barHeight + 1);

          intervals.forEach(([start, end]) => {
            const clampedStart = Math.max(0, start);
            const clampedEnd = Math.min(end, x.domain()[1]);
            if (clampedStart >= clampedEnd) return;

            missionG.append('rect')
              .attr('class', 'timeline-bar')
              .attr('x', x(clampedStart))
              .attr('y', barY)
              .attr('width', x(clampedEnd) - x(clampedStart))
              .attr('height', barHeight)
              .attr('rx', 2)
              .attr('ry', 2)
              .attr('fill', colors[key])
              .attr('opacity', key === 'overlap' ? 1 : 0.4)
              .style('cursor', 'pointer')
              .on('mouseenter', function() { d3.select(this).style('opacity', '1'); })
              .on('mouseleave', function() { 
                const isSelected = d3.select(this.parentNode).classed('selected');
                d3.select(this).style('opacity', isSelected ? '1' : (key === 'overlap' ? '0.9' : '0.4'));
              })
              .on('click', () => { if (onSelect) onSelect(mission.mission_id); });
          });
        });
      });

      const playheadGroup = g.append('g').attr('class', 'playhead');
      playheadGroup.append('line')
        .attr('y1', 0)
        .attr('y2', missions.length * rowHeight)
        .attr('stroke', '#38bdf8')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4 4');
        
      // Re-apply playhead position immediately on render
      if (timelineStartMs && simulatedTime) {
          const currentHour = (simulatedTime - timelineStartMs) / 3600000;
          svg.select('.playhead line').attr('x1', x(currentHour)).attr('x2', x(currentHour));
      }
    };

    const observer = new ResizeObserver(() => {
        renderChart();
    });
    observer.observe(chartRef.current.parentElement);

    return () => observer.disconnect();

  }, [missions, onSelect, durationHours, timelineStartMs, simulatedTime]);

  // Update Playhead & Selection efficiently
  useEffect(() => {
    if (!chartRef.current) return;
    const svg = d3.select(chartRef.current);
    
    // Update Playhead position
    if (timelineStartMs && simulatedTime) {
      const rect = chartRef.current.getBoundingClientRect();
      const width = rect.width - 120;
      const x = d3.scaleLinear().domain([0, durationHours || 1440]).range([0, width]);
      const currentHour = (simulatedTime - timelineStartMs) / 3600000;
      
      svg.select('.playhead line')
        .attr('x1', x(currentHour))
        .attr('x2', x(currentHour));
    }

    svg.selectAll('.timeline-row').each(function() {
      const row = d3.select(this);
      const rowId = row.attr('data-mission-id');
      if (selectedId) {
        row.classed('selected', rowId === selectedId);
        row.selectAll('.timeline-bar').style('opacity', rowId === selectedId ? '1' : '0.1');
      } else {
        row.classed('selected', false);
        row.selectAll('.timeline-bar').each(function() {
            const key = d3.select(this).attr('fill') === '#34d399' ? 'overlap' : 'other';
            d3.select(this).style('opacity', key === 'overlap' ? '1' : '0.4');
        });
      }
    });
  }, [selectedId, simulatedTime, timelineStartMs, durationHours]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ width: '100%', flex: 1, overflowX: 'hidden', overflowY: 'auto' }} className="scrollbar-none">
        <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '8px 0', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace' }}>
          <div style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: '#fbbf24' }} /> Sun
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace' }}>
          <div style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: '#2dd4bf' }} /> Earth
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace' }}>
          <div style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: '#34d399' }} /> Ops Window
        </div>
      </div>
    </div>
  );
}
