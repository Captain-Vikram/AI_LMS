import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import IconsCarousel from './IconsCarousel';
import { useBackground } from '../context/BackgroundContext';
import { features, featureStats } from './features/featuresData';
import FloatingDot, { dots } from './features/FloatingDots';
import FeaturesIntro from './features/FeaturesIntro';
import FeaturesDisplay from './features/FeaturesDisplay';

const Features = () => {
  const containerRef = useRef(null);
  const [active, setActive] = useState(0);
  const [phase, setPhase] = useState('intro');
  const { backgroundColor } = useBackground();

  const INTRO_VH = 80;
  const PER_FEAT_VH = 90;
  const BUFFER_VH = 60;
  const TOTAL_VH = INTRO_VH + features.length * PER_FEAT_VH + BUFFER_VH;

  const INTRO_END = INTRO_VH / TOTAL_VH;
  const FEAT_END = (INTRO_VH + features.length * PER_FEAT_VH) / TOTAL_VH;

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const introY = useTransform(scrollYProgress, [0, INTRO_END], ['0%', '-35%']);
  const introOp = useTransform(scrollYProgress, [0, INTRO_END * 0.75], [1, 0]);
  const introScale = useTransform(scrollYProgress, [0, INTRO_END], [1, 0.9]);
  const gridY = useTransform(scrollYProgress, [0, 1], ['0%', '-20%']);

  useEffect(() => {
    const unsub = scrollYProgress.on('change', (v) => {
      if (v < INTRO_END * 0.65) {
        setPhase('intro');
        setActive(0);
      } else {
        setPhase('features');
        const fp = Math.max(0, (v - INTRO_END) / (FEAT_END - INTRO_END));
        const idx = Math.min(features.length - 1, Math.floor(fp * features.length));
        setActive(idx);
      }
    });

    return unsub;
  }, [scrollYProgress, INTRO_END, FEAT_END]);

  const f = features[active];
  const stats = featureStats[active];
  const Icon = f.Icon;

  return (
    <div id="features" ref={containerRef} style={{ height: `${TOTAL_VH}vh`, position: 'relative' }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'hidden',
          background: '#070b17',
        }}
      >
        <motion.div style={{ position: 'absolute', inset: 0, backgroundColor, pointerEvents: 'none' }}>
          <IconsCarousel />
        </motion.div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(circle_at_16%_22%,rgba(34,211,238,0.12),transparent_36%),radial-gradient(circle_at_82%_64%,rgba(79,140,255,0.18),transparent_44%),linear-gradient(120deg,rgba(7,11,23,0.18),rgba(7,11,23,0.72))',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'radial-gradient(circle_at_50%_50%,transparent_52%,rgba(4,8,18,0.62)_100%)',
          }}
        />

        <motion.div
          style={{
            position: 'absolute',
            inset: '-15%',
            y: gridY,
            pointerEvents: 'none',
            backgroundImage:
              'linear-gradient(rgba(34,211,238,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,0.035) 1px,transparent 1px)',
            backgroundSize: '72px 72px',
          }}
        />

        <motion.div
          animate={{ opacity: [0.35, 0.55, 0.35], scale: [1, 1.07, 1] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            width: '65vw',
            height: '65vw',
            borderRadius: '50%',
            background: 'radial-gradient(circle,rgba(34,211,238,0.07) 0%,transparent 70%)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            pointerEvents: 'none',
          }}
        />

        {dots.map((dot) => (
          <FloatingDot key={dot.id} {...dot} />
        ))}

        <FeaturesIntro introY={introY} introOp={introOp} introScale={introScale} />

        <FeaturesDisplay
          phase={phase}
          active={active}
          f={f}
          stats={stats}
          Icon={Icon}
          features={features}
        />
      </div>
    </div>
  );
};

export default Features;
