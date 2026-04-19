import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { IconsArray } from '../assets/IconsArray';
import { shuffleArray } from '../utils/shuffleArray';

const IconsCarousel = ({ backgroundColor = "transparent" }) => {
  const icons = IconsArray;
  const rows = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  
  const rowIcons = useMemo(() => {
    return rows.map(() => shuffleArray([...icons]));
  }, []);
  
  return (
    <div className={`absolute inset-0`} style={{ backgroundColor }}>
      {rows.map((row, rowIndex) => {
        const duration = 300 + (rowIndex * 10);
        const isEven = rowIndex % 2 === 0;
        
        return (
          <div 
            key={`row-${row}`}
            className={`whitespace-nowrap overflow-hidden ${row > 0 ? 'mt-16' : 'mt-10'}`}
          >
            <div className="relative">
              <motion.div
                className="inline-flex space-x-16"
                initial={{ x: isEven ? '-50%' : '0%' }}
                animate={{ 
                  x: isEven ? ['0%', '-50%'] : ['-50%', '0%']
                }}
                transition={{
                  x: {
                    repeat: Infinity,
                    repeatType: 'loop',
                    duration: duration,
                    ease: "linear"
                  }
                }}
              >
                {[...Array(20)].map((_, i) => (
                  <React.Fragment key={`set-${i}`}>
                    {rowIcons[rowIndex].map((icon, index) => (
                      <div
                        key={`${i}-${index}`}
                        className="text-[var(--color-text-muted)]"
                        style={{ opacity: 0.22 }}
                      >
                        {icon}
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              </motion.div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default IconsCarousel;