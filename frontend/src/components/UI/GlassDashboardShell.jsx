import React from 'react';
import IconsCarousel from '../IconsCarousel';

const GlassDashboardShell = ({
  children,
  contentClassName = '',
  panelClassName = '',
  withPanel = true,
}) => {
  return (
    <section className="relative min-h-screen px-4 py-12 pt-28">
      <div className="absolute inset-0 overflow-hidden">
        <IconsCarousel
          backgroundColor="rgba(17, 24, 39, 0.8)"
          iconColor="gray-500/30"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90" />
      </div>

      <div className={`container mx-auto relative z-10 ${contentClassName}`}>
        {withPanel ? (
          <div
            className={`bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-6 md:p-8 shadow-xl ${panelClassName}`}
          >
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
};

export default GlassDashboardShell;