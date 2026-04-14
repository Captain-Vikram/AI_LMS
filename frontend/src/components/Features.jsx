import React, { useRef, useState, useEffect } from 'react'; // Add useEffect import
import IconsCarousel from "./IconsCarousel";
import { motion, AnimatePresence } from "framer-motion";
import { useBackground } from '../context/BackgroundContext';

const Features = () => {
  const featuresRef = useRef(null);
  const { backgroundColor } = useBackground();
  const [currentFeature, setCurrentFeature] = useState(0);
  const [isPaused, setIsPaused] = useState(false); // Add state to handle pause/play
  
  // Animation variants
  const cardVariants = {
    enter: (direction) => {
      return {
        x: direction > 0 ? 300 : -300,
        opacity: 0
      };
    },
    center: {
      x: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30
      }
    },
    exit: (direction) => {
      return {
        x: direction < 0 ? 300 : -300,
        opacity: 0,
        transition: {
          type: "spring",
          stiffness: 300,
          damping: 30
        }
      };
    }
  };
  
  // Modern icons (replace emojis with animated elements)
  const icons = [
    <motion.div 
      className="w-16 h-16 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-400 flex items-center justify-center"
      whileHover={{ scale: 1.1, rotate: 5 }}
      whileTap={{ scale: 0.95 }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </motion.div>,
    <motion.div 
      className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center"
      whileHover={{ scale: 1.1, rotate: -5 }}
      whileTap={{ scale: 0.95 }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    </motion.div>,
    <motion.div 
      className="w-16 h-16 rounded-lg bg-gradient-to-br from-cyan-600 to-cyan-400 flex items-center justify-center"
      whileHover={{ scale: 1.1, rotate: 5 }}
      whileTap={{ scale: 0.95 }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    </motion.div>,
    <motion.div 
      className="w-16 h-16 rounded-lg bg-gradient-to-br from-teal-600 to-teal-400 flex items-center justify-center"
      whileHover={{ scale: 1.1, rotate: -5 }}
      whileTap={{ scale: 0.95 }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
      </svg>
    </motion.div>,
    <motion.div 
      className="w-16 h-16 rounded-lg bg-gradient-to-br from-green-600 to-green-400 flex items-center justify-center"
      whileHover={{ scale: 1.1, rotate: 5 }}
      whileTap={{ scale: 0.95 }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    </motion.div>,
    <motion.div 
      className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-600 to-purple-400 flex items-center justify-center"
      whileHover={{ scale: 1.1, rotate: -5 }}
      whileTap={{ scale: 0.95 }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </motion.div>
  ];
  
  // Feature content
  const features = [
    {
      title: "Skill Gap Analysis",
      description: "Identify your current skill levels through comprehensive assessments and discover gaps that align with your career aspirations."
    },
    {
      title: "Personalized Learning Journey",
      description: "Get tailored learning recommendations and structured pathways based on your learning style and professional goals."
    },
    {
      title: "Interactive Progress Dashboard",
      description: "Track your growth with visual analytics, milestone achievements, and skill mastery badges as you advance."
    },
    {
      title: "Achievement System",
      description: "Stay motivated with gamification elements including points, badges, and leaderboards that recognize your learning accomplishments."
    },
    {
      title: "Learning Community",
      description: "Connect with peers, find mentors, and participate in collaborative learning through discussion forums and study groups."
    },
    {
      title: "Adaptive Learning Cycles",
      description: "Benefit from continuous reassessment and path optimization as you progress, ensuring your learning stays relevant to your evolving career goals."
    }
  ];
  
  // Track slide direction
  const [[page, direction], setPage] = useState([0, 0]);

  const paginate = (newDirection) => {
    const newIndex = (currentFeature + newDirection + features.length) % features.length;
    setCurrentFeature(newIndex);
    setPage([newIndex, newDirection]);
  };
  
  // Add autoplay functionality
  useEffect(() => {
    if (!isPaused) {
      const autoplayTimer = setInterval(() => {
        paginate(1);
      }, 4000); // Change slide every 4 seconds
      
      return () => clearInterval(autoplayTimer);
    }
  }, [currentFeature, isPaused]); // Re-create interval when slide changes or pause state changes
  
  return (
    <motion.section 
      ref={featuresRef}
      id="features"
      className="relative min-h-screen overflow-hidden"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      viewport={{ once: true }}
    >
      {/* Background with dynamically changing color */}
      <motion.div style={{ position: 'absolute', inset: 0, backgroundColor }}>
        <IconsCarousel />
      </motion.div>
      
      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-24 mt-30">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Left Column - Fixed Content */}
          <div 
            className="pr-0 lg:pr-12 bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 p-[46px] rounded-2xl"
            onMouseEnter={() => setIsPaused(true)} // Pause on hover
            onMouseLeave={() => setIsPaused(false)} // Resume on leave
          >
            <motion.h2 
              className="text-4xl md:text-5xl font-bold text-white mb-6 "
              initial={{ opacity: 0, y: -20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              Key Features
            </motion.h2>
            
            <motion.p 
              className="text-gray-300 text-lg mb-8"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Our learning path platform empowers you to take control of your skill development journey. 
              From personalized assessments to interactive progress tracking, we provide everything you 
              need to reach your professional goals.
            </motion.p>
            
            {/* Feature Navigation */}
            <motion.div 
              className="flex flex-wrap gap-3 mb-8"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              {features.map((feature, index) => (
                <motion.button
                  key={`nav-${index}`}
                  className={`h-2 rounded-full transition-all ${
                    currentFeature === index ? "w-8 bg-white" : "w-2 bg-gray-600"
                  }`}
                  onClick={() => {
                    const dir = index > currentFeature ? 1 : -1;
                    setCurrentFeature(index);
                    setPage([index, dir]);
                    setIsPaused(true); // Pause autoplay when user manually selects
                    setTimeout(() => setIsPaused(false), 5000); // Resume after 5 seconds
                  }}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                />
              ))}
            </motion.div>
            
            {/* Navigation Buttons */}
            <motion.div 
              className="flex space-x-4"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <motion.button
                className="p-3 rounded-full bg-gray-800/80 border border-gray-700/50 hover:bg-gray-700/80 transition-colors"
                onClick={() => {
                  paginate(-1);
                  setIsPaused(true); // Pause autoplay when user manually navigates
                  setTimeout(() => setIsPaused(false), 5000); // Resume after 5 seconds
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </motion.button>
              
              <motion.button
                className="p-3 rounded-full bg-gray-800/80 border border-gray-700/50 hover:bg-gray-700/80 transition-colors"
                onClick={() => {
                  paginate(1);
                  setIsPaused(true); // Pause autoplay when user manually navigates
                  setTimeout(() => setIsPaused(false), 5000); // Resume after 5 seconds
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </motion.button>
            </motion.div>
          </div>
          
          {/* Right Column - Feature Slideshow */}
          <div 
            className="h-[400px] relative flex items-center justify-center overflow-hidden"
            onMouseEnter={() => setIsPaused(true)} // Pause on hover
            onMouseLeave={() => setIsPaused(false)} // Resume on leave
          >
            <div className="w-full h-full relative">
              <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div
                  key={page}
                  className="absolute inset-0 flex items-center justify-center bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 p-8 rounded-xl"
                  custom={direction}
                  variants={cardVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  <div className="w-full max-w-lg">
                    <div className="mb-8">{icons[currentFeature]}</div>
                    <h3 className="text-3xl font-bold text-white mb-4">{features[currentFeature].title}</h3>
                    <p className="text-gray-300 text-lg leading-relaxed">{features[currentFeature].description}</p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
};

export default Features;