import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const TransitionOverlay = () => {
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0.4, 0.6], [0, 0.9]);
  
  return (
    <motion.div 
      className="fixed inset-0 bg-gradient-to-b from-transparent to-gray-900 pointer-events-none z-[5]"
      style={{ opacity }}
    />
  );
};

export default TransitionOverlay;