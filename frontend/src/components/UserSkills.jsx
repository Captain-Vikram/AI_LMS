import { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';
import { API_ENDPOINTS } from '../config/api';

const UserSkills = ({ skills, isLoading: parentLoading, error: parentError }) => {
  // Local state for when skills aren't passed as props
  const [userSkills, setUserSkills] = useState([]);
  const [isLoading, setIsLoading] = useState(parentLoading !== undefined ? parentLoading : true);
  const [error, setError] = useState(parentError);

  useEffect(() => {
    // If skills are provided through props, use them
    if (skills) {
      return;
    }

    const fetchUserSkills = async () => {
      try {
        setIsLoading(true);
        const data = await apiClient.get(API_ENDPOINTS.ONBOARDING_USER_SKILLS);
        setUserSkills(data);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching user skills:', error);
        setError(error.message);
        setIsLoading(false);
      }
    };
    
    fetchUserSkills();
  }, [skills]);
  
  // Determine which skill data to use
  const displaySkills = skills || userSkills;
  
  if (isLoading) {
    return <div className="p-4 text-gray-400">Loading skills...</div>;
  }
  
  if (error) {
    return <div className="p-4 text-red-400">Error: {error}</div>;
  }
  
  if (!displaySkills || displaySkills.length === 0) {
    return <div className="p-4 text-gray-400">No skills found. Complete onboarding to add skills.</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-white">Your Priority Skills</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displaySkills.map(skill => (
          <div 
            key={skill._id}
            className="p-4 bg-gray-800 border border-gray-700 rounded-lg"
          >
            <div className="flex justify-between items-center">
              <h4 className="font-medium text-white capitalize">
                {skill.skill_id.replace('_', ' ')}
              </h4>
              <span className={`text-xs px-2 py-1 rounded-full ${
                skill.status === 'completed' ? 'bg-green-900/50 text-green-300' : 
                'bg-blue-900/50 text-blue-300'
              }`}>
                {skill.status || 'In Progress'}
              </span>
            </div>
            
            <div className="mt-3">
              <div className="flex items-center mb-1">
                <span className="text-xs text-gray-400 mr-auto">Proficiency</span>
                <span className="text-xs font-medium text-white">{skill.proficiency || 0}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div 
                  className="bg-blue-600 h-1.5 rounded-full" 
                  style={{ width: `${skill.proficiency || 0}%` }}
                ></div>
              </div>
            </div>
            
            <p className="text-xs text-gray-400 mt-3">
              Experience level: {skill.experience_level || 'beginner'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserSkills;