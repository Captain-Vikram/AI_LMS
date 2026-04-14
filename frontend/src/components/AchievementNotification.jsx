import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

const AchievementNotification = ({ achievement, onClose }) => {
  // Use a ref instead of state to track if confetti has been shown
  const confettiShownRef = useRef(false);
  
  useEffect(() => {
    // Only trigger confetti if it hasn't been shown yet for this achievement
    if (!confettiShownRef.current) {
      confetti({
        particleCount: 100,
        spread: 200,
        origin: { y: -0.1 }
      });
      
      // Mark confetti as shown
      confettiShownRef.current = true;
    }
    
    // Auto-dismiss after 5 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [onClose]); // Remove showConfetti from dependencies
  
  return (
    <AnimatePresence>
      <motion.div 
        className="absolute top-4 right-4 z-50 max-w-sm w-full"
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <div className="bg-gray-800/90 backdrop-blur-sm border border-purple-500/30 rounded-xl p-4 shadow-2xl overflow-hidden">
          <div className="flex items-start">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-${achievement.color}-600/30 border border-${achievement.color}-500/30 mr-3 flex-shrink-0`}>
              <span className="text-2xl">{achievement.icon}</span>
            </div>
            
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-white font-bold mb-0.5">Achievement Unlocked!</h3>
                  <p className="text-purple-300 font-medium">{achievement.name}</p>
                </div>
                <button 
                  onClick={onClose}
                  className="text-gray-400 hover:text-white p-1"
                >
                  &times;
                </button>
              </div>
              
              <p className="text-gray-300 text-sm mt-1">{achievement.shortDescription}</p>
              
              <div className="mt-2 flex justify-between items-center">
                <span className="text-blue-400 font-medium text-sm">+{achievement.xpAwarded} XP</span>
                <button className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
                  View Details
                </button>
              </div>
            </div>
          </div>
          
          {/* Animated glow effect */}
          <motion.div 
            className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/20 to-purple-500/0"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AchievementNotification;