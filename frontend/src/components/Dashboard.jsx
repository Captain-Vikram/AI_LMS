import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import IconsCarousel from "./IconsCarousel";
import UserSkills from "./UserSkills";
import AssessmentHistoryChart from "./AssessmentHistoryChart";
import SkillRadarChart from "./SkillRadarChart";
import XPProgressBar from "./XPProgressBar";
import BadgeCollection from "./BadgeCollection";
import AchievementNotification from "./AchievementNotification";
import apiClient from "../services/apiClient";
import { API_ENDPOINTS } from "../config/api";
// Import icons
import {
  IoBarChartOutline,
  IoTimeOutline,
  IoTrophyOutline,
  IoRocketOutline,
  IoCalendarOutline,
  IoFlameOutline,
  IoCheckmarkCircleOutline,
  IoBookOutline,
  IoArrowForwardOutline,
  IoGridOutline,
  IoAlertCircleOutline,
  IoPlayCircleOutline,
  IoLayersOutline,
  IoRefreshOutline,
  IoFlashOutline,
} from "react-icons/io5";

const Dashboard = () => {
  const { id: focusedPathwayId } = useParams();
  const navigate = useNavigate();
  const codingLabUrl = import.meta.env.VITE_CODING_URL || "http://localhost:8502/";
  const [userData, setUserData] = useState({});
  const [assessmentResults, setAssessmentResults] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [myPathways, setMyPathways] = useState([]);
  const [pathwayStageData, setPathwayStageData] = useState(null);
  const [pathwayBlueprint, setPathwayBlueprint] = useState(null);
  const [pathwayStageLoading, setPathwayStageLoading] = useState(false);
  const [pathwayActionLoading, setPathwayActionLoading] = useState(false);
  const [completingStage, setCompletingStage] = useState(false);
  const [userSkills, setUserSkills] = useState([]);
  const [assessmentHistory, setAssessmentHistory] = useState([]);
  const [analyticsData, setAnalyticsData] = useState({
    learningStreak: 0,
    totalLearningHours: 0,
    completedModules: 0,
    progressPercentage: 0,
    upcomingMilestones: [],
    recentAchievements: [],
  });

  const [showBadgeCollection, setShowBadgeCollection] = useState(false);
  const [newAchievement, setNewAchievement] = useState(null);
  const [userXP, setUserXP] = useState({
    current: 0,
    level: 1,
    levelThreshold: 100,
    total_earned: 0,
  });

  const [errorMessages, setErrorMessages] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [badges, setBadges] = useState([]);
  const [achievementQueue, setAchievementQueue] = useState([]);
  const [isRoadmapExpanded, setIsRoadmapExpanded] = useState(false);

  const addErrorMessage = (message) => {
    setErrorMessages((prevMessages) => {
      if (prevMessages.includes(message)) {
        return prevMessages;
      }

      return [...prevMessages, message];
    });
  };

  const clearErrors = () => {
    setErrorMessages([]);
  };

  const [loginActivity, setLoginActivity] = useState([
    { day: "S", count: 0, percentage: 0 },
    { day: "M", count: 0, percentage: 0 },
    { day: "T", count: 0, percentage: 0 },
    { day: "W", count: 0, percentage: 0 },
    { day: "T", count: 0, percentage: 0 },
    { day: "F", count: 0, percentage: 0 },
    { day: "S", count: 0, percentage: 0 },
  ]);

  const isSkillPathwayMode = Boolean(focusedPathwayId);
  const focusedPathway = isSkillPathwayMode
    ? myPathways.find((pathway) => pathway.pathway_id === focusedPathwayId) || null
    : null;

  const focusedStageProgress = Array.isArray(focusedPathway?.stage_progress)
    ? focusedPathway.stage_progress
    : [];

  const focusedCurrentStage =
    focusedStageProgress.find((stage) => stage.status === "in-progress") ||
    focusedStageProgress[0] ||
    null;

  const focusedTotalStages =
    Number(focusedPathway?.pathway_details?.total_stages) ||
    focusedStageProgress.length ||
    0;

  const focusedCompletedStages = focusedStageProgress.filter(
    (stage) => stage.status === "completed"
  ).length;

  const focusedProgressPercent =
    focusedTotalStages > 0
      ? Math.round((focusedCompletedStages / focusedTotalStages) * 100)
      : 0;

  const focusedResources = Array.isArray(pathwayStageData?.tracker?.resources)
    ? pathwayStageData.tracker.resources
    : [];
  const focusedVideoCount = focusedResources.filter(
    (resourceItem) => String(resourceItem?.type || "").toLowerCase() === "video"
  ).length;
  const focusedArticleCount = focusedResources.filter(
    (resourceItem) => String(resourceItem?.type || "").toLowerCase() === "article"
  ).length;
  const focusedMasteredCount = focusedResources.filter(
    (resourceItem) => Number(resourceItem?.passed_tests_count || 0) >= 2
  ).length;

  const displayedPathways = isSkillPathwayMode
    ? myPathways.filter((pathway) => pathway.pathway_id === focusedPathwayId)
    : myPathways;

  const fetchUserXP = async () => {
    try {
      const xpData = await apiClient.get(API_ENDPOINTS.GAMIFICATION_XP);
      const currentXP = xpData.current ?? xpData.xp ?? 0;

      setUserXP({
        current: currentXP,
        level: xpData.level ?? 1,
        levelThreshold: xpData.level_threshold ?? 100,
        total_earned: xpData.total_earned ?? 0,
      });

      setAnalyticsData((prev) => ({
        ...prev,
        learningStreak: xpData.streak ?? prev.learningStreak,
      }));
    } catch (error) {
      addErrorMessage(`Unable to load XP data: ${error.message}`);
    }
  };

  const fetchUserBadges = async () => {
    try {
      const badgeData = await apiClient.get(API_ENDPOINTS.GAMIFICATION_BADGES);
      const availableBadges = Array.isArray(badgeData.badges)
        ? badgeData.badges
        : [];

      setBadges(
        availableBadges.map((badge) => ({
          id: badge.id,
          name: badge.name,
          shortDescription: badge.short_description,
          description: badge.description,
          category: badge.category,
          color: badge.color,
          icon: badge.icon,
          unlocked: badge.unlocked,
          earned_date: badge.earned_date,
          progress: badge.progress,
          xpAwarded: badge.xp_awarded,
          reward: badge.reward || null,
        }))
      );

      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const newlyEarned = availableBadges.filter((badge) => {
        if (!badge.unlocked || !badge.earned_date) {
          return false;
        }

        const earnedTimestamp = new Date(badge.earned_date).getTime();
        return Number.isFinite(earnedTimestamp) && earnedTimestamp > oneDayAgo;
      });

      if (newlyEarned.length > 0) {
        setAchievementQueue(
          newlyEarned.map((badge) => ({
            id: badge.id,
            name: badge.name,
            shortDescription: badge.short_description,
            color: badge.color,
            icon: badge.icon,
            xpAwarded: badge.xp_awarded,
          }))
        );
      }
    } catch (error) {
      addErrorMessage(`Unable to load badge data: ${error.message}`);
    }
  };

  const fetchAnalyticsData = async () => {
    try {
      const analytics = await apiClient.get(API_ENDPOINTS.ANALYTICS_DASHBOARD);
      const apiMilestones = Array.isArray(analytics.upcomingMilestones)
        ? analytics.upcomingMilestones
        : [];
      const apiAchievements = Array.isArray(analytics.recent_achievements)
        ? analytics.recent_achievements
        : [];

      setAnalyticsData((prevData) => ({
        ...prevData,
        totalLearningHours:
          analytics.total_learning_hours ?? prevData.totalLearningHours,
        completedModules: analytics.completed_modules ?? prevData.completedModules,
        progressPercentage:
          analytics.progress_percentage ?? prevData.progressPercentage,
        upcomingMilestones: apiMilestones.map((milestone) => ({
          id: milestone.id,
          name: milestone.name || "Learning milestone",
          progress: Math.max(0, Math.min(100, Number(milestone.progress) || 0)),
        })),
        recentAchievements: apiAchievements.map((achievement) => {
          const parsedDate = achievement.date ? new Date(achievement.date) : null;
          const formattedDate =
            parsedDate && Number.isFinite(parsedDate.getTime())
              ? parsedDate.toLocaleDateString()
              : "Recently";

          return {
            id: achievement.id,
            name: achievement.name || "Achievement",
            description: achievement.description || "",
            date: formattedDate,
          };
        }),
      }));
    } catch (error) {
      addErrorMessage(`Unable to load analytics: ${error.message}`);
    }
  };

  useEffect(() => {
    if (achievementQueue.length > 0 && !newAchievement) {
      // Display the first achievement in the queue
      setNewAchievement(achievementQueue[0]);

      // Remove it from the queue
      setAchievementQueue((prev) => prev.slice(1));
    }
  }, [achievementQueue, newAchievement]);

  // Handle achievement notification close
  const handleAchievementClose = () => {
    setNewAchievement(null);
    // The next achievement will be shown on next render due to the effect above
  };

  // Function to handle retaking the assessment
  const handleRetakeAssessment = () => {
    // Get the current level to determine the new assessment difficulty
    const currentLevel = assessmentResults?.assessed_level || "intermediate";

    // Set skillAssessmentComplete to false to ensure the assessment page doesn't redirect
    localStorage.setItem("skillAssessmentComplete", "false");

    // Store the information about reassessment in localStorage
    localStorage.setItem(
      "reassessmentInfo",
      JSON.stringify({
        previousLevel: currentLevel,
        previousScore: assessmentResults?.score?.percentage || 0,
        isReassessment: true,
        timestamp: new Date().toISOString(),
      })
    );

    // Navigate to the assessment page
    navigate("/assessment");
  };

  // Fetch assessment results including historical data
  const fetchAssessmentHistory = async () => {
    try {
      const data = await apiClient.get(API_ENDPOINTS.QUIZ_ASSESSMENT_HISTORY);

      if (Array.isArray(data.assessments) && data.assessments.length > 0) {
        setAssessmentHistory(data.assessments);
        setAssessmentResults(data.assessments[0]);

        if (data.assessments.length > 1) {
          const progressData = calculateAssessmentProgress(data.assessments);
          setAnalyticsData((prevData) => ({
            ...prevData,
            assessmentProgress: progressData,
          }));
        }
      } else {
        setAssessmentHistory([]);
      }
    } catch (error) {
      addErrorMessage(`Unable to load assessment history: ${error.message}`);
    }
  };

  const fetchLoginActivity = async () => {
    try {
      const data = await apiClient.get(API_ENDPOINTS.AUTH_LOGIN_ACTIVITY);
      if (Array.isArray(data.weekly_activity)) {
        setLoginActivity(
          data.weekly_activity.map((item) => ({
            day: item.day.charAt(0),
            count: item.count,
            percentage: item.percentage,
          }))
        );
      }
    } catch (error) {
      addErrorMessage(`Unable to load weekly login activity: ${error.message}`);
    }
  };

  const fetchUserSkills = async () => {
    if (!API_ENDPOINTS.ONBOARDING_USER_SKILLS) {
      setUserSkills([]);
      return;
    }

    try {
      const skillsData = await apiClient.get(API_ENDPOINTS.ONBOARDING_USER_SKILLS);
      setUserSkills(Array.isArray(skillsData) ? skillsData : []);
    } catch (error) {
      addErrorMessage(`Unable to load user skills: ${error.message}`);
    }
  };

  const fetchUserData = async () => {
    try {
      const data = await apiClient.get(API_ENDPOINTS.AUTH_USER_PROFILE);
      setUserData(data || {});
    } catch (error) {
      addErrorMessage(`Unable to load profile: ${error.message}`);
    }
  };

  const fetchMyPathways = async () => {
    try {
      if (API_ENDPOINTS.PATHWAYS_MY_PROGRESS) {
        const response = await apiClient.get(API_ENDPOINTS.PATHWAYS_MY_PROGRESS);
        if (response && response.status === "success") {
          const pathways = Array.isArray(response.data) ? response.data : [];
          setMyPathways(pathways);
          return pathways;
        }
      }
    } catch (error) {
      addErrorMessage(`Unable to load pathway progress: ${error.message}`);
    }

    setMyPathways([]);
    return [];
  };

  const fetchFocusedPathwayStageData = async () => {
    if (!isSkillPathwayMode || !focusedPathwayId) {
      return;
    }

    if (!focusedCurrentStage?.stage_index) {
      setPathwayStageData(null);
      return;
    }

    setPathwayStageLoading(true);
    try {
      const response = await apiClient.get(
        API_ENDPOINTS.PATHWAY_STAGE_DETAILS(
          focusedPathwayId,
          focusedCurrentStage.stage_index
        )
      );

      if (response?.status === "success") {
        setPathwayStageData(response.data || null);
      } else {
        setPathwayStageData(null);
      }
    } catch (error) {
      setPathwayStageData(null);
      addErrorMessage(`Unable to load stage details: ${error.message}`);
    } finally {
      setPathwayStageLoading(false);
    }
  };

  const fetchPathwayBlueprint = async () => {
    if (!isSkillPathwayMode || !focusedPathwayId) return;
    try {
      if (API_ENDPOINTS.PATHWAY_GET_BLUEPRINT) {
        const response = await apiClient.get(API_ENDPOINTS.PATHWAY_GET_BLUEPRINT(focusedPathwayId));
        if (response?.status === "success") {
          setPathwayBlueprint(response.data);
        }
      }
    } catch (error) {
      console.warn("Could not load pathway blueprint", error);
    }
  };

  const verifyUserStatus = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return false;
    }

    try {
      const status = await apiClient.get(API_ENDPOINTS.AUTH_USER_STATUS);

      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem(
        "onboardingComplete",
        status.onboarding_complete ? "true" : "false"
      );
      localStorage.setItem(
        "skillAssessmentComplete",
        status.assessment_complete ? "true" : "false"
      );

      if (!status.onboarding_complete) {
        navigate("/onboarding");
        return false;
      }

      if (!status.assessment_complete) {
        navigate("/assessment");
        return false;
      }

      return true;
    } catch {
      navigate("/login");
      return false;
    }
  };

  const refreshDashboardData = async () => {
    setIsRefreshing(true);
    clearErrors();

    await Promise.all([
      fetchAnalyticsData(),
      fetchUserXP(),
      fetchUserBadges(),
      fetchAssessmentHistory(),
      fetchLoginActivity(),
      fetchUserSkills(),
      fetchUserData(),
      fetchMyPathways(),
      isSkillPathwayMode ? fetchPathwayBlueprint() : Promise.resolve(),
    ]);

    setIsRefreshing(false);
  };

  const handleCompleteStage = async (stageIndex) => {
    if (!focusedPathwayId) return;
    setCompletingStage(true);
    try {
      await apiClient.post(API_ENDPOINTS.PATHWAY_COMPLETE_STAGE(focusedPathwayId, stageIndex));
      await refreshDashboardData();
    } catch (error) {
      addErrorMessage(`Unable to complete stage: ${error.message}`);
    } finally {
      setCompletingStage(false);
    }
  };

  const handleGenerateFocusedResources = async () => {
    if (!focusedPathwayId || !focusedCurrentStage?.stage_index) {
      return;
    }

    setPathwayActionLoading(true);
    clearErrors();
    try {
      await apiClient.post(
        API_ENDPOINTS.PATHWAY_GENERATE_RESOURCES(
          focusedPathwayId,
          focusedCurrentStage.stage_index
        )
      );
      await refreshDashboardData();
    } catch (error) {
      addErrorMessage(`Unable to generate resources: ${error.message}`);
    } finally {
      setPathwayActionLoading(false);
    }
  };

  const handleOpenResourcesWorkspace = () => {
    if (!focusedPathwayId) {
      return;
    }

    navigate(`/skill-pathway/${focusedPathwayId}/resources`);
  };

  const handleTakeSkillAssessment = async () => {
    if (!focusedPathwayId) {
      return;
    }

    const activeStageIndex = focusedCurrentStage?.stage_index || 1;
    const firstResourceId = String(
      focusedResources.find((resourceItem) => resourceItem?.resource_id)?.resource_id || ""
    ).trim();

    if (firstResourceId) {
      navigate(
        `/skill-pathway/${focusedPathwayId}/stage/${activeStageIndex}/resource/${firstResourceId}`
      );
      return;
    }

    await handleGenerateFocusedResources();
    navigate(`/skill-pathway/${focusedPathwayId}/resources`);
  };

  // Calculate progress between assessments
  const calculateAssessmentProgress = (assessments) => {
    // Sort by timestamp descending (newest first)
    const sortedAssessments = [...assessments].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );

    // Compare the most recent two assessments
    if (sortedAssessments.length >= 2) {
      const latest = sortedAssessments[0];
      const previous = sortedAssessments[1];
      const latestScore = latest?.score?.percentage ?? 0;
      const previousScore = previous?.score?.percentage ?? 0;

      return {
        scoreChange: latestScore - previousScore,
        levelChange:
          latest.assessed_level !== previous.assessed_level
            ? `${previous.assessed_level} → ${latest.assessed_level}`
            : null,
        improvedAreas: (latest.skill_gaps?.areas || [])
          .filter(
            (area) =>
              area.level === "satisfactory" &&
              (previous.skill_gaps?.areas || []).find(
                (prevArea) =>
                  prevArea.skill === area.skill &&
                  prevArea.level === "needs improvement"
              )
          )
          .map((area) => area.skill),
        timestamp: latest.timestamp,
      };
    }

    return null;
  };

  useEffect(() => {
    if (!isSkillPathwayMode) {
      setPathwayStageData(null);
      setPathwayStageLoading(false);
      return;
    }

    if (!focusedCurrentStage?.stage_index) {
      setPathwayStageData(null);
      return;
    }

    fetchFocusedPathwayStageData();
    fetchPathwayBlueprint();
  }, [isSkillPathwayMode, focusedPathwayId, focusedCurrentStage?.stage_index]);

  useEffect(() => {
    const initializeDashboard = async () => {
      const hasAccess = await verifyUserStatus();
      if (!hasAccess) {
        setIsLoading(false);
        return;
      }

      const storedResults = localStorage.getItem("skillAssessmentResults");
      if (storedResults) {
        try {
          setAssessmentResults(JSON.parse(storedResults));
        } catch {
          localStorage.removeItem("skillAssessmentResults");
        }
      }

      await refreshDashboardData();
      setIsLoading(false);
    };

    initializeDashboard();
  }, [navigate, focusedPathwayId, isSkillPathwayMode]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-t-blue-500 border-b-purple-500 border-l-transparent border-r-transparent rounded-full animate-spin"></div>
          <p>
            {isSkillPathwayMode
              ? "Loading your skill dashboard..."
              : "Loading your dashboard..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="relative min-h-screen px-4 py-12 pt-28">
      {/* Background Icon Carousel */}
      <div className="absolute inset-0 overflow-hidden">
        <IconsCarousel
          backgroundColor="rgba(17, 24, 39, 0.8)"
          iconColor="gray-500/30"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90" />
      </div>

      <div className="container mx-auto relative z-10">
        <div className="bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-8 shadow-xl">
          {/* User Welcome Section */}
          <div className="flex flex-col md:flex-row justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {isSkillPathwayMode
                  ? `${focusedPathway?.pathway_details?.title || "Skill Pathway"} Dashboard`
                  : `Welcome back, ${userData.firstName || "Learner"} ${userData.lastName || ""
                  }`}
              </h1>
              <p className="text-gray-400">
                {isSkillPathwayMode
                  ? `Track your stage progress and continue learning with AI-generated resources for Stage ${focusedCurrentStage?.stage_index || 1
                  }.`
                  : `Last active: ${userData.lastActive || "Today"}`}
              </p>
            </div>
            <div className="flex items-center mt-4 md:mt-0 space-x-2 bg-gray-700/50 px-4 py-2 rounded-lg">
              <IoFlameOutline className="text-orange-500 text-xl" />
              <span className="text-white font-medium">
                {isSkillPathwayMode
                  ? `${Number(focusedPathway?.current_streak || 0)} day skill test streak`
                  : `${analyticsData.learningStreak} day streak`}
              </span>
            </div>
          </div>

          {errorMessages.length > 0 && (
            <div className="mb-6 p-4 rounded-xl border border-red-700/50 bg-red-900/30">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <IoAlertCircleOutline className="text-red-300 text-xl mt-0.5" />
                  <div>
                    <h3 className="text-red-200 font-medium">
                      Some dashboard data could not be loaded
                    </h3>
                    <p className="text-red-100/90 text-sm mt-1">
                      {errorMessages.join(" • ")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={refreshDashboardData}
                  disabled={isRefreshing}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm"
                >
                  {isRefreshing ? "Retrying..." : "Retry"}
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-start space-x-2">
            <button
              onClick={() => setShowBadgeCollection(true)}
              className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors mt-6"
            >
              <IoGridOutline className="mr-2" />
              View Badge Collection
            </button>


          </div>

          {showBadgeCollection && (
            <BadgeCollection
              badges={badges}
              onClose={() => setShowBadgeCollection(false)}
            />
          )}

          <div className="mt-4 mb-8">
            <XPProgressBar
              currentXP={userXP.current}
              levelThreshold={userXP.levelThreshold}
              level={userXP.level}
            />
          </div>

          {/* Main Content Grid */}

          {/* Enrolled Pathways Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <IoGridOutline className="mr-2 text-indigo-400" />
              {isSkillPathwayMode
                ? "Focused Skill Pathway"
                : "My Enrolled Skill Pathways"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedPathways && displayedPathways.length > 0 ? (
                displayedPathways.map((pathway) => {
                  const stageProgress = Array.isArray(pathway.stage_progress)
                    ? pathway.stage_progress
                    : [];
                  const currentStage =
                    stageProgress.find((s) => s.status === "in-progress") ||
                    stageProgress[0] ||
                    null;
                  const totalStages =
                    Number(pathway?.pathway_details?.total_stages) ||
                    stageProgress.length ||
                    1;
                  const progressPct = Math.round(
                    (stageProgress.filter((s) => s.status === "completed").length /
                      totalStages) *
                    100
                  );
                  const pathwayDescription = String(
                    pathway?.pathway_details?.description || ""
                  );
                  const trimmedDescription =
                    pathwayDescription.length > 80
                      ? `${pathwayDescription.slice(0, 80)}...`
                      : pathwayDescription;

                  return (
                    <div key={pathway._id} className="bg-gray-700/50 rounded-xl p-5 border border-indigo-500/20 hover:border-indigo-400/40 transition-all cursor-pointer" onClick={() => navigate(`/skill-pathway/${pathway.pathway_id}`)}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-white mb-1">{pathway.pathway_details.title}</h3>
                          <p className="text-sm text-gray-400">{trimmedDescription}</p>
                        </div>
                        <div className="bg-indigo-900/50 px-3 py-1 rounded-full text-xs font-semibold text-indigo-300">
                          {progressPct}% Complete
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="w-full bg-gray-600 rounded-full h-1.5">
                          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full" style={{ width: `${progressPct}%` }}></div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-300"><span className="text-white font-medium">Current Phase:</span> Stage {currentStage?.stage_index || 1}</span>
                        <span className="text-gray-400">{currentStage?.status || "locked"}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-1 md:col-span-2 bg-gray-700/40 border border-dashed border-gray-600 p-6 rounded-xl text-center">
                  <p className="text-gray-400 mb-4">
                    {isSkillPathwayMode
                      ? "This pathway is not available for your account yet."
                      : "You haven't enrolled in any Skill Pathways yet."}
                  </p>
                  <button onClick={() => navigate('/skills')} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors inline-flex items-center">
                    <IoRocketOutline className="mr-2" /> Browse Skill Pathways
                  </button>
                </div>
              )}
            </div>
          </div>

          {isSkillPathwayMode && pathwayBlueprint && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                <IoLayersOutline className="mr-2 text-indigo-400" />
                Pathway Roadmap
              </h2>
              
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-600 before:to-transparent">
                {(isRoadmapExpanded ? pathwayBlueprint.stages : pathwayBlueprint.stages.slice(0, 3)).map((stage, i) => {
                  const stageState = focusedStageProgress.find(s => s.stage_index === stage.stage_index) || { status: "locked" };
                  const isCompleted = stageState.status === "completed";
                  const isActive = stageState.status === "in-progress";
                  const isLocked = stageState.status === "locked";

                  return (
                    <div key={stage.stage_index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 absolute left-0 md:left-1/2 -translate-x-1/2 md:translate-x-0 
                        ${isCompleted ? 'bg-emerald-500 border-gray-800 text-gray-900 text-xl font-bold' : 
                          isActive ? 'bg-indigo-500 border-gray-800 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 
                          'bg-gray-700 border-gray-800 text-gray-400'}`}>
                        {isCompleted ? <IoCheckmarkCircleOutline className="text-xl text-white" /> : stage.stage_index}
                      </div>

                      <div className={`w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-5 rounded-2xl border backdrop-blur-md transition-all
                        ${isActive ? 'bg-indigo-900/30 border-indigo-500/50 shadow-lg' : 
                          isCompleted ? 'bg-gray-800/60 border-emerald-500/20' : 
                          'bg-gray-800/40 border-gray-700/50 opacity-70'}`}>
                        <div className="flex justify-between items-center mb-2">
                          <h3 className={`text-lg font-bold ${isCompleted ? 'text-emerald-300' : isActive ? 'text-indigo-200' : 'text-gray-400'}`}>
                            {stage.title}
                          </h3>
                          <span className={`text-[10px] font-black tracking-wider uppercase px-2 py-1 rounded 
                            ${isCompleted ? 'bg-emerald-500/20 text-emerald-400' : 
                              isActive ? 'bg-indigo-500/30 text-indigo-300' : 
                              'bg-gray-700 text-gray-500'}`}>
                            {stageState.status}
                          </span>
                        </div>

                        {stage.topics && stage.topics.length > 0 && (
                          <div className="mt-3 mb-4 space-y-2">
                            {stage.topics.map((topic, idx) => (
                              <div key={idx}>
                                <h4 className="text-sm font-semibold text-gray-300 mb-1">{topic.name}</h4>
                                <div className="flex flex-wrap gap-1.5">
                                  {(topic.subtopics || []).map((subtopic, sIdx) => (
                                    <span key={sIdx} className="text-[11px] bg-gray-900/50 text-gray-400 px-2 py-0.5 rounded border border-gray-700/50">
                                      {subtopic}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {isActive && (
                          <div className="mt-4 pt-4 border-t border-indigo-500/20">
                            {stage.project_assessment_prompt && (
                              <div className="mb-4 bg-blue-900/20 border border-blue-500/20 rounded-lg p-3">
                                <p className="text-[10px] uppercase font-bold text-blue-400 mb-1">Project Objective</p>
                                <p className="text-xs text-blue-200/80">{stage.project_assessment_prompt}</p>
                              </div>
                            )}

                            <div className="flex flex-wrap gap-2">
                              {focusedResources.length === 0 ? (
                                <button
                                  onClick={handleGenerateFocusedResources}
                                  disabled={pathwayActionLoading || !focusedCurrentStage?.stage_index}
                                  className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                                >
                                  {pathwayActionLoading ? "Working..." : "Generate Resources"}
                                </button>
                              ) : (
                                <button
                                  onClick={handleOpenResourcesWorkspace}
                                  className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center"
                                >
                                  <IoPlayCircleOutline className="mr-1" /> Open Resources
                                </button>
                              )}

                              <button
                                onClick={() => handleCompleteStage(stage.stage_index)}
                                disabled={completingStage}
                                className="px-3 py-1.5 rounded border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 text-xs font-semibold"
                              >
                                {completingStage ? "Updating..." : "Mark Fully Complete"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {pathwayBlueprint.stages.length > 3 && (
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={() => setIsRoadmapExpanded(!isRoadmapExpanded)}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gray-800/80 text-gray-300 border border-gray-600/50 hover:bg-gray-700 hover:text-white transition-all shadow-lg text-sm font-medium z-10"
                  >
                    {isRoadmapExpanded ? "Show Less" : `Show ${pathwayBlueprint.stages.length - 3} More Stages`}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* First Column */}
            <div className="md:col-span-1 space-y-6">
              {/* Assessment Summary Card */}
              <div className="bg-gray-700/50 rounded-xl p-6 h-full">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                  <IoBarChartOutline className="mr-2 text-blue-400" />
                  {isSkillPathwayMode ? "Skill Assessment Summary" : "Assessment Summary"}
                </h2>

                {isSkillPathwayMode ? (
                  <div>
                    <div className="mb-4">
                      <p className="text-gray-300">
                        Current Stage:{" "}
                        <span className="text-blue-300 font-medium">
                          {focusedCurrentStage?.stage_index || 1}
                        </span>
                      </p>
                      <p className="text-gray-300 mt-2 text-sm">
                        {pathwayStageData?.quiz_prompt ||
                          "Stage assessments are generated from the pathway quiz prompt and your resource content."}
                      </p>
                    </div>
                    <p className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-sm text-blue-200">
                      Use Stage Workspace above for resource actions and assessments.
                    </p>
                  </div>
                ) : assessmentResults ? (
                  <div>
                    <div className="mb-4">
                      <p className="text-gray-300">
                        Level:{" "}
                        <span className="text-blue-400 font-medium capitalize">
                          {assessmentResults.assessed_level}
                        </span>
                      </p>
                      <p className="text-gray-300">
                        Score:{" "}
                        <span className="text-blue-400 font-medium">
                          {assessmentResults.score?.percentage?.toFixed(0)}%
                        </span>
                      </p>
                    </div>

                    <h3 className="font-medium text-white mb-2">
                      Focus Areas:
                    </h3>
                    <ul className="text-gray-300 space-y-1 mb-4">
                      {assessmentResults.skill_gaps?.areas?.map(
                        (area, index) => (
                          <li key={index} className="flex items-center">
                            <span
                              className={`h-2 w-2 rounded-full mr-2 ${area.level === "needs improvement"
                                  ? "bg-amber-400"
                                  : "bg-green-400"
                                }`}
                            ></span>
                            {area.skill}
                          </li>
                        )
                      )}
                    </ul>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={handleRetakeAssessment}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center justify-center"
                      >
                        Retake Assessment
                        <IoBarChartOutline className="ml-1" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-gray-400 mb-4">
                      You haven't completed an assessment yet.
                    </p>
                    <button
                      onClick={() => navigate("/assessment")}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Take Assessment
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Second Column - Learning Analytics */}
            <div className="md:col-span-2 space-y-6">
              {/* Weekly Progress Card */}
              <div className="bg-gray-700/50 rounded-xl p-6">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                  <IoCalendarOutline className="mr-2 text-purple-400" />
                  Weekly Login Activity
                </h2>
                <div className="h-36 flex items-end justify-between">
                  {loginActivity.map((activity, index) => (
                    <div
                      key={index}
                      className="flex flex-col items-center w-full"
                    >
                      <div className="relative w-full flex justify-center">
                        <div
                          className={`w-6 ${activity.count > 0
                              ? "bg-gradient-to-t from-purple-600 to-blue-500"
                              : "bg-gray-600/30"
                            } rounded-t-sm`}
                          style={{ height: `${activity.percentage}%` }}
                        ></div>
                        {activity.count > 0 && (
                          <div className="absolute -top-6 text-xs font-medium text-blue-300">
                            {activity.count}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-2">
                        {activity.day}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-400 mt-4 text-center">
                  Recent login: {userData.lastActive || "Today"}
                </div>
              </div>

              {/* Learning Stats Cards */}
              <div className="grid grid-cols-3 gap-4">
                {/* Hours Spent */}
                <div className="bg-gray-700/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-gray-300 text-sm">Hours Spent</h3>
                    <IoTimeOutline className="text-teal-400 text-xl" />
                  </div>
                  <p className="text-white text-2xl font-bold">
                    {analyticsData.totalLearningHours}
                  </p>
                </div>

                {/* Completed Modules */}
                <div className="bg-gray-700/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-gray-300 text-sm">Modules Done</h3>
                    <IoCheckmarkCircleOutline className="text-green-400 text-xl" />
                  </div>
                  <p className="text-white text-2xl font-bold">
                    {analyticsData.completedModules}
                  </p>
                </div>

                {/* Overall Progress */}
                <div className="bg-gray-700/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-gray-300 text-sm">Progress</h3>
                    <IoRocketOutline className="text-blue-400 text-xl" />
                  </div>
                  <div className="flex items-center">
                    <p className="text-white text-2xl font-bold">
                      {analyticsData.progressPercentage}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Add this after the Assessment Summary card if assessmentProgress data exists */}
          {analyticsData.assessmentProgress && (
            <div className="mt-6 bg-gray-700/50 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <IoRocketOutline className="mr-2 text-purple-400" />
                Assessment Progress
              </h2>

              <div className="space-y-4">
                {analyticsData.assessmentProgress.levelChange && (
                  <div className="bg-gray-800/50 p-4 rounded-lg">
                    <h3 className="text-white font-medium mb-2">
                      Level Improvement
                    </h3>
                    <div className="flex items-center space-x-3">
                      <div className="bg-gray-700/70 py-1 px-3 rounded-lg capitalize">
                        {
                          analyticsData.assessmentProgress.levelChange.split(
                            " → "
                          )[0]
                        }
                      </div>
                      <IoArrowForwardOutline className="text-purple-400" />
                      <div className="bg-purple-900/40 border border-purple-500/30 py-1 px-3 rounded-lg capitalize">
                        {
                          analyticsData.assessmentProgress.levelChange.split(
                            " → "
                          )[1]
                        }
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-gray-800/50 p-4 rounded-lg">
                  <h3 className="text-white font-medium mb-2">Score Change</h3>
                  <div
                    className={`text-xl font-bold ${analyticsData.assessmentProgress.scoreChange > 0
                        ? "text-green-400"
                        : analyticsData.assessmentProgress.scoreChange < 0
                          ? "text-red-400"
                          : "text-gray-300"
                      }`}
                  >
                    {analyticsData.assessmentProgress.scoreChange > 0 && "+"}
                    {analyticsData.assessmentProgress.scoreChange.toFixed(1)}%
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Since your last assessment on{" "}
                    {new Date(
                      analyticsData.assessmentProgress.timestamp
                    ).toLocaleDateString()}
                  </p>
                </div>

                {analyticsData.assessmentProgress.improvedAreas.length > 0 && (
                  <div className="bg-gray-800/50 p-4 rounded-lg">
                    <h3 className="text-white font-medium mb-2">
                      Improved Areas
                    </h3>
                    <ul className="space-y-1">
                      {analyticsData.assessmentProgress.improvedAreas.map(
                        (area, index) => (
                          <li key={index} className="flex items-center">
                            <span className="h-2 w-2 rounded-full bg-green-400 mr-2"></span>
                            {area}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Assessment History Chart */}
          {assessmentHistory.length > 1 && (
            <div className="mt-6 bg-gray-700/50 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <IoBarChartOutline className="mr-2 text-blue-400" />
                Assessment Progress Over Time
              </h2>

              <div className="w-full overflow-hidden">
                <AssessmentHistoryChart assessmentHistory={assessmentHistory} />
              </div>

              <div className="mt-4 text-center">
                <p className="text-sm text-gray-400">
                  {assessmentHistory.length} assessments taken
                  {assessmentHistory.length > 1 &&
                    ` · First assessment: ${new Date(
                      assessmentHistory[assessmentHistory.length - 1].timestamp
                    ).toLocaleDateString()}`}
                </p>
                {assessmentHistory.length >= 3 && (
                  <p className="text-sm text-gray-400 mt-1">
                    Average score:{" "}
                    {(
                      assessmentHistory.reduce(
                        (sum, a) => sum + a.score.percentage,
                        0
                      ) / assessmentHistory.length
                    ).toFixed(1)}
                    %
                  </p>
                )}
              </div>
            </div>
          )}

          {assessmentHistory.length >= 2 && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-700/50 rounded-xl p-6">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                  <IoRocketOutline className="mr-2 text-purple-400" />
                  Skill Comparison
                </h2>
                <div className="w-full overflow-hidden">
                  <SkillRadarChart assessments={assessmentHistory} />
                </div>
                <p className="text-xs text-gray-400 text-center mt-2">
                  Comparing your most recent two assessments
                </p>
              </div>

              {/* You could add another visualization or content card here */}
              <div className="bg-gray-700/50 rounded-xl p-6">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                  <IoBarChartOutline className="mr-2 text-green-400" />
                  Assessment Statistics
                </h2>

                <div className="space-y-4">
                  <div className="bg-gray-800/50 p-4 rounded-lg">
                    <h3 className="text-white font-medium mb-2">
                      Assessment Summary
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-400">
                          Total Assessments
                        </p>
                        <p className="text-xl text-white font-semibold">
                          {assessmentHistory.length}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Best Score</p>
                        <p className="text-xl text-green-400 font-semibold">
                          {Math.max(
                            ...assessmentHistory.map((a) => a.score.percentage)
                          ).toFixed(0)}
                          %
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">
                          Avg. Time Between
                        </p>
                        <p className="text-xl text-white font-semibold">
                          {assessmentHistory.length >= 3
                            ? Math.round(
                              (new Date(assessmentHistory[0].timestamp) -
                                new Date(
                                  assessmentHistory[
                                    assessmentHistory.length - 1
                                  ].timestamp
                                )) /
                              (1000 *
                                60 *
                                60 *
                                24 *
                                (assessmentHistory.length - 1))
                            ) + "d"
                            : "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Improvement</p>
                        <p
                          className={`text-xl font-semibold ${assessmentHistory[0].score.percentage >
                              assessmentHistory[assessmentHistory.length - 1]
                                .score.percentage
                              ? "text-green-400"
                              : "text-red-400"
                            }`}
                        >
                          {(
                            assessmentHistory[0].score.percentage -
                            assessmentHistory[assessmentHistory.length - 1]
                              .score.percentage
                          ).toFixed(1)}
                          %
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-800/50 p-4 rounded-lg">
                    <h3 className="text-white font-medium mb-3">
                      Level Distribution
                    </h3>
                    <div className="flex items-center space-x-2">
                      {["beginner", "intermediate", "advanced"].map((level) => {
                        const count = assessmentHistory.filter(
                          (a) => a.assessed_level === level
                        ).length;
                        const percentage =
                          (count / assessmentHistory.length) * 100;

                        return (
                          <div key={level} className="flex-1">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-400 capitalize">
                                {level}
                              </span>
                              <span className="text-gray-300">{count}</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${level === "beginner"
                                    ? "bg-green-500"
                                    : level === "intermediate"
                                      ? "bg-blue-500"
                                      : "bg-purple-500"
                                  }`}
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Removed Milestones, Achievements, and Generic Skills Blocks per User Request */}

          {newAchievement && (
            <AchievementNotification
              achievement={newAchievement}
              onClose={handleAchievementClose}
            />
          )}
        </div>
      </div>
    </section>
  );
};

export default Dashboard;
