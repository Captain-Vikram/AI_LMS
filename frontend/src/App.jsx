import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./components/Home";
import Navbar from "./components/Navbar";
import Features from "./components/Features";
import Contact from "./components/Contact";
import { BackgroundProvider } from "./context/BackgroundContext";
import Register from "./components/Register/Register";
import Login from "./components/Login";
import Onboarding from "./components/onboarding/Onboarding";
import Dashboard from "./components/Dashboard";
import Signout from "./components/Signout";
import OverallStatistics from "./components/OverallStatistics";
import ClassroomList from "./components/Classroom/ClassroomList";
import CreateClassroom from "./components/Classroom/CreateClassroom";
import JoinByCode from "./components/Classroom/JoinByCode";
import ClassroomPage from "./components/Classroom/ClassroomPage";
import ClassroomDashboard from "./pages/Classroom/ClassroomDashboard";
import ClassroomRoster from "./pages/Classroom/ClassroomRoster";
import LearningModulesPage from "./pages/Classroom/LearningModules";
import StudentPersonalResourcesPage from "./pages/Classroom/StudentPersonalResourcesPage";
import ModuleAssessmentBuilderPage from "./pages/Classroom/ModuleAssessmentBuilderPage";
import ClassroomSettings from "./pages/Classroom/ClassroomSettings";
import InteractiveLessonViewer from "./components/Classroom/InteractiveLessonViewer";
import TeacherGradingDashboard from "./components/Classroom/TeacherGradingDashboard";
import StudentProgressTimeline from "./components/Classroom/StudentProgressTimeline";
import { ClassroomProvider } from "./context/ClassroomContext";
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

        setOnboardingComplete(onboardingDone);
        setStatusError(false);
        if (status.role) {
          localStorage.setItem("userRole", status.role);
        }

        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem(
          "onboardingComplete",
          onboardingDone ? "true" : "false"
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
  return children;
};

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BackgroundProvider>
        <ClassroomProvider>
          <BrowserRouter>
            <Navbar />
            <Routes>
            {/* Public routes */}
            <Route
              path="/"
              element={
                <main className="relative">
                  <div className="relative flex flex-col">
                    <Home />
                    <Features />
                  </div>
                </main>
              }
            />
            <Route path="/features" element={<Features />} />
            <Route path="/contact" element={<Contact />} />
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
              path="/dashboard"
              element={
                <UserProgressRoute>
                  <Dashboard />
                </UserProgressRoute>
              }
            />
            <Route
              path="/classrooms"
              element={
                <UserProgressRoute>
                  <ClassroomList />
                </UserProgressRoute>
              }
            />
            <Route
              path="/classroom/create"
              element={
                <UserProgressRoute>
                  <CreateClassroom />
                </UserProgressRoute>
              }
            />
            <Route
              path="/classroom/join"
              element={
                <UserProgressRoute>
                  <JoinByCode />
                </UserProgressRoute>
              }
            />
            <Route
              path="/classroom/:id"
              element={
                <UserProgressRoute>
                  <ClassroomPage />
                </UserProgressRoute>
              }
            />
            <Route
              path="/classroom/:id/dashboard"
              element={
                <UserProgressRoute>
                  <ClassroomDashboard />
                </UserProgressRoute>
              }
            />
            <Route
              path="/classroom/:id/roster"
              element={
                <UserProgressRoute>
                  <ClassroomRoster />
                </UserProgressRoute>
              }
            />
            <Route
              path="/classroom/:id/modules"
              element={
                <UserProgressRoute>
                  <LearningModulesPage />
                </UserProgressRoute>
              }
            />
            <Route
              path="/classroom/:id/resources"
              element={
                <UserProgressRoute>
                  <LearningModulesPage />
                </UserProgressRoute>
              }
            />
            <Route
              path="/classroom/:id/personal-resources"
              element={
                <UserProgressRoute>
                  <StudentPersonalResourcesPage />
                </UserProgressRoute>
              }
            />
            <Route
              path="/classroom/:id/personal-resources/notebook/:notebookId"
              element={
                <UserProgressRoute>
                  <StudentPersonalResourcesPage />
                </UserProgressRoute>
              }
            />
            <Route
              path="/classroom/:id/modules/:moduleId/learn/:resourceId"
              element={
                <UserProgressRoute>
                  <InteractiveLessonViewer />
                </UserProgressRoute>
              }
            />
            <Route
              path="/classroom/:id/modules/:moduleId/assessment-builder"
              element={
                <UserProgressRoute>
                  <ModuleAssessmentBuilderPage />
                </UserProgressRoute>
              }
            />
            <Route
              path="/classroom/:id/roster/:studentId"
              element={
                <UserProgressRoute>
                  <StudentProgressTimeline />
                </UserProgressRoute>
              }
            />
            <Route
              path="/classroom/:id/grading"
              element={
                <UserProgressRoute>
                  <TeacherGradingDashboard />
                </UserProgressRoute>
              }
            />
            <Route
              path="/classroom/:id/settings"
              element={
                <UserProgressRoute>
                  <ClassroomSettings />
                </UserProgressRoute>
              }
            />
            <Route path="/overall-statistics" element={<OverallStatistics />} />
          </Routes>
        </BrowserRouter>
        </ClassroomProvider>
      </BackgroundProvider>
    </QueryClientProvider>
  );
};

export default App;