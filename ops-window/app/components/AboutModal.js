"use client";

import { useEffect, useState } from 'react';

export default function AboutModal({ open, onClose }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0, 0, 0, 0.6)',
        zIndex: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'all' : 'none',
        transition: 'opacity 250ms ease'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-hidden={!open}
    >
      <div className="glass-panel" style={{
        background: 'var(--glass-bg-solid)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 24px 80px rgba(0, 0, 0, 0.5)',
        maxWidth: 560,
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto',
        padding: '32px'
      }}>
        <h2 style={{ marginBottom: 16 }}>About Ops Window</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.7 }}>
          Two angles decide what a lunar lander can do: how high the <strong style={{ color: 'var(--solar-gold)' }}>Sun</strong>
          {' '}sits above the horizon (power) and how high <strong style={{ color: 'var(--earth-teal)' }}>Earth</strong> sits
          above the horizon (communications). Real work only happens when <strong>both are up at once</strong> —
          the <strong style={{ color: 'var(--overlap-green)' }}>ops window</strong>.
        </p>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.7 }}>
          We compute that overlap for every lunar landing site from Surveyor to CLPS,
          using elevation data from JPL Horizons queried hourly across a full year.
        </p>

        <h3 style={{ margin: '16px 0 8px', fontSize: '0.95rem' }}>Known Limitations</h3>
        <ul style={{ listStyle: 'none', marginBottom: 16 }}>
          <Li>Horizons treats the lunar horizon as flat. Real terrain (crater rims, mountains) is not modeled.</Li>
          <Li>At 85°S, Sun and Earth sit within ~2° of the horizon. Terrain genuinely decides visibility. Our polar numbers are <strong>upper bounds</strong>.</Li>
          <Li>CLPS target sites may have shifted since data was last verified.</Li>
          <Li>IM-1 and IM-2 positions are post-landing (both tipped over), not pre-launch targets.</Li>
        </ul>

        <button 
          onClick={onClose}
          style={{
            display: 'block',
            width: '100%',
            padding: 16,
            background: 'var(--nebula-purple)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            color: 'white',
            fontFamily: 'var(--font-heading)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'background 150ms ease',
            marginTop: 16
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#6d28d9'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--nebula-purple)'}
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function Li({ children }) {
  return (
    <li style={{
      padding: '8px 0',
      fontSize: '0.85rem',
      color: 'var(--text-secondary)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8
    }}>
      <span style={{ flexShrink: 0, fontSize: '0.8rem' }}>⚠</span>
      <div>{children}</div>
    </li>
  );
}
