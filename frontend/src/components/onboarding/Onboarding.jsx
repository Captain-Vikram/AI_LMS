import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  IoPersonAddOutline,
  IoSchoolOutline,
  IoArrowForwardOutline,
  IoArrowBackOutline,
  IoCheckmarkCircleOutline,
  IoBriefcaseOutline,
  IoBookOutline,
} from "react-icons/io5";
import { useAuth, useUser } from "@clerk/clerk-react";

import apiClient from "../../services/apiClient";
import { API_ENDPOINTS } from "../../config/api";
import GlassDashboardShell from "../UI/GlassDashboardShell";

const Onboarding = () => {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const { user: clerkUser } = useUser();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1); // 1: Profile, 2: Role, 3: Final Action (Join/Create)

  // Form State
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    role: "student",
    enrollmentCode: "",
  });

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      navigate("/login");
      return;
    }

    let mounted = true;

    const bootstrap = async () => {
      try {
        const status = await apiClient.get(API_ENDPOINTS.AUTH_USER_STATUS);

        if (!mounted) return;

        if (status.onboarding_complete) {
          localStorage.setItem("onboardingComplete", "true");
          localStorage.setItem("isLoggedIn", "true");
          navigate("/classrooms");
          return;
        }

        // Pre-fill from Clerk if available
        setFormData((prev) => ({
          ...prev,
          firstName: clerkUser?.firstName || "",
          lastName: clerkUser?.lastName || "",
        }));

        setIsLoading(false);
      } catch (err) {
        if (!mounted) return;
        console.error("Onboarding bootstrap failed:", err);
        setIsLoading(false);
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, [isLoaded, isSignedIn, navigate, clerkUser]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setStep(2);
  };

  const handleRoleSelect = (selectedRole) => {
    setFormData({ ...formData, role: selectedRole });
    setStep(3);
  };

  const handleFinalSubmit = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      // 1. Update Profile & Role
      await apiClient.post("/api/onboarding/complete-profile", {
        first_name: formData.firstName,
        last_name: formData.lastName,
        role: formData.role,
      });

      localStorage.setItem("userRole", formData.role);

      // 2. Handle Role-specific Action
      if (formData.role === "student") {
        if (!formData.enrollmentCode) {
          setError("Please enter an enrollment code to join a classroom.");
          setIsSubmitting(false);
          return;
        }

        const response = await apiClient.post(API_ENDPOINTS.ONBOARDING_STUDENT_JOIN, {
          enrollment_code: formData.enrollmentCode.trim(),
        });

        localStorage.setItem("onboardingComplete", "true");
        localStorage.setItem("isLoggedIn", "true");
        navigate(`/classroom/${response.classroom_id}/dashboard`);
      } else {
        // Teacher/Admin
        // For teachers, we redirect them to classroom creation which will set onboarding_complete=true upon success
        navigate("/classroom/create");
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <GlassDashboardShell contentClassName="max-w-3xl">
        <div className="py-20 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Setting up your experience...</p>
        </div>
      </GlassDashboardShell>
    );
  }

  const stepVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <GlassDashboardShell contentClassName="max-w-4xl" withPanel={false}>
      <div className="w-full max-w-2xl mx-auto py-8">
        {/* Progress Indicator */}
        <div className="flex justify-between mb-12 relative">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-700 -translate-y-1/2 z-0"></div>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                step >= s
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-gray-800 border-gray-600 text-gray-400"
              }`}
            >
              {step > s ? <IoCheckmarkCircleOutline size={24} /> : s}
            </div>
          ))}
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-red-900/30 border border-red-500/50 text-red-200 text-sm"
          >
            {error}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Welcome to Quasar</h1>
                <p className="text-gray-400">Let's start by confirming your profile details.</p>
              </div>

              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">First Name</label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="Enter your first name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Last Name</label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="Enter your last name"
                    />
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    type="submit"
                    className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20"
                  >
                    Continue to Role Selection
                    <IoArrowForwardOutline />
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Choose Your Role</h1>
                <p className="text-gray-400">Select how you'll be using Quasar.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button
                  onClick={() => handleRoleSelect("student")}
                  className={`p-8 rounded-2xl border-2 text-left transition-all group ${
                    formData.role === "student"
                      ? "bg-blue-600/20 border-blue-500"
                      : "bg-gray-800/40 border-gray-700 hover:border-gray-500"
                  }`}
                >
                  <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <IoBookOutline size={32} className="text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">I'm a Student</h3>
                  <p className="text-gray-400 text-sm">Join classrooms, track your progress, and master new skills.</p>
                </button>

                <button
                  onClick={() => handleRoleSelect("teacher")}
                  className={`p-8 rounded-2xl border-2 text-left transition-all group ${
                    formData.role === "teacher"
                      ? "bg-emerald-600/20 border-emerald-500"
                      : "bg-gray-800/40 border-gray-700 hover:border-gray-500"
                  }`}
                >
                  <div className="w-14 h-14 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <IoBriefcaseOutline size={32} className="text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">I'm a Teacher</h3>
                  <p className="text-gray-400 text-sm">Create classrooms, manage students, and design learning pathways.</p>
                </button>
              </div>

              <div className="pt-6">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                  <IoArrowBackOutline />
                  Back to Profile
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">
                  {formData.role === "student" ? "Join a Classroom" : "Create Your Classroom"}
                </h1>
                <p className="text-gray-400">
                  {formData.role === "student"
                    ? "Enter the enrollment code provided by your teacher."
                    : "You're all set to start teaching. Create your first classroom now."}
                </p>
              </div>

              {formData.role === "student" ? (
                <form onSubmit={handleFinalSubmit} className="space-y-4 max-w-md mx-auto">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Enrollment Code</label>
                    <input
                      type="text"
                      required
                      value={formData.enrollmentCode}
                      onChange={(e) => setFormData({ ...formData, enrollmentCode: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-center text-lg tracking-widest"
                      placeholder="e.g. ABC-123-XYZ"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <IoPersonAddOutline />
                    {isSubmitting ? "Joining..." : "Join Classroom"}
                  </button>
                </form>
              ) : (
                <div className="text-center space-y-8">
                  <div className="p-8 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 inline-block">
                    <IoSchoolOutline size={64} className="text-emerald-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white">Teacher Account Verified</h3>
                    <p className="text-gray-400 max-w-xs mx-auto mt-2">
                      Click the button below to set up your first classroom and invite students.
                    </p>
                  </div>

                  <div className="max-w-md mx-auto">
                    <button
                      onClick={handleFinalSubmit}
                      disabled={isSubmitting}
                      className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      <IoArrowForwardOutline />
                      {isSubmitting ? "Processing..." : "Continue to Classroom Setup"}
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-6 text-center">
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mx-auto"
                >
                  <IoArrowBackOutline />
                  Change Role
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GlassDashboardShell>
  );
};

export default Onboarding;
