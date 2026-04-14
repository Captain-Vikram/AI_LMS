import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoCheckmarkCircleOutline, IoRocketOutline } from 'react-icons/io5';
import apiClient from '../../services/apiClient';
import { API_ENDPOINTS } from '../../config/api';

const OnboardingComplete = ({ userData, onComplete, pageVariants }) => {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const navigate = useNavigate();

  // Career path display names
  const careerPathNames = {
    software_development: 'Software Development',
    data_science: 'Data Science',
    cybersecurity: 'Cybersecurity',
    ux_design: 'UX Design',
    product_management: 'Product Management',
    digital_marketing: 'Digital Marketing',
  };

  // Learning style display names
  const learningStyleNames = {
    visual: 'Visual',
    auditory: 'Auditory',
    reading: 'Reading/Writing',
    kinesthetic: 'Hands-on',
    mixed: 'Mixed',
  };

  // Sample recommendations based on career path
  const generateRecommendations = () => {
    const careerPath = userData.careerPath;
    const experienceLevel = userData.experienceLevel;
    
    const recommends = {
      software_development: {
        beginner: [
          { id: 1, title: 'Introduction to Programming', type: 'course' },
          { id: 2, title: 'HTML, CSS & JavaScript Fundamentals', type: 'course' },
          { id: 3, title: 'Git Basics', type: 'tutorial' },
        ],
        intermediate: [
          { id: 1, title: 'Advanced JavaScript Patterns', type: 'course' },
          { id: 2, title: 'Frontend Frameworks Deep Dive', type: 'course' },
          { id: 3, title: 'API Development', type: 'workshop' },
        ],
        advanced: [
          { id: 1, title: 'System Design Mastery', type: 'course' },
          { id: 2, title: 'Cloud Architecture', type: 'certification' },
          { id: 3, title: 'Performance Optimization', type: 'workshop' },
        ]
      },
      data_science: {
        beginner: [
          { id: 1, title: 'Python for Data Science', type: 'course' },
          { id: 2, title: 'Statistics Fundamentals', type: 'course' },
          { id: 3, title: 'Data Visualization Basics', type: 'workshop' },
        ],
        intermediate: [
          { id: 1, title: 'Machine Learning Algorithms', type: 'course' },
          { id: 2, title: 'SQL for Data Analysis', type: 'workshop' },
          { id: 3, title: 'Feature Engineering Techniques', type: 'tutorial' },
        ],
        advanced: [
          { id: 1, title: 'Deep Learning Specialization', type: 'certification' },
          { id: 2, title: 'Big Data Processing with Spark', type: 'course' },
          { id: 3, title: 'MLOps & Deployment', type: 'workshop' },
        ]
      },
      cybersecurity: {
        beginner: [
          { id: 1, title: 'Fundamentals of Network Security', type: 'course' },
          { id: 2, title: 'Introduction to Cryptography', type: 'course' },
          { id: 3, title: 'Security Awareness Training', type: 'workshop' },
        ],
        intermediate: [
          { id: 1, title: 'Ethical Hacking Techniques', type: 'course' },
          { id: 2, title: 'Incident Response Fundamentals', type: 'workshop' },
          { id: 3, title: 'Security Tools & Software', type: 'tutorial' },
        ],
        advanced: [
          { id: 1, title: 'Advanced Penetration Testing', type: 'certification' },
          { id: 2, title: 'Threat Hunting & Intelligence', type: 'workshop' },
          { id: 3, title: 'Security Architecture Design', type: 'course' },
        ]
      },
      ux_design: {
        beginner: [
          { id: 1, title: 'Introduction to UX Design Principles', type: 'course' },
          { id: 2, title: 'UI Fundamentals & Color Theory', type: 'workshop' },
          { id: 3, title: 'User Research Methods', type: 'tutorial' },
        ],
        intermediate: [
          { id: 1, title: 'Information Architecture', type: 'course' },
          { id: 2, title: 'Prototyping & Wireframing', type: 'workshop' },
          { id: 3, title: 'Usability Testing', type: 'tutorial' },
        ],
        advanced: [
          { id: 1, title: 'UX Strategy & Leadership', type: 'certification' },
          { id: 2, title: 'Design Systems Development', type: 'workshop' },
          { id: 3, title: 'Accessibility & Inclusive Design', type: 'course' },
        ]
      },
      product_management: {
        beginner: [
          { id: 1, title: 'Introduction to Product Management', type: 'course' },
          { id: 2, title: 'User Story Mapping', type: 'workshop' },
          { id: 3, title: 'Agile & Scrum Basics', type: 'tutorial' },
        ],
        intermediate: [
          { id: 1, title: 'Product Strategy & Roadmapping', type: 'course' },
          { id: 2, title: 'Metrics & Analytics for PMs', type: 'workshop' },
          { id: 3, title: 'A/B Testing & Experimentation', type: 'tutorial' },
        ],
        advanced: [
          { id: 1, title: 'Product Leadership', type: 'certification' },
          { id: 2, title: 'Enterprise Product Management', type: 'workshop' },
          { id: 3, title: 'Product Growth & Monetization', type: 'course' },
        ]
      },
      digital_marketing: {
        beginner: [
          { id: 1, title: 'Digital Marketing Fundamentals', type: 'course' },
          { id: 2, title: 'Content Marketing Basics', type: 'workshop' },
          { id: 3, title: 'Social Media Marketing', type: 'tutorial' },
        ],
        intermediate: [
          { id: 1, title: 'SEO & SEM Strategies', type: 'course' },
          { id: 2, title: 'Email Marketing Automation', type: 'workshop' },
          { id: 3, title: 'Digital Analytics', type: 'tutorial' },
        ],
        advanced: [
          { id: 1, title: 'Omnichannel Marketing Strategy', type: 'certification' },
          { id: 2, title: 'Marketing Attribution Modeling', type: 'workshop' },
          { id: 3, title: 'CRO & Growth Marketing', type: 'course' },
        ]
      }
    };
    
    return recommends[careerPath]?.[experienceLevel] || [];
  };

  // Simulate loading recommendations
  useEffect(() => {
    setLoading(true);
    // Simulate API call to get personalized recommendations
    const timer = setTimeout(() => {
      setRecommendations(generateRecommendations());
      setLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [userData]);

  // Animation variants for recommendations
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: i => ({ 
      opacity: 1, 
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.5
      }
    })
  };

  // Function to handle the start learning button click
// In OnboardingComplete.jsx
const handleStartLearning = async () => {
  localStorage.setItem('onboardingData', JSON.stringify(userData));
  localStorage.setItem('onboardingComplete', 'true');
  
  try {
      await apiClient.post(API_ENDPOINTS.AUTH_UPDATE_ONBOARDING_STATUS, {
        onboarding_complete: true,
      });
    
    // Call the onComplete callback if provided
    if (onComplete) {
      onComplete();
    }
    
    // Navigate to assessment
    navigate('/assessment');
  } catch (error) {
    console.error('Failed to update onboarding status:', error);
    // Still navigate even if the backend update fails
    navigate('/assessment');
  }
};

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-6"
    >
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
          <IoCheckmarkCircleOutline className="text-green-400 text-4xl" />
        </div>
        <h2 className="text-xl font-bold text-white">Onboarding Complete!</h2>
        <p className="text-gray-400 mt-1">
          We've personalized your learning experience based on your preferences
        </p>
      </div>

      {/* Summary of user choices */}
      <div className="bg-gray-700/40 rounded-lg p-4 border border-gray-600/50">
        <h3 className="text-white font-medium mb-3">Your Learning Profile</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-gray-400 text-xs">Primary Goal</p>
            <p className="text-white text-sm font-medium">{userData.primaryGoal || 'Not specified'}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Learning Style</p>
            <p className="text-white text-sm font-medium">
              {userData.preferredStyle ? learningStyleNames[userData.preferredStyle] : 'Not specified'}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Career Path</p>
            <p className="text-white text-sm font-medium">
              {userData.careerPath ? careerPathNames[userData.careerPath] : 'Not specified'}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Experience Level</p>
            <p className="text-white text-sm font-medium capitalize">
              {userData.experienceLevel || 'Not specified'}
            </p>
          </div>
        </div>
      </div>

      {/* Personalized recommendations */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-medium">Recommended to Start With</h3>
          {loading && <div className="text-xs text-blue-400">Loading...</div>}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-gray-700/40 animate-pulse h-16 rounded-lg"></div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {recommendations && recommendations.map((item, i) => (
              <motion.div
                key={item.id}
                custom={i}
                initial="hidden"
                animate="visible"
                variants={itemVariants}
                className="bg-gray-700/40 border border-gray-600/50 p-3 rounded-lg flex items-center justify-between"
              >
                <div>
                  <h4 className="text-white text-sm font-medium">{item.title}</h4>
                  <p className="text-gray-400 text-xs capitalize">{item.type}</p>
                </div>
                <div className="bg-blue-500/20 text-blue-400 rounded-full p-1.5">
                  <IoRocketOutline className="text-lg" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation button */}
      <div className="pt-4">
        <button
          type="button"
          onClick={handleStartLearning}
          disabled={loading}
          className="w-full py-3 px-5 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white rounded-lg transition-colors flex items-center justify-center"
        >
          <span>Continue to Skill Assessment</span>
          <IoRocketOutline className="ml-2" />
        </button>
      </div>
    </motion.div>
  );
};

export default OnboardingComplete;