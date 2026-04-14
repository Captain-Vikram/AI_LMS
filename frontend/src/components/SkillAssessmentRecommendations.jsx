import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import IconsCarousel from "./IconsCarousel";
import DeepSearch from "./DeepSearch.jsx";
import { API_ENDPOINTS, apiUrl } from "../config/api";
import apiClient from "../services/apiClient";

// Import icons
import {
  IoPlayCircleOutline,
  IoArrowForward,
  IoHourglassOutline,
  IoSchoolOutline,
  IoChevronDown,
  IoChevronUp,
  IoRocketOutline,
  IoLogoYoutube,
  IoSearchOutline,
  IoSendOutline,
  IoChatbubblesOutline,
  IoCloseOutline,
  IoTimeOutline,
  IoInformationCircleOutline,
  IoHelpCircleOutline,
  IoCheckmarkCircleOutline,
  IoRefreshOutline,
  IoReaderOutline,
} from "react-icons/io5";

// Utility functions
const getVideoId = (url) => {
  if (!url || typeof url !== "string") return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

const convertTimeToSeconds = (timeString) => {
  if (!timeString) return 0;
  let seconds = 0;
  if (timeString.includes(":")) {
    const parts = timeString.split(":");
    if (parts.length === 3) {
      // HH:MM:SS format
      seconds =
        parseInt(parts[0]) * 3600 +
        parseInt(parts[1]) * 60 +
        parseInt(parts[2]);
    } else if (parts.length === 2) {
      // MM:SS format
      seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
  } else {
    seconds = parseInt(timeString);
  }
  return isNaN(seconds) ? 0 : seconds;
};

const normalizeYoutubeLink = (url) => {
  if (!url || typeof url !== "string") return "";
  const videoId = getVideoId(url);
  if (!videoId) return url;
  return `https://www.youtube.com/watch?v=${videoId}`;
};

const SkillAssessmentRecommendations = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [expandedSkill, setExpandedSkill] = useState(null);
  const [viewMode, setViewMode] = useState("videos"); // 'videos' or 'resources'
  const [activeQA, setActiveQA] = useState(null); // { videoId, videoTitle, videoUrl }
  const [question, setQuestion] = useState("");
  const [qaIsLoading, setQAIsLoading] = useState(false);
  const [qaError, setQAError] = useState(null);
  const [qaNotice, setQANotice] = useState(null);
  const [dependencyHealth, setDependencyHealth] = useState(null);
  // State for keeping the conversation history:
  const [chatHistory, setChatHistory] = useState([]);
  const [processingVideo, setProcessingVideo] = useState(false);
  const [processedVideos, setProcessedVideos] = useState({});
  const questionInputRef = useRef(null);
  // Ref for the Q&A modal video player (if needed)
  const [currentVideoPlayer, setCurrentVideoPlayer] = useState(null);
  // New ref for the main embedded video players (one per video)
  const videoPlayerRefs = useRef({});

  // States to cache comprehensive info per video and control dropdown visibility
  const [moreInfo, setMoreInfo] = useState({});
  const [moreInfoVisible, setMoreInfoVisible] = useState({});
  // To track if comprehensive info is being loaded
  const [loadingMoreInfo, setLoadingMoreInfo] = useState({});

  // Animation variants
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

  const itemVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    hover: { scale: 1.02 },
  };

  const qaModalVariants = {
    initial: { opacity: 0, scale: 0.95 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.3 },
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: { duration: 0.2 },
    },
  };

  useEffect(() => {
    const fetchYouTubeRecommendations = async () => {
      try {
        // Check if assessment has been completed
        const assessmentComplete = localStorage.getItem("skillAssessmentComplete");
        if (assessmentComplete !== "true") {
          navigate("/assessment");
          return;
        }
        // Get assessment results from localStorage or let backend fetch them
        const assessmentResults = JSON.parse(
          localStorage.getItem("skillAssessmentResults") || "{}"
        );
        let requestBody = {};
        let hasResults = false;
        if (assessmentResults && assessmentResults.skill_gaps) {
          requestBody = assessmentResults;
          hasResults = true;
        }
        const response = await fetch(
          apiUrl(API_ENDPOINTS.YOUTUBE_RECOMMENDATIONS),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: hasResults ? JSON.stringify(requestBody) : JSON.stringify({}),
          }
        );
        if (!response.ok) {
          throw new Error("Failed to fetch recommendations");
        }
        const data = await response.json();
        // Make sure all playlist items have valid YouTube links
        const processedData = data.map((skillPlaylist) => ({
          ...skillPlaylist,
          playlist: skillPlaylist.playlist.map((item) => ({
            ...item,
            youtube_link:
              item.youtube_link && typeof item.youtube_link === "string"
                ? item.youtube_link.trim()
                : `https://www.youtube.com/results?search_query=${encodeURIComponent(
                    item.concept + " tutorial"
                  )}`,
          })),
        }));
        setPlaylists(processedData);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching YouTube recommendations:", err);
        setError(err.message);
        setIsLoading(false);
      }
    };
    fetchYouTubeRecommendations();
  }, [navigate]);

  useEffect(() => {
    if (activeQA && questionInputRef.current) {
      setTimeout(() => {
        questionInputRef.current.focus();
      }, 300);
    }
  }, [activeQA]);

  useEffect(() => {
    const fetchDependencyHealth = async () => {
      try {
        const health = await apiClient.get(API_ENDPOINTS.SYSTEM_HEALTH_DEPENDENCIES);
        setDependencyHealth(health);
      } catch {
        setDependencyHealth(null);
      }
    };

    fetchDependencyHealth();
  }, []);

  const toggleSkill = (skillIndex) => {
    setExpandedSkill(expandedSkill === skillIndex ? null : skillIndex);
  };

  const handleContinue = () => {
    navigate("/dashboard");
  };

  const handleGiveTest = (youtubeLink) => {
    if (!youtubeLink || typeof youtubeLink !== "string") {
      setError("Invalid YouTube link for testing.");
      return;
    }
    navigate("/youtube-assesment", { state: { youtubeUrl: youtubeLink } });
  };

  const handleOpenQA = async (videoUrl, videoTitle) => {
    if (!videoUrl || typeof videoUrl !== "string") {
      setQAError("Invalid video URL. Please try a different video.");
      return;
    }
    const normalizedUrl = normalizeYoutubeLink(videoUrl);
    const videoId = getVideoId(normalizedUrl);
    if (!videoId) {
      setQAError("Invalid YouTube URL. Please provide a valid video link.");
      return;
    }
    setActiveQA({ videoId, videoTitle, videoUrl: normalizedUrl });
    setQuestion("");
    setQAError(null);
    setQANotice(null);
    // Reset chat history when starting a new QA session:
    setChatHistory([]);
    // Reset the current video player reference
    setCurrentVideoPlayer(null);
    if (!processedVideos[videoId]) {
      try {
        setProcessingVideo(true);
        const processResult = await apiClient.post(API_ENDPOINTS.YOUTUBE_QA_PROCESS, {
          video_url: normalizedUrl,
          languages: ["en"],
          force_refresh: false,
        });

        if (processResult?.dependency_status) {
          setDependencyHealth(processResult.dependency_status);
        }

        setProcessedVideos((prev) => ({ ...prev, [videoId]: true }));
      } catch (err) {
        console.error("Error processing video:", err);

        if (err?.payload?.detail?.dependency_status) {
          setDependencyHealth(err.payload.detail.dependency_status);
        }

        setQAError(err.message || "Failed to prepare video for questions. Please try again.");
      } finally {
        setProcessingVideo(false);
      }
    }
  };

  const handleCloseQA = () => {
    setActiveQA(null);
    setQuestion("");
    setQAError(null);
    setQANotice(null);
    setChatHistory([]);
  };

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!question.trim() || !activeQA?.videoUrl) return;
    try {
      setQAIsLoading(true);
      setQAError(null);
      setQANotice(null);

      const result = await apiClient.post(API_ENDPOINTS.YOUTUBE_QA_ASK, {
        video_url: activeQA.videoUrl,
        question: question,
        languages: ["en"],
        top_k: 3,
      });

      if (result?.dependency_status) {
        setDependencyHealth(result.dependency_status);
      }

      if (result?.fallback) {
        setQANotice(
          result.fallback_message ||
            "Resilience mode active: AI model unavailable, showing transcript-only guidance."
        );
      }

      // Append this Q&A pair to the chat history
      setChatHistory((prevHistory) => [
        ...prevHistory,
        { question: question, answer: result },
      ]);
      setQuestion("");
    } catch (err) {
      console.error("Error asking question:", err);

      if (err?.payload?.detail?.dependency_status) {
        setDependencyHealth(err.payload.detail.dependency_status);
      }

      setQAError(err.message || "Failed to get answer. Please try again.");
    } finally {
      setQAIsLoading(false);
    }
  };

  const handleMoreInfo = async (youtubeLink) => {
    // If we've already fetched data for this video, simply toggle visibility.
    if (moreInfo[youtubeLink]) {
      setMoreInfoVisible((prev) => ({
        ...prev,
        [youtubeLink]: !prev[youtubeLink],
      }));
      return;
    }
    try {
      // Set loading state for this specific video
      setLoadingMoreInfo((prev) => ({
        ...prev,
        [youtubeLink]: true,
      }));
      // Make sure the YouTube link is valid
      if (!youtubeLink || typeof youtubeLink !== "string") {
        throw new Error("Invalid YouTube link");
      }
      const videoId = getVideoId(youtubeLink);
      if (!videoId) {
        throw new Error("Could not extract video ID from URL");
      }
      const normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;
      console.log("Fetching comprehensive info for:", normalizedUrl);
      const response = await fetch(apiUrl(API_ENDPOINTS.YOUTUBE_QUIZ_COMPREHENSIVE), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          video_url: normalizedUrl,
          num_questions: 5,
          difficulty: "intermediate",
          languages: ["en"],
        }),
      });
      if (!response.ok) {
        // Handle 422 errors specifically
        if (response.status === 422) {
          // Create fallback data
          const fallbackData = {
            summary:
              "Summary could not be loaded. The video may not have proper transcripts or the server is unable to process this video.",
            core_topics: [
              {
                topic: "Video Content",
                start_time: "00:00",
                end_time: "End",
                description: "Watch the full video to learn more about this topic.",
              },
            ],
          };
          setMoreInfo((prev) => ({
            ...prev,
            [youtubeLink]: fallbackData,
          }));
          setMoreInfoVisible((prev) => ({
            ...prev,
            [youtubeLink]: true,
          }));
          throw new Error("Could not fetch comprehensive information for this video");
        }
        throw new Error("Failed to fetch additional video info");
      }
      const data = await response.json();
      setMoreInfo((prev) => ({
        ...prev,
        [youtubeLink]: data,
      }));
      setMoreInfoVisible((prev) => ({
        ...prev,
        [youtubeLink]: true,
      }));
    } catch (error) {
      console.error("Error fetching more info:", error);
      // Add error message to the moreInfo state so we can display it
      setMoreInfo((prev) => ({
        ...prev,
        [youtubeLink]: {
          error: error.message,
          summary:
            "Unable to load video information. Please try another video.",
          core_topics: [],
        },
      }));
      setMoreInfoVisible((prev) => ({
        ...prev,
        [youtubeLink]: true,
      }));
    } finally {
      setLoadingMoreInfo((prev) => ({
        ...prev,
        [youtubeLink]: false,
      }));
    }
  };

  const formatTimestamp = (seconds) => {
    if (typeof seconds !== "number") return "00:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // New function to control the main embedded player
  const jumpToTimestampMain = (videoId, seconds) => {
    const player = videoPlayerRefs.current[videoId];
    if (!player || !player.contentWindow) return;
    if (typeof seconds === "string" && seconds.includes(":")) {
      seconds = convertTimeToSeconds(seconds);
    }
    player.contentWindow.postMessage(
      JSON.stringify({
        event: "command",
        func: "seekTo",
        args: [Math.floor(seconds), true],
      }),
      "*"
    );
  };

  const lmStudioDown = dependencyHealth?.dependencies?.lmstudio?.status === "down";
  const mongoDown = dependencyHealth?.dependencies?.mongodb?.status === "down";
  const cloudFallbackUp = dependencyHealth?.dependencies?.cloud_llm_fallback?.status === "up";
  const cloudFallbackDown = dependencyHealth?.dependencies?.cloud_llm_fallback?.status === "down";
  const systemDegraded = dependencyHealth?.status && dependencyHealth.status !== "healthy";

  if (isLoading) {
    return (
      <section className="relative min-h-screen flex items-center justify-center px-4 py-12 pt-28">
        <div className="absolute inset-0 overflow-hidden">
          <IconsCarousel backgroundColor="rgba(17, 24, 39, 0.8)" iconColor="gray-500/30" />
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90" />
        </div>
        <div className="w-full max-w-3xl relative z-10 bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-8 shadow-xl">
          <div className="flex flex-col items-center justify-center">
            <IoHourglassOutline className="animate-pulse text-blue-500 text-5xl mb-4" />
            <h3 className="text-xl font-medium text-white mb-2">
              Generating personalized learning path...
            </h3>
            <p className="text-gray-300 text-center">
              We're curating videos based on your assessment results.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="relative min-h-screen flex items-center justify-center px-4 py-12 pt-28">
        <div className="absolute inset-0 overflow-hidden">
          <IconsCarousel backgroundColor="rgba(17, 24, 39, 0.8)" iconColor="gray-500/30" />
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90" />
        </div>
        <div className="w-full max-w-3xl relative z-10 bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-8 shadow-xl">
          <div className="flex flex-col items-center justify-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h3 className="text-xl font-medium text-white mb-2">Something went wrong</h3>
            <p className="text-gray-300 text-center mb-6">{error}</p>
            <button
              onClick={() => navigate("/dashboard")}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (viewMode === "resources") {
    return (
      <>
        <div className="fixed top-0 left-0 right-0 z-20 bg-gray-900/80 backdrop-blur-sm p-4 flex justify-center pt-28 pb-6">
          <div className="bg-gray-800/80 rounded-lg p-1 flex">
            <button
              className="px-4 py-2 rounded-md flex items-center text-gray-300 hover:text-white"
              onClick={() => setViewMode("videos")}
            >
              <IoLogoYoutube className="mr-2" />
              Video Tutorials
            </button>
            <button
              className="px-4 py-2 rounded-md flex items-center bg-purple-600 text-white"
              onClick={() => setViewMode("resources")}
            >
              <IoSearchOutline className="mr-2" />
              Deep Resources
            </button>
          </div>
        </div>
        <DeepSearch />
      </>
    );
  }

  return (
    <section className="relative -h-screen px-4 py-12 pt-28">
      <div className="absolute inset-0 overflow-hidden">
        <IconsCarousel backgroundColor="rgba(17, 24, 39, 0.8)" iconColor="gray-500/30" />
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90" />
      </div>
      <motion.div className="w-full max-w-5xl mx-auto relative z-10" variants={containerVariants} initial="initial" animate="animate">
        <div className="bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-8 shadow-xl">
          <div className="text-center mb-8">
            <IoSchoolOutline className="mx-auto text-blue-500 text-5xl mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Your Personalized Learning Path</h2>
            <p className="text-gray-300 max-w-2xl mx-auto">
              Based on your assessment, we've created custom resources to help you learn and improve.
            </p>
          </div>

          {/* Resource Type Toggle */}
          <div className="flex justify-center mb-8">
            <div className="bg-gray-700/50 rounded-lg p-1 flex">
              <button
                className="px-4 py-2 rounded-md flex items-center bg-blue-600 text-white"
                onClick={() => setViewMode("videos")}
              >
                <IoLogoYoutube className="mr-2" />
                Video Tutorials
              </button>
              <button
                className="px-4 py-2 rounded-md flex items-center text-gray-300 hover:text-white"
                onClick={() => setViewMode("resources")}
              >
                <IoSearchOutline className="mr-2" />
                Deep Resources
              </button>
            </div>
          </div>

          {/* YouTube Recommendations */}
          <div className="space-y-6 mb-8">
            {playlists.length > 0 ? (
              playlists.map((skillPlaylist, skillIndex) => (
                <motion.div
                  key={skillIndex}
                  className="border border-gray-700 rounded-xl overflow-hidden"
                  variants={itemVariants}
                  whileHover={{ scale: 1.01 }}
                >
                  <div
                    className="bg-gray-700/50 p-4 flex justify-between items-center cursor-pointer"
                    onClick={() => toggleSkill(skillIndex)}
                  >
                    <div className="flex items-center">
                      <IoRocketOutline className="text-blue-400 text-xl mr-3" />
                      <div>
                        <h3 className="text-lg font-medium text-white">{skillPlaylist.skill}</h3>
                        <p className="text-sm text-gray-400">{skillPlaylist.playlist.length} concepts to master</p>
                      </div>
                    </div>
                    {expandedSkill === skillIndex ? (
                      <IoChevronUp className="text-blue-400 text-xl" />
                    ) : (
                      <IoChevronDown className="text-blue-400 text-xl" />
                    )}
                  </div>
                  {expandedSkill === skillIndex && (
                    <div className="p-4 space-y-4 bg-gray-800/70">
                      {skillPlaylist.playlist.map((item, index) => {
                        const videoId = getVideoId(item.youtube_link);
                        return (
                          <motion.div
                            key={index}
                            className="border border-gray-600/50 rounded-lg overflow-hidden"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <div className="p-3 bg-gray-700/30 border-b border-gray-600/50">
                              <h4 className="font-medium text-white">{item.concept}</h4>
                            </div>
                            {videoId ? (
                              <>
                                <div className="aspect-video w-full">
                                  <iframe
                                    ref={(el) => {
                                      if (videoId) videoPlayerRefs.current[videoId] = el;
                                    }}
                                    width="100%"
                                    height="100%"
                                    src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`}
                                    title={item.concept}
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    loading="lazy"
                                  ></iframe>
                                </div>
                                <div className="flex justify-center p-2 space-x-2 flex-wrap">
                                  <button
                                    onClick={() => handleGiveTest(item.youtube_link)}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors m-1"
                                  >
                                    Give Test
                                  </button>
                                  <button
                                    onClick={() => handleOpenQA(item.youtube_link, item.concept)}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors flex items-center m-1"
                                  >
                                    <IoChatbubblesOutline className="mr-2" />
                                    Ask AI
                                  </button>
                                  <button
                                    onClick={() => handleMoreInfo(item.youtube_link)}
                                    className={`px-4 py-2 ${
                                      loadingMoreInfo[item.youtube_link]
                                        ? "bg-blue-500"
                                        : "bg-blue-600 hover:bg-blue-700"
                                    } text-white rounded-md transition-colors m-1 flex items-center`}
                                    disabled={loadingMoreInfo[item.youtube_link]}
                                  >
                                    {loadingMoreInfo[item.youtube_link] ? (
                                      <>
                                        <div className="w-4 h-4 border-2 border-t-white border-white/20 rounded-full animate-spin mr-2"></div>
                                        Loading...
                                      </>
                                    ) : (
                                      "See More Info"
                                    )}
                                  </button>
                                </div>
                                {moreInfoVisible[item.youtube_link] &&
                                  moreInfo[item.youtube_link] && (
                                    <div className="p-4 bg-gray-700 rounded-b-lg">
                                      {moreInfo[item.youtube_link].error ? (
                                        <div className="text-yellow-300 p-2 mb-2 bg-yellow-900/30 border border-yellow-800 rounded">
                                          {moreInfo[item.youtube_link].error}
                                        </div>
                                      ) : null}
                                      <h4 className="text-white font-semibold mb-2">Video Summary</h4>
                                      <p className="text-gray-300">{moreInfo[item.youtube_link].summary}</p>
                                      {moreInfo[item.youtube_link].core_topics &&
                                        moreInfo[item.youtube_link].core_topics.length > 0 && (
                                          <>
                                            <h5 className="text-white font-semibold mt-4">Core Topics</h5>
                                            {moreInfo[item.youtube_link].core_topics.map((topic, idx) => (
                                              <div key={idx} className="border border-gray-600 p-2 mt-2 rounded">
                                                <div className="flex justify-between flex-wrap">
                                                  <span className="text-white font-medium">
                                                    {topic.topic}
                                                  </span>
                                                  <button
                                                    onClick={() => {
                                                      const vid = getVideoId(item.youtube_link);
                                                      if (vid) {
                                                        jumpToTimestampMain(vid, topic.start_time);
                                                      }
                                                    }}
                                                    className="text-gray-400 hover:text-blue-400 bg-gray-700/50 px-2 py-1 rounded"
                                                  >
                                                    <span className="flex items-center">
                                                      <IoTimeOutline className="mr-1" />
                                                      {topic.start_time} - {topic.end_time || "End"}
                                                    </span>
                                                  </button>
                                                </div>
                                                <p className="text-gray-300">{topic.description}</p>
                                              </div>
                                            ))}
                                          </>
                                        )}
                                    </div>
                                  )}
                              </>
                            ) : (
                              <>
                                <div className="p-4 text-center bg-gray-700/10">
                                  <a
                                    href={item.youtube_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors"
                                  >
                                    <IoLogoYoutube className="mr-2" />
                                    Watch on YouTube
                                  </a>
                                </div>
                                <div className="flex justify-center p-2 space-x-2 flex-wrap">
                                  <button
                                    onClick={() => handleGiveTest(item.youtube_link)}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors m-1"
                                  >
                                    Give Test
                                  </button>
                                  <button
                                    onClick={() => handleOpenQA(item.youtube_link, item.concept)}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors flex items-center m-1"
                                  >
                                    <IoChatbubblesOutline className="mr-2" />
                                    Ask AI
                                  </button>
                                  <button
                                    onClick={() => handleMoreInfo(item.youtube_link)}
                                    className={`px-4 py-2 ${
                                      loadingMoreInfo[item.youtube_link]
                                        ? "bg-blue-500"
                                        : "bg-blue-600 hover:bg-blue-700"
                                    } text-white rounded-md transition-colors m-1 flex items-center`}
                                    disabled={loadingMoreInfo[item.youtube_link]}
                                  >
                                    {loadingMoreInfo[item.youtube_link] ? (
                                      <>
                                        <div className="w-4 h-4 border-2 border-t-white border-white/20 rounded-full animate-spin mr-2"></div>
                                        Loading...
                                      </>
                                    ) : (
                                      "See More Info"
                                    )}
                                  </button>
                                </div>
                                {moreInfoVisible[item.youtube_link] &&
                                  moreInfo[item.youtube_link] && (
                                    <div className="p-4 bg-gray-700 rounded-b-lg">
                                      {moreInfo[item.youtube_link].error ? (
                                        <div className="text-yellow-300 p-2 mb-2 bg-yellow-900/30 border border-yellow-800 rounded">
                                          {moreInfo[item.youtube_link].error}
                                        </div>
                                      ) : null}
                                      <h4 className="text-white font-semibold mb-2">Video Summary</h4>
                                      <p className="text-gray-300">{moreInfo[item.youtube_link].summary}</p>
                                      {moreInfo[item.youtube_link].core_topics &&
                                        moreInfo[item.youtube_link].core_topics.length > 0 && (
                                          <>
                                            <h5 className="text-white font-semibold mt-4">Core Topics</h5>
                                            {moreInfo[item.youtube_link].core_topics.map((topic, idx) => (
                                              <div key={idx} className="border border-gray-600 p-2 mt-2 rounded">
                                                <div className="flex justify-between flex-wrap">
                                                  <span className="text-white font-medium">
                                                    {topic.topic}
                                                  </span>
                                                  <span className="text-gray-400">
                                                    {topic.start_time} - {topic.end_time || "End"}
                                                  </span>
                                                </div>
                                                <p className="text-gray-300">{topic.description}</p>
                                              </div>
                                            ))}
                                          </>
                                        )}
                                    </div>
                                  )}
                              </>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              ))
            ) : (
              <div className="text-center p-8 border border-dashed border-gray-600 rounded-xl">
                <p className="text-gray-400">
                  No learning recommendations available. Please retake the assessment.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <button
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center"
              onClick={handleContinue}
            >
              Continue to Dashboard
              <IoArrowForward className="ml-2" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* YouTube Q&A Modal */}
      <AnimatePresence>
        {activeQA && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10 overflow-y-auto">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              className="w-full max-w-3xl bg-gray-800 border border-gray-700 rounded-xl shadow-2xl relative z-10 my-0"
              variants={qaModalVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gray-900 p-4 border-b border-gray-700 flex justify-between items-center sticky top-0 z-10">
                <h3 className="text-lg font-medium text-white flex items-center">
                  <IoHelpCircleOutline className="text-purple-400 mr-2" />
                  Ask About: {activeQA.videoTitle}
                </h3>
                <button onClick={handleCloseQA} className="text-gray-400 hover:text-white transition-colors">
                  <IoCloseOutline className="text-2xl" />
                </button>
              </div>
              <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                {activeQA && (
                  <div className="aspect-video w-full mb-4 bg-black">
                    <iframe
                      ref={(el) => setCurrentVideoPlayer(el)}
                      width="100%"
                      height="100%"
                      src={`https://www.youtube.com/embed/${activeQA.videoId}?enablejsapi=1`}
                      title={activeQA.videoTitle}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                )}
                {processingVideo && (
                  <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4 flex items-center mb-4">
                    <div className="w-5 h-5 border-2 border-t-blue-500 border-blue-500/20 rounded-full animate-spin mr-3" />
                    <p className="text-blue-300">
                      Preparing video for questions... This may take a minute.
                    </p>
                  </div>
                )}
                {systemDegraded && (
                  <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4 mb-4">
                    <p className="text-yellow-300 font-medium">Resilience mode is active.</p>
                    {lmStudioDown && cloudFallbackUp && (
                      <p className="text-yellow-200 text-sm mt-1">
                        LM Studio appears offline. Cloud AI fallback is active, so answers should continue.
                      </p>
                    )}
                    {lmStudioDown && !cloudFallbackUp && (
                      <p className="text-yellow-200 text-sm mt-1">
                        LM Studio appears offline. Chat will return transcript-only fallback answers.
                      </p>
                    )}
                    {cloudFallbackDown && (
                      <p className="text-yellow-200 text-sm mt-1">
                        Cloud fallback is enabled but not configured. Add fallback API credentials to improve reliability.
                      </p>
                    )}
                    {mongoDown && (
                      <p className="text-yellow-200 text-sm mt-1">
                        MongoDB appears unavailable. Some account-backed features may fail temporarily.
                      </p>
                    )}
                  </div>
                )}
                {qaNotice && (
                  <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4 mb-4">
                    <p className="text-yellow-200">{qaNotice}</p>
                  </div>
                )}
                {qaError && (
                  <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4 mb-4">
                    <p className="text-red-300">{qaError}</p>
                  </div>
                )}
                <form onSubmit={handleAskQuestion} className="mb-6">
                  <div className="relative">
                    <input
                      ref={questionInputRef}
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Ask a question about this video..."
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg py-3 pl-4 pr-12 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      disabled={qaIsLoading || processingVideo}
                    />
                    <button
                      type="submit"
                      className={`absolute right-2 top-1/2 transform -translate-y-1/2 text-lg p-1 rounded-full ${
                        qaIsLoading || processingVideo || !question.trim()
                          ? "text-gray-500 cursor-not-allowed"
                          : "text-purple-500 hover:bg-purple-500/20"
                      }`}
                      disabled={qaIsLoading || processingVideo || !question.trim()}
                    >
                      {qaIsLoading ? (
                        <div className="w-5 h-5 border-2 border-t-purple-500 border-purple-500/20 rounded-full animate-spin" />
                      ) : (
                        <IoSendOutline />
                      )}
                    </button>
                  </div>
                </form>
                <div className="p-4">
                  {chatHistory.length > 0 ? (
                    chatHistory.map((chat, idx) => (
                      <div key={idx} className="mb-4">
                        <div className="text-purple-300">
                          <strong>Q:</strong> {chat.question}
                        </div>
                        <div className="text-gray-200 whitespace-pre-line">
                          <strong>A:</strong> {chat.answer.answer}
                        </div>
                        {chat.answer.fallback && (
                          <div className="mt-2 text-yellow-300 text-xs bg-yellow-900/30 border border-yellow-700/50 rounded px-2 py-1 inline-flex">
                            Fallback response (transcript-only mode)
                          </div>
                        )}
                        {chat.answer.sources && chat.answer.sources.length > 0 && (
                          <div className="mt-2 border-t border-gray-600 pt-2">
                            <h4 className="text-gray-300 text-sm font-medium flex items-center">
                              <IoInformationCircleOutline className="mr-1 text-blue-400" />
                              Relevant parts of the video:
                            </h4>
                            <div className="space-y-2">
                              {chat.answer.sources.map((source, idx2) => (
                                <div
                                  key={idx2}
                                  className="bg-gray-800 p-2 rounded-lg border border-gray-600 text-sm hover:border-gray-500 transition-colors"
                                >
                                  <div className="flex flex-wrap justify-between items-center mb-1">
                                    <button
                                      onClick={() => jumpToTimestampMain(activeQA.videoId, source.start_seconds)}
                                      className="flex items-center text-purple-400 hover:text-purple-300 bg-purple-900/20 px-2 py-1 rounded-md transition-colors"
                                    >
                                      <IoTimeOutline className="mr-1 text-lg" />
                                      {formatTimestamp(source.start_seconds || 0)}
                                      {source.end_seconds ? ` - ${formatTimestamp(source.end_seconds)}` : ""}
                                    </button>
                                    <span className="text-gray-400 text-xs bg-gray-700/50 px-2 py-1 rounded-md mt-1 sm:mt-0">
                                      {source.score && `Relevance: ${Math.round(source.score * 100)}%`}
                                    </span>
                                  </div>
                                  {source.text ? (
                                    <p className="text-gray-300">{source.text}</p>
                                  ) : (
                                    <p className="text-gray-400 italic text-xs flex items-center">
                                      <IoHelpCircleOutline className="mr-1 text-purple-400" />
                                      Jump to this section to see relevant content
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <IoReaderOutline className="mx-auto text-4xl text-gray-500 mb-3" />
                      <p className="text-gray-400">
                        Ask a question about the video content and AI will find relevant answers with timestamps.
                      </p>
                      <div className="mt-4 flex flex-col gap-2 text-left max-w-md mx-auto text-sm text-gray-400">
                        <p>Example questions you can ask:</p>
                        <button
                          onClick={() => setQuestion("What are the main concepts covered in this video?")}
                          className="text-left p-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg border border-gray-600"
                        >
                          What are the main concepts covered in this video?
                        </button>
                        <button
                          onClick={() =>
                            setQuestion("Can you explain how [topic] works based on this video?")
                          }
                          className="text-left p-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg border border-gray-600"
                        >
                          Can you explain how [topic] works based on this video?
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default SkillAssessmentRecommendations;
