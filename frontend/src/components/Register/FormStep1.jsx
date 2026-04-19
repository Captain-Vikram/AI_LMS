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
          <label className="block text-[var(--color-text-muted)] mb-1 text-xs" htmlFor="email">Email</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-[var(--color-text-muted)]">
              <IoMail className="text-sm" />
            </span>
            <input
              id="email"
              className={`w-full bg-[rgba(8,14,28,0.72)] border ${errorsStep1.email ? 'border-red-500' : 'border-[var(--color-surface-border)]'} rounded-xl py-2 px-7 text-sm text-white placeholder-[rgba(226,235,255,0.38)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]`}
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
          <label className="block text-[var(--color-text-muted)] mb-1 text-xs" htmlFor="password">Password</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-[var(--color-text-muted)]">
              <IoLockClosed className="text-sm" />
            </span>
            <input
              type="password"
              id="password"
              className={`w-full bg-[rgba(8,14,28,0.72)] border ${errorsStep1.password ? 'border-red-500' : 'border-[var(--color-surface-border)]'} rounded-xl py-2 px-7 text-sm text-white placeholder-[rgba(226,235,255,0.38)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]`}
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
          <label className="block text-[var(--color-text-muted)] mb-1 text-xs" htmlFor="confirmPassword">Confirm Password</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-[var(--color-text-muted)]">
              <IoLockClosed className="text-sm" />
            </span>
            <input
              type="password"
              id="confirmPassword"
              className={`w-full bg-[rgba(8,14,28,0.72)] border ${errorsStep1.confirmPassword ? 'border-red-500' : 'border-[var(--color-surface-border)]'} rounded-xl py-2 px-7 text-sm text-white placeholder-[rgba(226,235,255,0.38)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]`}
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
        className="w-full mt-4 bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-2)] text-slate-950 py-2 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-[0_20px_40px_rgba(34,211,238,0.14)]"
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