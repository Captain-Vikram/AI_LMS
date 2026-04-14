import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoArrowForward, IoLockClosed, IoMail } from 'react-icons/io5';
import PasswordStrength from './PasswordStrength';
import SocialLogin from './SocialLogin';

const FormStep1 = ({ 
  registerStep1, 
  handleSubmitStep1, 
  watchStep1, 
  errorsStep1, 
  onSubmitStep1,
  pageVariants
}) => {
  const [passwordStrength, setPasswordStrength] = useState(0);
  const password = watchStep1('password');
  
  // Calculate password strength when password changes
  useEffect(() => {
    if (password) {
      let strength = 0;
      if (password.length >= 8) strength += 1;
      if (/[A-Z]/.test(password)) strength += 1;
      if (/[0-9]/.test(password)) strength += 1;
      if (/[^A-Za-z0-9]/.test(password)) strength += 1;
      setPasswordStrength(strength);
    } else {
      setPasswordStrength(0);
    }
  }, [password]);

  return (
    <motion.form
      key="step1"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      onSubmit={handleSubmitStep1(onSubmitStep1)}
    >
      <div className="space-y-3">
        {/* Email */}
        <div>
          <label className="block text-gray-300 mb-1 text-xs" htmlFor="email">Email</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-gray-400">
              <IoMail className="text-sm" />
            </span>
            <input
              id="email"
              className={`w-full bg-gray-700/50 border ${errorsStep1.email ? 'border-red-500' : 'border-gray-600'} rounded-lg py-2 px-7 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="your.email@example.com"
              {...registerStep1('email', { 
                required: 'Email is required',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Please enter a valid email'
                }
              })}
            />
          </div>
          {errorsStep1.email && <p className="text-red-500 text-xs mt-1">{errorsStep1.email.message}</p>}
        </div>

        {/* Password */}
        <div>
          <label className="block text-gray-300 mb-1 text-xs" htmlFor="password">Password</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-gray-400">
              <IoLockClosed className="text-sm" />
            </span>
            <input
              type="password"
              id="password"
              className={`w-full bg-gray-700/50 border ${errorsStep1.password ? 'border-red-500' : 'border-gray-600'} rounded-lg py-2 px-7 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="••••••••"
              {...registerStep1('password', { 
                required: 'Password is required',
                minLength: {
                  value: 8,
                  message: 'Password must be at least 8 characters'
                }
              })}
            />
          </div>
          {errorsStep1.password && <p className="text-red-500 text-xs mt-1">{errorsStep1.password.message}</p>}
          
          {/* Password strength indicator */}
          {password && <PasswordStrength strength={passwordStrength} />}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-gray-300 mb-1 text-xs" htmlFor="confirmPassword">Confirm Password</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-gray-400">
              <IoLockClosed className="text-sm" />
            </span>
            <input
              type="password"
              id="confirmPassword"
              className={`w-full bg-gray-700/50 border ${errorsStep1.confirmPassword ? 'border-red-500' : 'border-gray-600'} rounded-lg py-2 px-7 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="••••••••"
              {...registerStep1('confirmPassword', { 
                required: 'Please confirm your password',
                validate: value => value === watchStep1('password') || 'Passwords do not match'
              })}
            />
          </div>
          {errorsStep1.confirmPassword && <p className="text-red-500 text-xs mt-1">{errorsStep1.confirmPassword.message}</p>}
        </div>
      </div>

      {/* Next button */}
      <motion.button
        type="submit"
        className="w-full mt-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 cursor-pointer"
        whileTap={{ scale: 0.98 }}
      >
        Next <IoArrowForward className="text-sm" />
      </motion.button>

      {/* Social login */}
      <SocialLogin />
    </motion.form>
  );
};

export default FormStep1;