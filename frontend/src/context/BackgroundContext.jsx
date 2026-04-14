import React, { createContext, useContext } from 'react';
import { useScroll, useTransform } from 'framer-motion';

const BackgroundContext = createContext();

export const BackgroundProvider = ({ children }) => {
  const { scrollYProgress } = useScroll();
  
  // Create an extremely gradual transition with many fine interpolation points
  const backgroundColor = useTransform(
    scrollYProgress,
    [
      0, 0.02, 0.04, 0.06, 0.08, 0.10, 
      0.15, 0.20, 0.25, 0.30, 0.35, 
      0.40, 0.45, 0.50, 0.55
    ], 
    [
      "transparent", 
      "rgba(17, 24, 39, 0.02)",
      "rgba(17, 24, 39, 0.05)",
      "rgba(17, 24, 39, 0.08)",
      "rgba(17, 24, 39, 0.12)",
      "rgba(17, 24, 39, 0.16)",
      "rgba(17, 24, 39, 0.24)",
      "rgba(17, 24, 39, 0.32)",
      "rgba(17, 24, 39, 0.40)",
      "rgba(17, 24, 39, 0.50)",
      "rgba(17, 24, 39, 0.60)",
      "rgba(17, 24, 39, 0.72)",
      "rgba(17, 24, 39, 0.84)",
      "rgba(17, 24, 39, 0.92)",
      "#111827"
    ]
  );

  return (
    <BackgroundContext.Provider value={{ backgroundColor }}>
      {children}
    </BackgroundContext.Provider>
  );
};

export const useBackground = () => useContext(BackgroundContext);