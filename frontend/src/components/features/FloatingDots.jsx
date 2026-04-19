import { motion } from 'framer-motion';

export const dots = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  x: (i * 19 + 7) % 92,
  y: (i * 31 + 5) % 85,
  size: `${2 + (i % 4) * 1.5}px`,
  delay: i * 0.22,
  opacity: 0.2 + (i % 5) * 0.12,
}));

const FloatingDot = ({ x, y, size, delay, opacity }) => (
  <motion.div
    style={{
      position: 'absolute',
      left: `${x}%`,
      top: `${y}%`,
      width: size,
      height: size,
      borderRadius: '50%',
      background: '#22d3ee',
      filter: 'blur(0.5px)',
      pointerEvents: 'none',
    }}
    animate={{ y: [0, -28, 0], opacity: [opacity * 0.4, opacity, opacity * 0.4] }}
    transition={{ duration: 3.5 + delay, repeat: Infinity, delay, ease: 'easeInOut' }}
  />
);

export default FloatingDot;
