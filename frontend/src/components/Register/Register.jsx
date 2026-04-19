import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query'; 
import { IoLockClosed } from 'react-icons/io5';
import IconsCarousel from '../IconsCarousel';
import { useBackground } from '../../context/BackgroundContext';
import apiClient from '../../services/apiClient';
import { API_ENDPOINTS } from '../../config/api';

import FormStep1 from './FormStep1';
import FormStep2 from './FormStep2';
import SuccessStep from './SuccessStep';
import ProgressSteps from './ProgressSteps';

const Register = () => {
  const [step, setStep] = useState(1);
  const [registrationError, setRegistrationError] = useState('');
  const navigate = useNavigate();
  const { backgroundColor } = useBackground();
  
  // React Hook Form setup for step 1
  const { 
    register: registerStep1, 
    handleSubmit: handleSubmitStep1, 
    watch: watchStep1,
    formState: { errors: errorsStep1 }
  } = useForm({
    mode: 'onBlur',
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: ''
    }
  });
  
  // React Hook Form setup for step 2
  const { 
    register: registerStep2, 
    handleSubmit: handleSubmitStep2,
    formState: { errors: errorsStep2 } 
  } = useForm({
    mode: 'onBlur',
    defaultValues: {
      firstName: '',
      lastName: '',
      location: '',
      role: ''
    }
  });
  
  // API registration function
  const registerUser = async (userData) =>
    apiClient.post(API_ENDPOINTS.AUTH_REGISTER, userData);

  // Registration mutation
  const registerMutation = useMutation({
    mutationFn: registerUser,
    onSuccess: async (data) => {
      // Set the user as logged in
      localStorage.setItem("isLoggedIn", "true");
      // Store the JWT token
      localStorage.setItem('token', data.token);
      if (data.role) {
        localStorage.setItem('userRole', data.role);
      }
      
      // Initialize empty onboarding data
      localStorage.setItem('onboardingData', JSON.stringify({}));
      
      // Instead of showing success step, redirect to onboarding
      navigate('/onboarding');
      
      // Clean up stored registration data
      localStorage.removeItem('registerStep1');
    },
    onError: (error) => {
      setRegistrationError(error.message);
      console.error('Registration error:', error);
    }
  });
  
  // Handle step 1 submission
  const onSubmitStep1 = (data) => {
    localStorage.setItem('registerStep1', JSON.stringify(data));
    setStep(2);
  };

  // Handle step 2 submission (final form submission)
  const onSubmitStep2 = (data) => {
    const step1Data = JSON.parse(localStorage.getItem('registerStep1'));
    
    // Create registration data based on the schema
    const userData = {
      email: step1Data.email,
      password: step1Data.password,
      first_name: data.firstName,
      last_name: data.lastName,
      location: data.location,
      role: data.role
    };
    
    // Send registration data to API
    registerMutation.mutate(userData);
  };

  // Animation variants
  const pageVariants = {
    initial: { opacity: 0, x: 100 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -100 }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 py-12 pt-28 overflow-hidden">
      {/* Background Icon Carousel */}
      <motion.div className="absolute inset-0" style={{ backgroundColor }}>
        <IconsCarousel />
      </motion.div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_22%,rgba(34,211,238,0.12),transparent_36%),radial-gradient(circle_at_82%_64%,rgba(79,140,255,0.18),transparent_44%),linear-gradient(120deg,rgba(7,11,23,0.2),rgba(7,11,23,0.76))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_52%,rgba(4,8,18,0.62)_100%)]" />

      <div className="w-full max-w-sm relative z-10">
        <motion.div 
          className="bg-[var(--color-surface)] backdrop-blur-xl border border-[var(--color-surface-border)] rounded-3xl p-6 shadow-[var(--shadow-xl)]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Logo and title */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] rounded-full flex items-center justify-center mx-auto mb-3 shadow-[0_0_30px_rgba(34,211,238,0.18)]">
              <IoLockClosed className="text-white text-xl" />
            </div>
            <h1 className="text-2xl font-bold text-white">Create Account</h1>
            <p className="text-[var(--color-text-muted)] mt-1 text-sm">Start your learning journey with us</p>
          </div>

          {/* Progress steps */}
          <ProgressSteps currentStep={step} />

          {/* Registration error message */}
          {registrationError && (
            <div className="bg-red-900/30 border border-red-800 text-red-300 px-3 py-2 rounded-md text-sm mb-4">
              {registrationError}
            </div>
          )}

          {/* Form steps */}
          {step === 1 && (
            <FormStep1 
              registerStep1={registerStep1}
              handleSubmitStep1={handleSubmitStep1}
              watchStep1={watchStep1}
              errorsStep1={errorsStep1}
              onSubmitStep1={onSubmitStep1}
              pageVariants={pageVariants}
            />
          )}

          {step === 2 && (
            <FormStep2
              registerStep2={registerStep2}
              handleSubmitStep2={handleSubmitStep2}
              errorsStep2={errorsStep2}
              onSubmitStep2={onSubmitStep2}
              setStep={setStep}
              pageVariants={pageVariants}
              isLoading={registerMutation.isPending}
            />
          )}

          {/* Login link */}
          <div className="mt-5 text-center">
            <p className="text-[var(--color-text-muted)] text-xs">
              Already have an account?{' '}
              <Link to="/login" className="text-[var(--color-accent)] hover:text-[var(--color-accent-2)] font-medium">
                Log in
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Register;