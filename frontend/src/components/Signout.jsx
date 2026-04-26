import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';

const Signout = () => {
  const navigate = useNavigate();
  const { signOut, isSignedIn } = useAuth();

  useEffect(() => {
    // If user is already signed out, redirect to home or login
    if (!isSignedIn) {
      navigate('/');
    }
  }, [isSignedIn, navigate]);

  const handleSignOut = async () => {
    try {
      await signOut();
      // Clear local storage that Clerk doesn't manage
      localStorage.removeItem('onboardingData');
      localStorage.removeItem('onboardingComplete');
      localStorage.removeItem('skillAssessmentComplete');
      localStorage.removeItem('skillAssessmentResults');
      localStorage.removeItem('reassessmentInfo');
      localStorage.removeItem('userRole');
      localStorage.removeItem('isLoggedIn');
      
      // Redirect to home
      navigate('/');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen flex items-center justify-center bg-gray-900 px-4"
    >
      <div className="bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-8 shadow-xl text-center max-w-md w-full">
        <h2 className="text-2xl font-bold text-white mb-6">
          Are you sure you want to sign out?
        </h2>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto py-2.5 px-6 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all duration-300 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSignOut}
            className="w-full sm:w-auto py-2.5 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-slate-950 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 font-bold shadow-[0_10px_20px_rgba(34,211,238,0.2)]"
          >
            Sign Out
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default Signout;