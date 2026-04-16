import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../UI/Card';

export const DashboardCard = ({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  color = 'blue',
  onClick 
}) => {
  const colorMap = {
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    green: 'bg-green-500/10 text-green-500 border-green-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  };

  return (
    <Card 
      className={`border ${colorMap[color]} cursor-pointer hover:shadow-lg transition-shadow`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-400">{title}</CardTitle>
          {Icon && <Icon className="w-5 h-5" />}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <p className={`text-xs mt-2 ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% from last week
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export const ClassroomStats = ({ 
  studentCount, 
  assignmentCount, 
  moduleCount,
  completionRate 
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <DashboardCard 
        title="Total Students" 
        value={studentCount} 
        color="blue"
      />
      <DashboardCard 
        title="Assignments" 
        value={assignmentCount} 
        color="purple"
      />
      <DashboardCard 
        title="Modules" 
        value={moduleCount} 
        color="green"
      />
      <DashboardCard 
        title="Completion Rate" 
        value={`${completionRate}%`} 
        color="orange"
      />
    </div>
  );
};

export const StudentProgressCard = ({ 
  studentName, 
  score, 
  completed, 
  total,
  onClick 
}) => {
  const percentage = (completed / total) * 100;

  return (
    <div 
      className="p-4 rounded-lg bg-gray-800/50 border border-gray-700 hover:border-blue-500 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-100">{studentName}</h4>
        <span className="text-sm font-semibold text-blue-400">{score}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
        <div 
          className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-gray-400">{completed}/{total} assignments completed</p>
    </div>
  );
};

export const LoadingState = ({ message = 'Loading...' }) => {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="text-gray-400">{message}</p>
      </div>
    </div>
  );
};

export const ErrorState = ({ message = 'An error occurred', onRetry }) => {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="text-red-400 mb-3 text-4xl">⚠️</div>
        <p className="text-gray-400 mb-4">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
};

export const EmptyState = ({ message = 'No data available', icon: Icon }) => {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        {Icon && <Icon className="w-12 h-12 text-gray-600 mx-auto mb-3" />}
        <p className="text-gray-400">{message}</p>
      </div>
    </div>
  );
};
