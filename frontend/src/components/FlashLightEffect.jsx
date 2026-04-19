import React from 'react';

const FlashlightEffect = ({ mousePosition, spotlightSize }) => {
  return (
    <div 
      className="fixed inset-0 pointer-events-none"
      style={{
        background: `radial-gradient(
          circle ${spotlightSize}px at ${mousePosition.x}px ${mousePosition.y}px,
          rgba(255,255,255,0.18) 0%,
          rgba(34,211,238,0.06) 28%,
          rgba(15,25,40,0.28) 60%,
          rgba(8,12,20,0.6) 100%
        )`,
        mixBlendMode: "screen",
        zIndex: 60,
        transition: "background 180ms ease"
      }}
    ></div>
  );
};

export default FlashlightEffect;
