import React from 'react';
import { motion } from 'framer-motion';
import { IoStarOutline, IoFlashOutline } from 'react-icons/io5';

const XPProgressBar = ({ currentXP, levelThreshold, level }) => {
  const percentage = Math.min((currentXP / levelThreshold) * 100, 100);
  const xpToNextLevel = levelThreshold - currentXP;
  
  return (
    <div className="w-full bg-gray-800/70 rounded-xl p-4 border border-gray-700/50">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <div className="bg-yellow-500/20 p-1.5 rounded-full mr-2">
            <IoStarOutline className="text-yellow-400 text-lg" />
          </div>
          <span className="text-white font-medium">Level {level}</span>
        </div>
        <span className="text-sm text-blue-400 font-medium">{currentXP} / {levelThreshold} XP</span>
      </div>
      
      <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden">
        <motion.div 
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-purple-500"
          style={{ width: `${percentage}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
      
      <div className="mt-2 flex items-center text-xs text-gray-400">
        <IoFlashOutline className="text-blue-400 mr-1" />
        <span>{xpToNextLevel} XP to next level</span>
      </div>
    </div>
  );
};

export default XPProgressBar;