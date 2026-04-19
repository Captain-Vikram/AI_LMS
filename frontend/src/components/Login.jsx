import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { IoLockClosed } from "react-icons/io5";
import IconsCarousel from "../components/IconsCarousel";
import { useBackground } from "../context/BackgroundContext";
import apiClient from "../services/apiClient";
import { API_ENDPOINTS } from "../config/api";

const Login = () => {
  const navigate = useNavigate();
  const [loginError, setLoginError] = useState("");
  const { backgroundColor } = useBackground();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    mode: "onBlur",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Define the login function
  const loginUser = async (data) => apiClient.post(API_ENDPOINTS.AUTH_LOGIN, data);

  // Updated mutation syntax for v4/v5
  const loginMutation = useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("token", data.token);
      if (data.role) {
        localStorage.setItem("userRole", data.role);
      }

      // Store onboarding status
      if (data.onboarding_complete) {
        localStorage.setItem("onboardingComplete", "true");
      }

      // Store assessment status if available in response
      if (data.assessment_complete) {
        localStorage.setItem("skillAssessmentComplete", "true");
      }

      // Check if there's an ongoing reassessment
      const reassessmentInfo = localStorage.getItem("reassessmentInfo");
      
      if (reassessmentInfo) {
        // If there's a reassessment in progress, continue with it
        navigate("/assessment");
      } else {
        // Classroom-first flow
        if (data.onboarding_complete) {
          navigate("/classrooms");
        } else {
          navigate("/onboarding");
        }
      }
    },
    onError: (error) => {
      setLoginError(error.message);
    },
  });

  // Handle login form submission
  const onSubmit = (data) => {
    setLoginError("");
    loginMutation.mutate(data);
  };

  // Animation variants
  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
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
          initial="initial"
          animate="animate"
          exit="exit"
          variants={pageVariants}
          transition={{ duration: 0.4 }}
        >
          {/* Logo and title */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] rounded-full flex items-center justify-center mx-auto mb-3 shadow-[0_0_30px_rgba(34,211,238,0.18)]">
              <IoLockClosed className="text-white text-xl" />
            </div>
            <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
            <p className="text-gray-400 mt-1 text-sm">
              Sign in to continue your learning journey
            </p>
          </div>

          {/* Login form */}
          <motion.form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            variants={pageVariants}
          >
            {/* Email field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[var(--color-text-muted)] mb-1"
              >
                Email address
              </label>
              <input
                type="email"
                id="email"
                className={`w-full px-4 py-2.5 bg-[rgba(8,14,28,0.72)] border ${
                  errors.email ? "border-red-500" : "border-gray-600"
                } text-white rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all`}
                placeholder="you@example.com"
                {...register("email", {
                  required: "Email is required",
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: "Invalid email address",
                  },
                })}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password field */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-[var(--color-text-muted)]"
                >
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-2)]"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                id="password"
                className={`w-full px-4 py-2.5 bg-[rgba(8,14,28,0.72)] border ${
                  errors.password ? "border-red-500" : "border-gray-600"
                } text-white rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all`}
                placeholder="••••••••"
                {...register("password", {
                  required: "Password is required",
                  minLength: {
                    value: 6,
                    message: "Password must be at least 6 characters",
                  },
                })}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Remember me checkbox */}
            <div className="flex items-center">
              <input
                id="remember"
                type="checkbox"
                className="w-4 h-4 text-[var(--color-accent)] bg-[rgba(8,14,28,0.72)] border-[var(--color-surface-border)] rounded focus:ring-[var(--color-accent)]"
                {...register("remember")}
              />
              <label htmlFor="remember" className="ml-2 text-sm text-[var(--color-text-muted)]">
                Remember me
              </label>
            </div>

            {/* Error message */}
            {loginError && (
              <div className="bg-red-900/30 border border-red-800 text-red-300 px-3 py-2 rounded-xl text-sm">
                {loginError}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-2)] text-slate-950 font-semibold rounded-xl hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-all duration-300 flex justify-center items-center shadow-[0_20px_40px_rgba(34,211,238,0.18)]"
            >
              {loginMutation.isPending ? (
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              ) : null}
              {loginMutation.isPending ? "Signing in..." : "Sign in"}
            </button>
          </motion.form>

          {/* Register link */}
          <div className="mt-5 text-center">
            <p className="text-[var(--color-text-muted)] text-xs">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="text-[var(--color-accent)] hover:text-[var(--color-accent-2)] font-medium"
              >
                Sign up
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Login;
