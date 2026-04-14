import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const Signout = () => {
  const navigate = useNavigate();

  const handleSignOut = () => {
    // Clear authentication and onboarding data
    localStorage.removeItem('token');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('onboardingData');
    localStorage.removeItem('onboardingComplete');
    localStorage.removeItem('skillAssessmentComplete');
    localStorage.removeItem('skillAssessmentResults');
    localStorage.removeItem('reassessmentInfo');
    // Redirect to the login page
    navigate('/login');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen flex items-center justify-center bg-gray-900"
    >
      <div className="bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-6 shadow-xl text-center">
        <h2 className="text-2xl font-bold text-white mb-4">
          Are you sure you want to sign out?
        </h2>
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="py-2 px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all duration-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSignOut}
            className="py-2 px-4 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
          >
            Sign Out
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default Signout;