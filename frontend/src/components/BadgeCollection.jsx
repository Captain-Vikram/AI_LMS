import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoCloseOutline, IoLockClosedOutline, IoRibbonOutline } from 'react-icons/io5';
import * as MaterialIcons from 'react-icons/md';

const BadgeCollection = ({ badges, onClose }) => {
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const categories = ['all', ...new Set(badges.map(badge => badge.category))];
  
  // Function to get badge background color style based on color hex code
  const getBadgeStyle = (color, isUnlocked) => {
    if (!isUnlocked) return {};
    
    // Handle hex colors from API with alpha
    if (color?.startsWith('#')) {
      return { 
        background: `${color}33`, // 20% opacity
        borderColor: `${color}4D`  // 30% opacity
      };
    }
    
    // Map color strings to actual style objects
    const colorMap = {
      'purple': { background: 'rgba(147, 51, 234, 0.2)', borderColor: 'rgba(147, 51, 234, 0.3)' },
      'blue': { background: 'rgba(59, 130, 246, 0.2)', borderColor: 'rgba(59, 130, 246, 0.3)' },
      'green': { background: 'rgba(34, 197, 94, 0.2)', borderColor: 'rgba(34, 197, 94, 0.3)' },
      'red': { background: 'rgba(239, 68, 68, 0.2)', borderColor: 'rgba(239, 68, 68, 0.3)' },
      'yellow': { background: 'rgba(234, 179, 8, 0.2)', borderColor: 'rgba(234, 179, 8, 0.3)' },
      'orange': { background: 'rgba(249, 115, 22, 0.2)', borderColor: 'rgba(249, 115, 22, 0.3)' },
      'pink': { background: 'rgba(236, 72, 153, 0.2)', borderColor: 'rgba(236, 72, 153, 0.3)' },
    };
    
    return colorMap[color] || { background: 'rgba(147, 51, 234, 0.2)', borderColor: 'rgba(147, 51, 234, 0.3)' };
  };
  
  // Function to render icon based on icon string
  const renderIcon = (iconName) => {
    const IconComponent = MaterialIcons[iconName];
    return IconComponent ? <IconComponent className="text-white text-2xl" /> : <IoRibbonOutline className="text-white text-2xl" />;
  };

  // Filter badges by selected category
  const filteredBadges = selectedCategory === 'all' 
    ? badges 
    : badges.filter(badge => badge.category === selectedCategory);

  return (
    <div className='flex items-center justify-center mt-4'>
      <motion.div 
        className="relative bg-gray-800/90 border border-gray-700 rounded-xl w-full max-w-4xl mx-4 flex flex-col p-4"
        style={{ maxHeight: 'calc(100vh - 4rem)' }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
      >
        <div className="sticky top-0 z-10 bg-gray-800/90 backdrop-blur-sm p-5 border-b border-gray-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="bg-purple-600/20 p-2 rounded-full mr-3">
                <IoRibbonOutline className="text-purple-400 text-xl" />
              </div>
              <h2 className="text-2xl font-bold text-white">Achievement Badges</h2>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-full transition-colors"
            >
              <IoCloseOutline className="text-gray-400 hover:text-white text-2xl" />
            </button>
          </div>
        </div>
        
        <div className="p-5 overflow-y-auto">
          {/* Badge Category Tabs */}
          <div className="flex space-x-2 mb-6 overflow-x-auto pb-2 sticky top-0 z-10">
            {categories.map(category => (
              <button
                key={category}
                className={`px-4 py-2 ${
                  selectedCategory === category 
                    ? "bg-purple-700 text-white" 
                    : "bg-gray-700/50 text-gray-300 hover:bg-gray-700 hover:text-white"
                } rounded-lg whitespace-nowrap transition-colors`}
                onClick={() => setSelectedCategory(category)}
              >
                {category === 'all' ? 'All Badges' : category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
          
          {/* Badge Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filteredBadges.map((badge) => (
              <motion.div
                key={badge.id}
                className={`relative ${
                  badge.unlocked 
                    ? "cursor-pointer" 
                    : "opacity-60 cursor-not-allowed"
                } bg-gray-700/40 border ${
                  badge.unlocked 
                    ? "border-gray-600/50" 
                    : "border-gray-700/50"
                } rounded-xl p-4 flex flex-col items-center`}
                style={{ minHeight: "12rem" }}
                whileHover={badge.unlocked ? { scale: 1.05 } : {}}
                onClick={() => badge.unlocked && setSelectedBadge(badge)}
              >
                <div 
                  className="w-16 h-16 mb-3 rounded-full flex items-center justify-center"
                  style={badge.unlocked ? getBadgeStyle(badge.color, true) : { background: 'rgba(31, 41, 55, 0.7)' }}
                >
                  {badge.unlocked ? (
                    renderIcon(badge.icon)
                  ) : (
                    <IoLockClosedOutline className="text-gray-500 text-xl" />
                  )}
                </div>
                <h3 className="text-sm font-medium text-center text-white mb-1">
                  {badge.name}
                </h3>
                <p className="text-xs text-gray-400 text-center">
                  {badge.unlocked ? badge.short_description : "Locked"}
                </p>
                {badge.unlocked && badge.earned_date && (
                  <span className="mt-2 text-xs text-gray-500">
                    Earned {new Date(badge.earned_date).toLocaleDateString()}
                  </span>
                )}
                {!badge.unlocked && badge.progress && (
                  <div className="mt-auto w-full pt-3">
                    <div className="text-xs text-gray-500 flex justify-between mb-1">
                      <span>Progress</span>
                      <span>{badge.progress.current}/{badge.progress.required}</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5">
                      <div 
                        className="bg-gray-600 h-1.5 rounded-full" 
                        style={{ width: `${(badge.progress.current / badge.progress.required) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
          
          {filteredBadges.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-gray-700/40 rounded-full p-4 mb-4">
                <IoRibbonOutline className="text-gray-400 text-3xl" />
              </div>
              <h3 className="text-gray-300 text-lg mb-2">No badges found</h3>
              <p className="text-gray-500 max-w-xs">
                There are no badges in this category yet. Complete more activities to earn badges.
              </p>
            </div>
          )}
        </div>
        
        {/* Badge Detail Modal */}
        <AnimatePresence>
          {selectedBadge && (
            <motion.div 
              className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/80 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBadge(null)}
            >
              <motion.div 
                className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center mr-3"
                      style={getBadgeStyle(selectedBadge.color, true)}
                    >
                      {renderIcon(selectedBadge.icon)}
                    </div>
                    <h3 className="text-xl font-bold text-white">{selectedBadge.name}</h3>
                  </div>
                  <button 
                    onClick={() => setSelectedBadge(null)}
                    className="p-1 hover:bg-gray-700 rounded-full"
                  >
                    <IoCloseOutline className="text-gray-400 hover:text-white text-xl" />
                  </button>
                </div>
                
                <p className="text-gray-300 mb-4">{selectedBadge.description}</p>
                
                <div className="text-sm text-gray-400 mb-2">
                  <span>Earned on {new Date(selectedBadge.earned_date).toLocaleDateString()}</span>
                </div>
                
                <div className="bg-gray-700/50 rounded-lg p-3 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">XP Awarded</span>
                    <span className="text-blue-400 font-medium">+{selectedBadge.xp_awarded} XP</span>
                  </div>
                </div>
                
                {selectedBadge.reward && (
                  <div className="bg-purple-900/30 border border-purple-700/30 rounded-lg p-3">
                    <h4 className="text-purple-300 font-medium mb-1">Special Reward</h4>
                    <p className="text-gray-300">{selectedBadge.reward}</p>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default BadgeCollection;