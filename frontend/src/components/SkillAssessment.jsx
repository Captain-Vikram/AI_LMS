import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import IconsCarousel from './IconsCarousel';
import apiClient from '../services/apiClient';
import { API_ENDPOINTS } from '../config/api';

// Import icons
import { 
  IoCheckmarkCircleOutline, 
  IoArrowForward, 
  IoHourglassOutline, 
  IoSchoolOutline,
  IoBarChartOutline,
  IoRocketOutline
} from 'react-icons/io5';

const SkillAssesment = () => {
  const navigate = useNavigate();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState([]);
  const [quizId, setQuizId] = useState('');
  const [assessmentComplete, setAssessmentComplete] = useState(false);
  const [assessmentResults, setAssessmentResults] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isReassessment, setIsReassessment] = useState(false);
  const [previousAssessmentInfo, setPreviousAssessmentInfo] = useState(null);

  // Check if user is logged in and if assessment has been completed
  useEffect(() => {
    const initializeAssessment = async () => {
      const token = localStorage.getItem('token');

      if (!token) {
        navigate('/login');
        return;
      }

      const reassessmentInfo = localStorage.getItem('reassessmentInfo');

      try {
        const status = await apiClient.get(API_ENDPOINTS.AUTH_USER_STATUS);

        if (!status.onboarding_complete && !reassessmentInfo) {
          navigate('/onboarding');
          return;
        }

        if (status.assessment_complete && !reassessmentInfo) {
          navigate('/dashboard');
          return;
        }
      } catch {
        navigate('/login');
        return;
      }

      if (reassessmentInfo) {
        try {
          const parsedInfo = JSON.parse(reassessmentInfo);
          setIsReassessment(true);
          setPreviousAssessmentInfo(parsedInfo);

          const onboardingData = JSON.parse(localStorage.getItem('onboardingData') || '{}');
          fetchQuiz(onboardingData);
          return;
        } catch (error) {
          console.error('Error processing reassessment data:', error);
        }
      }

      try {
        const onboardingData = JSON.parse(localStorage.getItem('onboardingData') || '{}');
        if (!onboardingData || Object.keys(onboardingData).length === 0) {
          navigate('/onboarding');
          return;
        }

        fetchQuiz(onboardingData);
      } catch (error) {
        console.error('Error checking onboarding data:', error);
        navigate('/onboarding');
      }
    };

    initializeAssessment();
  }, [navigate]);

  // Fetch quiz questions from API
  const fetchQuiz = async (onboardingData) => {
    setIsLoading(true);
    try {
      // Prepare the request body with defaults if some data is missing
      const requestBody = {
        primary_goal: onboardingData.primaryGoal || "Career Development",
        selected_skills: onboardingData.prioritySkills || ['programming'],
        time_commitment: onboardingData.timeCommitment || "Moderate (4-7 hours)",
        career_path: onboardingData.careerPath || "Software Development",
        experience_level: onboardingData.experienceLevel || 'intermediate',
        num_questions: 10
      };
      
      // If this is a reassessment, adjust the difficulty based on previous results
      if (isReassessment && previousAssessmentInfo) {
        // Adjust the experience level based on previous assessment
        const prevLevel = previousAssessmentInfo.previousLevel;
        const prevScore = previousAssessmentInfo.previousScore;
        
        // If they scored high in their level, increase difficulty
        if (prevScore > 75) {
          if (prevLevel === 'beginner') requestBody.experience_level = 'intermediate';
          else if (prevLevel === 'intermediate') requestBody.experience_level = 'advanced';
        }
        // If they scored low, decrease difficulty or keep at beginner
        else if (prevScore < 40) {
          if (prevLevel === 'advanced') requestBody.experience_level = 'intermediate';
          else if (prevLevel === 'intermediate') requestBody.experience_level = 'beginner';
        } else {
          // Use their previous level if score was average
          requestBody.experience_level = prevLevel;
        }
        
        // Mark as reassessment so backend can adapt questions accordingly
        requestBody.is_reassessment = true;
      }
      
      const data = await apiClient.post(API_ENDPOINTS.QUIZ_GENERATE, requestBody);
      setQuizId(data.quiz_id);
      setQuizData(data);
      setIsLoading(false);
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  // State to hold quiz data
  const [quizData, setQuizData] = useState({
    quiz_id: '',
    questions: []
  });

// Submit quiz answers
const submitQuiz = async () => {
  setIsLoading(true);
  try {
    // Submit the quiz answers
    const results = await apiClient.post(API_ENDPOINTS.QUIZ_SUBMIT, {
      quiz_id: quizId,
      user_answers: selectedAnswers,
    });
    
    // Update the user's assessment status in the database
    try {
      await apiClient.post(API_ENDPOINTS.AUTH_UPDATE_ASSESSMENT_STATUS, {
        assessment_complete: true,
      });
    } catch {
      console.error('Failed to update assessment status on server');
    }
    
    // Update local state
    setAssessmentResults(results);
    setAssessmentComplete(true);
    
    // Mark assessment as complete
    localStorage.setItem('skillAssessmentComplete', 'true');
    localStorage.setItem('skillAssessmentResults', JSON.stringify(results));
    
    // NOW clear the reassessment info after the quiz is successfully submitted
    localStorage.removeItem('reassessmentInfo');
    
    setIsLoading(false);
  } catch (err) {
    setError(err.message);
    setIsLoading(false);
  }
};

  // Handle answer selection
  const handleAnswerSelect = (answerIndex) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestionIndex] = answerIndex;
    setSelectedAnswers(newAnswers);
  };

  // Move to next question
  const handleNextQuestion = () => {
    if (currentQuestionIndex < quizData.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      submitQuiz();
    }
  };

  // Move to previous question
  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  // Handle completion and navigate to dashboard
  const handleComplete = () => {
    // Make sure reassessment info is cleared
    localStorage.removeItem('reassessmentInfo');
    
    // Navigate to recommendations
    navigate('/recommendations');
  };

  // Animation variants
  const containerVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.5,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    hover: { scale: 1.02 }
  };

  // Loading state
  if (isLoading) {
    return (
      <section className="relative min-h-screen flex items-center justify-center px-4 py-12 pt-28">
        {/* Background Icon Carousel */}
        <div className="absolute inset-0 overflow-hidden">
          <IconsCarousel backgroundColor="rgba(17, 24, 39, 0.8)" iconColor="gray-500/30" />
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90" />
        </div>
        
        <div className="w-full max-w-2xl relative z-10 bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-8 shadow-xl">
          <div className="flex flex-col items-center justify-center">
            <IoHourglassOutline className="animate-pulse text-blue-500 text-5xl mb-4" />
            <h3 className="text-xl font-medium text-white mb-2">Preparing your skill assessment...</h3>
            <p className="text-gray-300 text-center">We're customizing questions based on your profile.</p>
          </div>
        </div>
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section className="relative min-h-screen flex items-center justify-center px-4 py-12 pt-28">
        {/* Background Icon Carousel */}
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
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Results screen
  if (assessmentComplete) {
    const { score, assessed_level, skill_gaps, recommendations } = assessmentResults;
    
    return (
      <section className="relative min-h-screen flex items-center justify-center px-4 py-12 pt-28">
        {/* Background Icon Carousel */}
        <div className="absolute inset-0 overflow-hidden">
          <IconsCarousel backgroundColor="rgba(17, 24, 39, 0.8)" iconColor="gray-500/30" />
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90" />
        </div>
        
        <motion.div 
          className="w-full max-w-2xl relative z-10"
          variants={containerVariants}
          initial="initial"
          animate="animate"
        >
          <div className="bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-8 shadow-xl">
            <div className="text-center mb-6">
              <IoCheckmarkCircleOutline className="mx-auto text-green-500 text-5xl mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">
                {isReassessment ? "Reassessment Complete!" : "Assessment Complete!"}
              </h2>
              <p className="text-gray-300">
                {isReassessment 
                  ? "Great job improving your skills! Here's your updated level."
                  : "Great job! Here's an overview of your current skill level."}
              </p>
            </div>
            
            {/* Show improvement if this is a reassessment and we have previous data */}
            {isReassessment && previousAssessmentInfo && (
              <div className="mb-6 p-4 bg-blue-900/30 border border-blue-800/50 rounded-xl">
                <h3 className="text-lg font-medium text-white mb-2">Your Progress</h3>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-300">Previous Level:</p>
                    <p className="text-md font-medium capitalize text-white">
                      {previousAssessmentInfo.previousLevel}
                    </p>
                  </div>
                  <div className="text-2xl text-blue-400">→</div>
                  <div>
                    <p className="text-sm text-gray-300">Current Level:</p>
                    <p className="text-md font-medium capitalize text-white">
                      {assessed_level}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-sm text-gray-300">Score Change:</p>
                  <p className={`text-md font-medium ${
                    score.percentage > previousAssessmentInfo.previousScore 
                      ? "text-green-400" 
                      : score.percentage < previousAssessmentInfo.previousScore 
                        ? "text-red-400" 
                        : "text-gray-300"
                  }`}>
                    {previousAssessmentInfo.previousScore.toFixed(0)}% → {score.percentage.toFixed(0)}%
                    {score.percentage > previousAssessmentInfo.previousScore && " (+)"}
                  </p>
                </div>
              </div>
            )}
            
            {/* Rest of the result display */}
            <div className="mb-8 p-4 bg-gray-700/50 rounded-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-white">Your Score</h3>
                <span className="text-2xl font-bold text-blue-400">{score.percentage.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-2.5 mb-1">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full" 
                  style={{ width: `${score.percentage}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-400 text-right">{score.correct} out of {score.total} correct</p>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium text-white mb-4">Skill Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <motion.div 
                  className="p-4 bg-gray-700/50 rounded-xl"
                  variants={itemVariants}
                  whileHover="hover"
                >
                  <div className="flex items-center mb-2">
                    <IoBarChartOutline className="text-purple-400 text-xl mr-2" />
                    <h4 className="text-white">Current Level</h4>
                  </div>
                  <p className="text-2xl font-bold capitalize text-purple-300">{assessed_level}</p>
                  <p className="text-sm text-gray-400 mt-1">Based on your quiz performance</p>
                </motion.div>
                
                <motion.div 
                  className="p-4 bg-gray-700/50 rounded-xl"
                  variants={itemVariants}
                  whileHover="hover"
                >
                  <div className="flex items-center mb-2">
                    <IoRocketOutline className="text-blue-400 text-xl mr-2" />
                    <h4 className="text-white">Focus Areas</h4>
                  </div>
                  <ul className="text-gray-300">
                    {skill_gaps?.areas?.map((area, index) => (
                      <li key={index} className="flex items-center mb-1">
                        <span className={`h-2 w-2 rounded-full mr-2 ${area.level === 'needs improvement' ? 'bg-amber-400' : 'bg-green-400'}`}></span>
                        {area.skill}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </div>
            </div>
            
            <div className="mb-8">
              <h3 className="text-lg font-medium text-white mb-3">Recommendations</h3>
              <div className="space-y-3">
                {recommendations.map((rec, index) => (
                  <motion.div 
                    key={index}
                    className="p-3 bg-blue-900/30 border border-blue-800/50 rounded-lg flex items-start"
                    variants={itemVariants}
                    whileHover="hover"
                  >
                    <IoSchoolOutline className="text-blue-400 text-xl mt-0.5 mr-3" />
                    <div>
                      <p className="font-medium text-white">{rec.title}</p>
                      <p className="text-sm text-blue-300">{rec.type}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
            
            <div className="text-center">
              <button 
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                onClick={handleComplete}
              >
                View Learning Recommendations
              </button>
            </div>
          </div>
        </motion.div>
      </section>
    );
  }

  // Assessment in progress
  const currentQuestion = quizData.questions[currentQuestionIndex];
  const isAnswerSelected = selectedAnswers[currentQuestionIndex] !== undefined;
  const progress = ((currentQuestionIndex + 1) / quizData.questions.length) * 100;
  
  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 py-12 pt-28">
      {/* Background Icon Carousel */}
      <div className="absolute inset-0 overflow-hidden">
        <IconsCarousel backgroundColor="rgba(17, 24, 39, 0.8)" iconColor="gray-500/30" />
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90" />
      </div>
      
      <motion.div 
        className="w-full max-w-2xl relative z-10"
        variants={containerVariants}
        initial="initial"
        animate="animate"
      >
        <div className="bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-6 shadow-xl">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center">
                <h2 className="text-xl font-bold text-white">Skill Assessment</h2>
                {isReassessment && (
                  <span className="ml-2 px-2 py-1 bg-purple-900/50 border border-purple-500/30 text-xs text-purple-300 rounded-full">
                    Reassessment
                  </span>
                )}
              </div>
              <span className="text-sm font-medium text-gray-300">
                Question {currentQuestionIndex + 1} of {quizData.questions.length}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            
            {isReassessment && previousAssessmentInfo && (
              <div className="mt-3 p-2 bg-gray-700/50 rounded-lg text-xs text-gray-300">
                Previous level: <span className="text-blue-400 capitalize">{previousAssessmentInfo.previousLevel}</span> | 
                Previous score: <span className="text-blue-400">{previousAssessmentInfo.previousScore.toFixed(0)}%</span>
              </div>
            )}
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
              {isAnswerSelected && (
                <IoArrowForward className="ml-2" />
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default SkillAssesment;