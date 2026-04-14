import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import IconsCarousel from './IconsCarousel';
import apiClient from '../services/apiClient';
import { API_ENDPOINTS } from '../config/api';
import { 
  IoHourglassOutline, 
  IoArrowForward,
  IoCheckmarkCircleOutline
} from 'react-icons/io5';

// Helper function to normalize the YouTube URL if it comes as an array-like string
const normalizeYoutubeLink = (link) => {
  if (link.startsWith('[') && link.endsWith(']')) {
    let cleaned = link.slice(1, -1).replace(/['"]/g, "");
    return cleaned.split(',')[0].trim();
  }
  return link;
};

const YoutubeAssessment = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // States for quiz progress and results
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState([]);
  const [quizId, setQuizId] = useState('');
  const [assessmentComplete, setAssessmentComplete] = useState(false);
  const [assessmentResults, setAssessmentResults] = useState(null);
  const [quizData, setQuizData] = useState({ quiz_id: '', questions: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Animation variants for container and items
  const containerVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5, staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    hover: { scale: 1.02 }
  };

  // Fetch quiz data on component mount using the YouTube URL from location state
  useEffect(() => {
    const fetchQuiz = async () => {
      const youtubeUrlRaw = location.state?.youtubeUrl;
      if (!youtubeUrlRaw) {
        setError("No YouTube URL provided.");
        setIsLoading(false);
        return;
      }
      const youtubeUrl = normalizeYoutubeLink(youtubeUrlRaw);
      try {
        const data = await apiClient.post(API_ENDPOINTS.YOUTUBE_QUIZ_GENERATE, {
          video_url: youtubeUrl,
          num_questions: 5,
          difficulty: "intermediate",
          languages: ["en"],
        });

        setQuizId(data.quiz_id);
        setQuizData(data);
        setIsLoading(false);
      } catch (err) {
        setError(err.message);
        setIsLoading(false);
      }
    };

    fetchQuiz();
  }, [location.state]);

  // Handle answer selection for current question
  const handleAnswerSelect = (index) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestionIndex] = index;
    setSelectedAnswers(newAnswers);
  };

  // Submit quiz answers to the backend
  const submitQuiz = async () => {
    setIsLoading(true);
    try {
      const results = await apiClient.post(API_ENDPOINTS.YOUTUBE_QUIZ_SUBMIT, {
        quiz_id: quizId,
        user_answers: selectedAnswers,
      });

      setAssessmentResults(results);
      setAssessmentComplete(true);
      localStorage.setItem('youtubeAssessmentResults', JSON.stringify(results));
      setIsLoading(false);
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  // Navigation for quiz questions
  const handleNextQuestion = () => {
    if (currentQuestionIndex < quizData.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      submitQuiz();
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  // Continue to Dashboard after results
  const handleContinue = () => {
    navigate('/dashboard');
  };

  // Render loading state
  if (isLoading) {
    return (
      <section className="relative min-h-screen flex items-center justify-center px-4 py-12 pt-28">
        <div className="absolute inset-0 overflow-hidden">
          <IconsCarousel backgroundColor="rgba(17, 24, 39, 0.8)" iconColor="gray-500/30" />
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90" />
        </div>
        <div className="w-full max-w-2xl relative z-10 bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-8 shadow-xl">
          <div className="flex flex-col items-center justify-center">
            <IoHourglassOutline className="animate-pulse text-blue-500 text-5xl mb-4" />
            <h3 className="text-xl font-medium text-white mb-2">Generating YouTube quiz...</h3>
            <p className="text-gray-300 text-center">Please wait while we create your test.</p>
          </div>
        </div>
      </section>
    );
  }

  // Render error state
  if (error) {
    return (
      <section className="relative min-h-screen flex items-center justify-center px-4 py-12 pt-28">
        <div className="absolute inset-0 overflow-hidden">
          <IconsCarousel backgroundColor="rgba(17, 24, 39, 0.8)" iconColor="gray-500/30" />
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90" />
        </div>
        <div className="w-full max-w-2xl relative z-10 bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-8 shadow-xl">
          <div className="flex flex-col items-center justify-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h3 className="text-xl font-medium text-white mb-2">Something went wrong</h3>
            <p className="text-gray-300 text-center mb-6">{error}</p>
            <button 
              onClick={() => navigate(-1)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Render the results screen (only score, solutions, and explanations)
  if (assessmentComplete) {
    const { score, question_feedback } = assessmentResults;
    return (
      <section className="relative min-h-screen flex items-center justify-center px-4 py-12 pt-28">
        <div className="absolute inset-0 overflow-hidden">
          <IconsCarousel backgroundColor="rgba(17, 24, 39, 0.8)" iconColor="gray-500/30" />
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90" />
        </div>
        <motion.div className="w-full max-w-2xl relative z-10" variants={containerVariants} initial="initial" animate="animate">
          <div className="bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-8 shadow-xl text-center">
            <IoCheckmarkCircleOutline className="mx-auto text-green-500 text-5xl mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Quiz Submitted!</h2>
            <div className="mb-6 p-4 bg-gray-700/50 rounded-xl">
              <h3 className="text-lg font-medium text-white mb-2">Your Score</h3>
              <div className="w-full bg-gray-600 rounded-full h-2.5 mb-2">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full" 
                  style={{ width: `${score.percentage}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-400">
                {score.correct} out of {score.total} correct ( {score.percentage.toFixed(0)}% )
              </p>
            </div>
            <div className="mb-6">
              <h3 className="text-lg font-medium text-white mb-3">Solutions & Explanations</h3>
              <div className="space-y-3">
                {question_feedback.map((feedback, index) => (
                  <div key={index} className="p-3 bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-300">
                      <strong>Question {feedback.question_index + 1}:</strong> {feedback.explanation}
                    </p>
                    <p className="text-sm text-gray-300 font-bold italic p-3">
                      {feedback.is_correct ? 'Your answer is correct.' : 'Your answer is incorrect.'} (Correct answer: Option {feedback.correct_answer + 1})
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className='flex items-center justify-center'>
            <button 
              onClick={handleContinue} 
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center"
            >
              Continue to Dashboard
              <IoArrowForward className="ml-2" />
            </button>
            </div>
          </div>
        </motion.div>
      </section>
    );
  }

  // Render the quiz in-progress UI
  const currentQuestion = quizData.questions[currentQuestionIndex];
  const isAnswerSelected = selectedAnswers[currentQuestionIndex] !== undefined;
  const progress = ((currentQuestionIndex + 1) / quizData.questions.length) * 100;

  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 py-12 pt-28">
      <div className="absolute inset-0 overflow-hidden">
        <IconsCarousel backgroundColor="rgba(17, 24, 39, 0.8)" iconColor="gray-500/30" />
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90" />
      </div>
      <motion.div className="w-full max-w-2xl relative z-10" variants={containerVariants} initial="initial" animate="animate">
        <div className="bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-6 shadow-xl">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-bold text-white">YouTube Video Quiz</h2>
              <span className="text-sm font-medium text-gray-300">
                Question {currentQuestionIndex + 1} of {quizData.questions.length}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
          {currentQuestion && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-white mb-4">{currentQuestion.question}</h3>
              <div className="space-y-3">
                {currentQuestion.options.map((option, idx) => (
                  <motion.div
                    key={idx}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedAnswers[currentQuestionIndex] === idx 
                        ? 'bg-blue-900/50 border-blue-500/70' 
                        : 'bg-gray-700/50 border-gray-600/50 hover:bg-gray-700'
                    }`}
                    onClick={() => handleAnswerSelect(idx)}
                    variants={itemVariants}
                    whileHover={{ scale: 1.01 }}
                  >
                    <div className="flex items-start">
                      <div className={`h-5 w-5 rounded-full border mr-3 mt-0.5 flex items-center justify-center ${
                        selectedAnswers[currentQuestionIndex] === idx 
                          ? 'border-blue-500 bg-blue-500' 
                          : 'border-gray-500'
                      }`}>
                        {selectedAnswers[currentQuestionIndex] === idx && (
                          <div className="h-2 w-2 bg-white rounded-full"></div>
                        )}
                      </div>
                      <span className="text-gray-200">{option}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-between">
            <button
              onClick={handlePreviousQuestion}
              disabled={currentQuestionIndex === 0}
              className={`px-4 py-2 rounded-lg ${
                currentQuestionIndex === 0 
                  ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed' 
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
            >
              Previous
            </button>
            <button
              onClick={handleNextQuestion}
              disabled={!isAnswerSelected}
              className={`px-6 py-2 rounded-lg flex items-center ${
                isAnswerSelected 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
              }`}
            >
              {currentQuestionIndex < quizData.questions.length - 1 ? 'Next' : 'Submit'}
              {isAnswerSelected && <IoArrowForward className="ml-2" />}
            </button>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default YoutubeAssessment;
