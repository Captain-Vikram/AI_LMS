import { motion } from 'framer-motion';

const StatBar = ({ label, pct, accent, delay }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <span
        style={{
          fontFamily: "'Courier New',monospace",
          fontSize: 9,
          letterSpacing: 2,
          color: 'rgba(255,255,255,0.45)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: accent }}>{pct}%</span>
    </div>
    <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ delay, duration: 1, ease: [0.16, 1, 0.3, 1] }}
        style={{ height: '100%', background: accent, borderRadius: 2, boxShadow: `0 0 8px ${accent}` }}
      />
    </div>
  </div>
);

export default StatBar;
