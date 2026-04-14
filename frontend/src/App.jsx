import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./components/Home";
import Navbar from "./components/Navbar";
import Features from "./components/Features";
import { BackgroundProvider } from "./context/BackgroundContext";
import Register from "./components/Register/Register";
import Login from "./components/Login";
import Onboarding from "./components/onboarding/Onboarding";
import SkillAssesment from "./components/SkillAssessment";
import SkillAssessmentRecommendations from "./components/SkillAssessmentRecommendations";
import YoutubeAssessment from "./components/YoutubeAssessment";
import Dashboard from "./components/Dashboard";
import Signout from "./components/Signout";
import OverallStatistics from "./components/OverallStatistics";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import apiClient from "./services/apiClient";
import { API_ENDPOINTS } from "./config/api";

// Protected route to ensure the user is logged in
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Route that checks for user progress
const UserProgressRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  const reassessmentInfo = localStorage.getItem("reassessmentInfo");
  const [statusLoading, setStatusLoading] = useState(!!token);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [assessmentComplete, setAssessmentComplete] = useState(false);
  const [statusError, setStatusError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const verifyStatus = async () => {
      if (!token) {
        if (isMounted) {
          setStatusLoading(false);
        }
        return;
      }

      try {
        const status = await apiClient.get(API_ENDPOINTS.AUTH_USER_STATUS);
        if (!isMounted) {
          return;
        }

        const onboardingDone = !!status.onboarding_complete;
        const assessmentDone = !!status.assessment_complete;

        setOnboardingComplete(onboardingDone);
        setAssessmentComplete(assessmentDone);
        setStatusError(false);

        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem(
          "onboardingComplete",
          onboardingDone ? "true" : "false"
        );
        localStorage.setItem(
          "skillAssessmentComplete",
          assessmentDone ? "true" : "false"
        );
      } catch {
        if (isMounted) {
          setStatusError(true);
        }
      } finally {
        if (isMounted) {
          setStatusLoading(false);
        }
      }
    };

    verifyStatus();

    return () => {
      isMounted = false;
    };
  }, [token]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <p>Verifying your account status...</p>
      </div>
    );
  }

  if (statusError) {
    return <Navigate to="/login" replace />;
  }

  if (!onboardingComplete && !reassessmentInfo) {
    return <Navigate to="/onboarding" replace />;
  }
  if (!assessmentComplete && !reassessmentInfo) {
    return <Navigate to="/assessment" replace />;
  }
  return children;
};

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BackgroundProvider>
        <BrowserRouter>
          <Navbar />
          <Routes>
            {/* Public routes */}
            <Route
              path="/"
              element={
                <main className="overflow-hidden relative">
                  <div className="relative flex flex-col">
                    <Home />
                    <Features />
                  </div>
                </main>
              }
            />
            <Route path="/features" element={<Features />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signout" element={<Signout />} />

            {/* Protected routes */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/assessment"
              element={
                <ProtectedRoute>
                  <SkillAssesment />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recommendations"
              element={
                <ProtectedRoute>
                  <SkillAssessmentRecommendations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/youtube-assesment"
              element={
                <ProtectedRoute>
                  <YoutubeAssessment />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <UserProgressRoute>
                  <Dashboard />
                </UserProgressRoute>
              }
            />
            <Route path="/overall-statistics" element={<OverallStatistics />} />
          </Routes>
        </BrowserRouter>
      </BackgroundProvider>
    </QueryClientProvider>
  );
};

export default App;
