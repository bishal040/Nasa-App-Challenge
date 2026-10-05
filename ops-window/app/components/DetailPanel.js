"use client";

import { useEffect, useState } from 'react';

const getEfficiencyColor = (eff) => {
  if (eff <= 0) return '#ef4444';
  if (eff < 0.3) return '#f97316';
  if (eff < 0.6) return '#f59e0b';
  if (eff < 0.85) return '#22c55e';
  return '#10b981';
};

const formatHours = (h) => {
  if (h >= 1000) return `${(h / 24).toFixed(0)}d`;
  return `${h}h`;
};

export default function DetailPanel({ mission, onClose }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isActive = !!mission;

  return (
    <>
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 200,
          opacity: isActive ? 1 : 0,
          pointerEvents: isActive ? 'all' : 'none',
          transition: 'opacity 250ms ease'
        }}
        onClick={onClose}
        aria-hidden={!isActive}
      />

      <aside 
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 440,
          maxWidth: '90vw',
          height: '100vh',
          background: 'var(--space-deep)',
          borderLeft: '1px solid var(--glass-border)',
          boxShadow: '-8px 0 40px rgba(0, 0, 0, 0.6)',
          zIndex: 300,
          transform: isActive ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 400ms ease',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}
        role="complementary" 
        aria-label="Mission details"
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px',
          borderBottom: '1px solid var(--border-subtle)',
          position: 'sticky',
          top: 0,
          background: 'var(--space-deep)',
          zIndex: 2
        }}>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>
            {mission ? mission.mission : 'Mission Details'}
          </h2>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-secondary)',
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              transition: 'all 150ms ease'
            }}
            aria-label="Close panel"
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--danger-red-soft)';
              e.currentTarget.style.borderColor = 'var(--danger-red)';
              e.currentTarget.style.color = 'var(--danger-red)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'var(--glass-border)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '24px', flex: 1 }}>
          {mission && (
            <>
              {/* Efficiency Gauge */}
              <div style={{
                margin: '16px 0',
                padding: '16px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center'
              }}>
                <div style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '2.8rem',
                  fontWeight: 700,
                  lineHeight: 1,
                  marginBottom: 4,
                  color: getEfficiencyColor(mission.metrics.ops_efficiency)
                }}>
                  {(mission.metrics.ops_efficiency * 100).toFixed(1)}%
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-dim)',
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em'
                }}>
                  Ops Efficiency
                </div>
                <div style={{
                  width: '100%',
                  height: 8,
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 'var(--radius-full)',
                  marginTop: 8,
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    borderRadius: 'var(--radius-full)',
                    transition: 'width 400ms ease',
                    width: `${(mission.metrics.ops_efficiency * 100)}%`,
                    background: getEfficiencyColor(mission.metrics.ops_efficiency)
                  }} />
                </div>
              </div>

              {/* Metrics */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 8,
                marginTop: 16
              }}>
                <MetricCard val={formatHours(mission.metrics.sun_hours)} label="☀ Sun Hours" color="var(--solar-gold)" />
                <MetricCard val={formatHours(mission.metrics.earth_hours)} label="🌍 Earth Hours" color="var(--earth-teal)" />
                <MetricCard val={formatHours(mission.metrics.overlap_hours)} label="⚡ Overlap" color="var(--overlap-green)" />
              </div>

              {/* Mission Info */}
              <div style={{ marginTop: 32 }}>
                <div style={{
                  fontSize: '0.7rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-dim)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: 8
                }}>Mission Information</div>
                <Field label="Provider" val={mission.provider} />
                <Field label="Landing Site" val={mission.site_name} />
                <Field label="Coordinates" val={`${mission.lat_deg.toFixed(4)}° N, ${mission.lon_east_deg.toFixed(4)}° E`} mono />
                <Field label="Landing Date" val={mission.landing_utc ? new Date(mission.landing_utc).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'TBD'} />
                <Field label="Status" val={<span className={`badge badge-${mission.status}`}>{mission.status}</span>} />
                <Field label="Ops Duration" val={mission.ops_duration} />
                <Field label="End Reason" val={mission.end_reason} />
                <Field label="Confidence" val={<span className={`badge badge-${mission.confidence}`}>{mission.confidence}</span>} />
              </div>

              {/* Payloads */}
              {mission.payloads && mission.payloads.length > 0 && (
                <div style={{ marginTop: 32 }}>
                  <div style={{
                    fontSize: '0.7rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-dim)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginBottom: 8
                  }}>Payloads</div>
                  {mission.payloads.map((p, i) => (
                    <div key={i} style={{ padding: '4px 0', color: 'var(--text-secondary)', fontWeight: 400 }}>
                      • {p}
                    </div>
                  ))}
                </div>
              )}

              {/* Source */}
              {mission.source_url && (
                <div style={{ marginTop: 32 }}>
                  <div style={{
                    fontSize: '0.7rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-dim)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginBottom: 8
                  }}>Data Source</div>
                  <a href={mission.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>
                    {mission.source_url}
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

function MetricCard({ val, label, color }) {
  return (
    <div style={{
      padding: 16,
      background: 'rgba(255,255,255,0.03)',
      borderRadius: 'var(--radius-md)',
      textAlign: 'center',
      border: '1px solid var(--border-subtle)'
    }}>
      <div style={{
        fontFamily: 'var(--font-heading)',
        fontSize: '1.4rem',
        fontWeight: 700,
        lineHeight: 1,
        marginBottom: 2,
        color
      }}>{val}</div>
      <div style={{
        fontSize: '0.65rem',
        color: 'var(--text-dim)',
        fontFamily: 'var(--font-mono)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>{label}</div>
    </div>
  );
}

function Field({ label, val, mono }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid var(--border-subtle)'
    }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{label}</span>
      <span style={{
        color: 'var(--text-primary)',
        fontWeight: 500,
        fontSize: mono ? '0.8rem' : '0.85rem',
        textAlign: 'right',
        maxWidth: '60%',
        fontFamily: mono ? 'var(--font-mono)' : 'inherit'
      }}>
        {val}
      </span>
    </div>
  );
}
