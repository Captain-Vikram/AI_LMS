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
        className="fixed bottom-6 right-6 z-50 p-3 md:p-4 rounded-full border-none bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-2))] shadow-[0_12px_32px_rgba(34,211,238,0.28),0_6px_18px_rgba(79,140,255,0.12)] transition-all transform-gpu hover:scale-105 flex items-center justify-center"
        aria-label={
          isFlashlightOn
            ? "Turn off flashlight effect"
            : "Turn on flashlight effect"
        }
        title={isFlashlightOn ? "Turn off spotlight" : "Turn on spotlight"}
      >
        <img
          src={isFlashlightOn ? LightbulbOnIcon : LightbulbOffIcon}
          alt={isFlashlightOn ? "Light On" : "Light Off"}
          className="w-5 h-5 md:w-6 md:h-6"
          style={{ filter: 'drop-shadow(0 6px 16px rgba(34,211,238,0.24))' }}
        />
      </button>
    </>
  );
};

export default FlashlightControl;
