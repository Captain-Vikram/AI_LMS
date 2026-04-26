import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight, FiBook, FiLoader, FiUser, FiUsers } from 'react-icons/fi';
import { API_ENDPOINTS } from '../../config/api';

const ClassroomCard = ({ classroom, role }) => {
  const navigate = useNavigate();
  const [isOpening, setIsOpening] = React.useState(false);
  const isTeacher = role === 'teacher';
  const cardColors = isTeacher
    ? 'from-gray-800/60 to-gray-900/50 hover:border-blue-500/70'
    : 'from-gray-800/60 to-gray-900/50 hover:border-emerald-500/70';
  const classroomId = classroom.classroom_id || classroom._id;
  
  const iconBgColor = isTeacher ? 'bg-blue-500/10' : 'bg-emerald-500/10';
  const iconColor = isTeacher ? 'text-blue-400' : 'text-emerald-400';

  const handleOpenClassroom = () => {
    if (!classroomId) {
      return;
    }
    navigate(`/classroom/${classroomId}/dashboard`);
  };

  return (
    <button
      type="button"
      onClick={handleOpenClassroom}
      className={`group block w-full text-left rounded-2xl bg-gradient-to-br p-5 transition-all duration-300 border border-gray-700/80 shadow-lg hover:shadow-2xl hover:-translate-y-1 ${cardColors}`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors duration-300">{classroom.name}</h3>
          <p className="text-gray-400 flex items-center gap-2 text-sm">
            <FiBook />
            <span>{classroom.subject}</span>
            {classroom.grade_level && <span>• {classroom.grade_level}</span>}
          </p>
        </div>
        <div className={`p-3 rounded-full ${iconBgColor} ${iconColor} transition-all duration-300 group-hover:scale-110`}>
          {isTeacher ? <FiUser size={20} /> : <FiUsers size={20} />}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end text-sm text-cyan-400 group-hover:text-white transition-colors duration-300">
        Open Classroom
        <FiArrowRight className="ml-2 transform transition-transform duration-300 group-hover:translate-x-1" />
      </div>
    </button>
  );
};

export default ClassroomCard;
