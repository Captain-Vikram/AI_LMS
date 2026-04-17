import React from 'react';

const FlashlightEffect = ({ mousePosition, spotlightSize }) => {
  return (
    <div 
      className="fixed inset-0 pointer-events-none"
      style={{
        background: `radial-gradient(
          circle ${spotlightSize}px at ${mousePosition.x}px ${mousePosition.y}px,
          transparent 0%,
          rgba(40, 40, 50, 0.40) 70%,
          rgba(35, 35, 45, 0.55) 90%,
          rgba(30, 30, 40, 0.65) 100%
        )`,
        mixBlendMode: "multiply",
        zIndex: 20
      }}
    ></div>
  );
};

export default FlashlightEffect;
