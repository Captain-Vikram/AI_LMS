import { motion } from 'framer-motion';

const FeaturesIntro = ({ introY, introOp, introScale }) => {
  return (
    <motion.div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 15,
        pointerEvents: 'none',
        y: introY,
        opacity: introOp,
        scale: introScale,
      }}
    >
      <motion.p
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        style={{
          fontFamily: "'Courier New',monospace",
          fontSize: 10,
          letterSpacing: 7,
          color: '#22d3ee',
          marginBottom: 22,
          textTransform: 'uppercase',
        }}
      >
        Scroll to explore
      </motion.p>

      <motion.h2
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
        style={{
          fontFamily: "'Georgia',serif",
          fontSize: 'clamp(58px,9.5vw,124px)',
          fontWeight: 900,
          fontStyle: 'italic',
          color: '#fff',
          lineHeight: 0.9,
          textAlign: 'center',
          textShadow: '0 0 80px rgba(34,211,238,0.22)',
        }}
      >
        Key
        <br />
        <span style={{ WebkitTextStroke: '2px #22d3ee', WebkitTextFillColor: 'transparent' }}>Features</span>
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.42 }}
        transition={{ delay: 0.65 }}
        style={{
          fontFamily: "'Georgia',serif",
          fontSize: 'clamp(13px,1.2vw,17px)',
          color: '#fff',
          marginTop: 30,
          maxWidth: 400,
          textAlign: 'center',
          lineHeight: 1.75,
        }}
      >
        From skill diagnostics to adaptive cycles - every tool you need to accelerate your career.
      </motion.p>

      <motion.div
        animate={{ y: [0, 10, 0], opacity: [0.4, 0.9, 0.4] }}
        transition={{ duration: 1.6, repeat: Infinity }}
        style={{ marginTop: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}
      >
        <div style={{ width: 1, height: 38, background: 'linear-gradient(to bottom,#22d3ee,transparent)' }} />
        <svg width="12" height="7" viewBox="0 0 12 7" fill="none">
          <path d="M1 1L6 6L11 1" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </motion.div>
    </motion.div>
  );
};

export default FeaturesIntro;
