import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import apiClient from "../../services/apiClient";
import { API_ENDPOINTS } from "../../config/api";
import IconsCarousel from "../IconsCarousel";

// Step components
import GoalSettingStep from "./GoalSettingStep";
import LearningStyleStep from "./LearningStyleStep";
import CareerPathStep from "./CareerPathStep";
import OnboardingComplete from "./OnboardingComplete";

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [userData, setUserData] = useState({});
  const navigate = useNavigate();

  // Check if user is logged in
  useEffect(() => {
    const reassessmentInfo = localStorage.getItem("reassessmentInfo");

    const verifyAndRoute = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      if (reassessmentInfo) {
        navigate("/assessment");
        return;
      }

      try {
        const status = await apiClient.get(API_ENDPOINTS.AUTH_USER_STATUS);

        if (status.onboarding_complete && status.assessment_complete) {
          navigate("/dashboard");
          return;
        }

        if (status.onboarding_complete && !status.assessment_complete) {
          navigate("/assessment");
        }
      } catch {
        navigate("/login");
      }
    };

    verifyAndRoute();
  }, [navigate]);

  // Setup forms for each step
  const goalSettingForm = useForm({
    mode: "onChange",
    defaultValues: {
      primaryGoal: userData.primaryGoal || "",
      timeCommitment: userData.timeCommitment || "moderate",
      prioritySkills: userData.prioritySkills || [],
    },
  });

  const learningStyleForm = useForm({
    mode: "onChange",
    defaultValues: {
      preferredStyle: userData.preferredStyle || "",
      learningPace: userData.learningPace || "balanced",
      preferredResources: userData.preferredResources || [],
    },
  });

  const careerPathForm = useForm({
    mode: "onChange",
    defaultValues: {
      careerPath: userData.careerPath || "",
      experienceLevel: userData.experienceLevel || "beginner",
      desiredCertifications: userData.desiredCertifications || [],
    },
  });

  // Function to save onboarding data to API
  const saveOnboardingData = async (data) => {
    return apiClient.post(API_ENDPOINTS.ONBOARDING_SAVE, data);
  };

  // Mutation for saving onboarding data
  const onboardingMutation = useMutation({
    mutationFn: saveOnboardingData,
    onSuccess: () => {
      // Mark onboarding as complete in localStorage
      localStorage.setItem("onboardingComplete", "true");

      // Redirect to dashboard
      navigate("/assessment");
    },
    onError: (error) => {
      console.error("Error saving onboarding data:", error);
    },
  });

  // Handle step submissions
  const handleGoalSubmit = (data) => {
    setUserData((prev) => ({ ...prev, ...data }));
    setStep(2);
  };

  const handleLearningStyleSubmit = (data) => {
    setUserData((prev) => ({ ...prev, ...data }));
    setStep(3);
  };

  const handleCareerPathSubmit = (data) => {
    const finalData = { ...userData, ...data };
    setUserData(finalData);

    // Save to localStorage in case API call fails
    localStorage.setItem("onboardingData", JSON.stringify(finalData));

    // Submit all data to API
    onboardingMutation.mutate(finalData);
  };

  // Animation variants
  const pageVariants = {
    initial: { opacity: 0, x: 100 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -100 },
  };

  const containerVariants = {
    initial: { opacity: 0, y: 20 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1,
      },
    },
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 py-12 pt-28">
      {/* Background Icon Carousel */}
      <div className="absolute inset-0 overflow-hidden">
        <IconsCarousel
          backgroundColor="rgba(17, 24, 39, 0.8)"
          iconColor="gray-500/30"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90" />
      </div>

      <motion.div
        className="w-full max-w-2xl relative z-10"
        variants={containerVariants}
        initial="initial"
        animate="animate"
      >
        <div className="bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-6 shadow-xl">
          {/* Progress steps */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              {[1, 2, 3, 4].map((stepNum) => (
                <div key={stepNum} className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 flex items-center justify-center rounded-full 
                    ${
                      step === stepNum
                        ? "bg-blue-600"
                        : step > stepNum
                        ? "bg-green-500"
                        : "bg-gray-700"
                    }`}
                  >
                    {step > stepNum ? (
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <span className="text-white font-medium">{stepNum}</span>
                    )}
                  </div>
                  <div className="mt-2 text-center">
                    <p
                      className={`text-xs font-medium ${
                        step === stepNum
                          ? "text-blue-400"
                          : step > stepNum
                          ? "text-green-400"
                          : "text-gray-500"
                      }`}
                    >
                      {stepNum === 1 && "Learning Goals"}
                      {stepNum === 2 && "Learning Style"}
                      {stepNum === 3 && "Career Path"}
                      {stepNum === 4 && "Complete"}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="relative mt-2">
              <div className="absolute top-0 left-0 h-1 bg-gray-600 w-full rounded"></div>
              <div
                className="absolute top-0 left-0 h-1 bg-blue-600 rounded transition-all duration-300"
                style={{ width: `${(step - 1) * 33.33}%` }}
              ></div>
            </div>
          </div>

          {/* Step content */}
          {step === 1 && (
            <GoalSettingStep
              form={goalSettingForm}
              onSubmit={handleGoalSubmit}
              pageVariants={pageVariants}
            />
          )}

          {step === 2 && (
            <LearningStyleStep
              form={learningStyleForm}
              onSubmit={handleLearningStyleSubmit}
              onBack={() => setStep(1)}
              pageVariants={pageVariants}
            />
          )}

          {step === 3 && (
            <CareerPathStep
              form={careerPathForm}
              onSubmit={handleCareerPathSubmit}
              onBack={() => setStep(2)}
              pageVariants={pageVariants}
              isLoading={onboardingMutation.isPending}
            />
          )}

          {step === 4 && (
            <OnboardingComplete
              userData={userData}
              pageVariants={pageVariants}
            />
          )}
        </div>
      </motion.div>
    </section>
  );
};

export default Onboarding;
