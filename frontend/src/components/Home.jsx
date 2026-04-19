import React, { useState } from "react";
import { motion } from "framer-motion";
import IconsCarousel from "./IconsCarousel";
import FlashlightControl from "./FlashLightControl";
import HeroContent from "./HeroContent";
import useMousePosition from "../hooks/useMousePosition";
import useClientSide from "../hooks/useClientSide";
import { useBackground } from '../context/BackgroundContext';

const Home = () => {
  const mousePosition = useMousePosition();
  const isClient = useClientSide();
  const [isFlashlightOn, setIsFlashlightOn] = useState(true);
  const spotlightSize = 360;
  const { backgroundColor } = useBackground();
  
  const toggleFlashlight = () => {
    setIsFlashlightOn((prev) => !prev);
  };

  return (
    <div className="relative overflow-hidden min-h-screen">
      {/* Background with icons - now using shared background color */}
      <motion.div style={{ position: 'absolute', inset: 0, backgroundColor }}>
        <IconsCarousel />
      </motion.div>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_22%,rgba(34,211,238,0.12),transparent_36%),radial-gradient(circle_at_82%_64%,rgba(79,140,255,0.18),transparent_44%),linear-gradient(120deg,rgba(7,11,23,0.18),rgba(7,11,23,0.72))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_52%,rgba(4,8,18,0.62)_100%)]" />

      {/* Flashlight control and effect */}
      <FlashlightControl
        isClient={isClient}
        isFlashlightOn={isFlashlightOn}
        toggleFlashlight={toggleFlashlight}
        mousePosition={mousePosition}
        spotlightSize={spotlightSize}
      />

      {/* Main content */}
      <HeroContent />
    </div>
  );
};

export default Home;