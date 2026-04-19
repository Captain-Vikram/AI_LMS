import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

const TiltCard = ({ children }) => {
  const ref = useRef(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 250, damping: 28 });
  const sry = useSpring(ry, { stiffness: 250, damping: 28 });

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    rx.set(-dy * 10);
    ry.set(dx * 10);
  };

  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX: srx, rotateY: sry, transformStyle: 'preserve-3d', perspective: 900 }}
    >
      {children}
    </motion.div>
  );
};

export default TiltCard;
