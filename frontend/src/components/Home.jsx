import React, { useState } from "react";
import { motion } from "framer-motion";
import IconsCarousel from "./IconsCarousel";
import FlashlightControl from "./FlashlightControl";
import HeroContent from "./HeroContent";
import useMousePosition from "../hooks/useMousePosition";
import useClientSide from "../hooks/useClientSide";
import { useBackground } from '../context/BackgroundContext';

const Home = () => {
  const mousePosition = useMousePosition();
  const isClient = useClientSide();
  const [isFlashlightOn, setIsFlashlightOn] = useState(true);
  const spotlightSize = 300;
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