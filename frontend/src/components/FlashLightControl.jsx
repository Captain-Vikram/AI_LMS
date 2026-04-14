import React from "react";
import FlashlightEffect from "./FlashLightEffect";
import LightbulbOffIcon from "../assets/icons/LightbulbOnIcon.svg";
import LightbulbOnIcon from "../assets/icons/LightbulbOffIcon.svg";

const FlashlightControl = ({ 
  isClient, 
  isFlashlightOn, 
  toggleFlashlight, 
  mousePosition, 
  spotlightSize 
}) => {
  return (
    <>
      {isClient && isFlashlightOn && (
        <FlashlightEffect
          mousePosition={mousePosition}
          spotlightSize={spotlightSize}
        />
      )}

      <button
        onClick={toggleFlashlight}
        className="fixed bottom-4 right-4 z-40 bg-white text-white p-4 rounded-full shadow-lg transition-all flex items-center justify-center"
        aria-label={
          isFlashlightOn
            ? "Turn off flashlight effect"
            : "Turn on flashlight effect"
        }
      >
        <img
          src={isFlashlightOn ? LightbulbOnIcon : LightbulbOffIcon}
          alt={isFlashlightOn ? "Light On" : "Light Off"}
          className="w-6 h-6"
        />
      </button>
    </>
  );
};

export default FlashlightControl;