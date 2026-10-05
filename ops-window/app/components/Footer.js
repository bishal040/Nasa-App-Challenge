export default function Footer() {
  return (
    <footer style={{
      padding: '24px 32px',
      borderTop: '1px solid var(--border-subtle)',
      background: 'rgba(5, 8, 22, 0.6)',
      textAlign: 'center'
    }}>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '16px 32px',
        marginBottom: 16
      }}>
        <Limitation text="Flat horizon model — no terrain" />
        <Limitation text="Polar numbers are upper bounds" />
        <Limitation text="CLPS sites may have shifted" />
        <Limitation text="IM-1/IM-2 positions are post-tip" />
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
        Ops Window · NASA Space Apps 2026 · Data from{' '}
        <a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noopener noreferrer">
          JPL Horizons
        </a>
      </div>
    </footer>
  );
}

function Limitation({ text }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      fontSize: '0.72rem',
      color: 'var(--text-dim)',
      fontFamily: 'var(--font-mono)'
    }}>
      <span style={{ color: 'var(--amber-warn)', fontSize: '0.85rem' }}>⚠</span>
      {text}
    </div>
  );
}
