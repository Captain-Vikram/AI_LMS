import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const AssessmentHistoryChart = ({ assessmentHistory }) => {
  if (!assessmentHistory || assessmentHistory.length === 0) {
    return <div className="text-center text-gray-400 py-8">No assessment history available</div>;
  }

  // Sort assessments by date (oldest to newest for timeline visualization)
  const sortedAssessments = [...assessmentHistory].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

  // Prepare data for the chart
  const labels = sortedAssessments.map(assessment => {
    const date = new Date(assessment.timestamp);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  });

  const scores = sortedAssessments.map(assessment => assessment.score.percentage);
  const levels = sortedAssessments.map(assessment => assessment.assessed_level);

  // Create a color mapping for different levels
  const levelColors = {
    beginner: 'rgba(74, 222, 128, 0.8)',  // green
    intermediate: 'rgba(59, 130, 246, 0.8)', // blue
    advanced: 'rgba(139, 92, 246, 0.8)'   // purple
  };

  // Map each assessment to its color
  const pointBackgroundColors = sortedAssessments.map(
    assessment => levelColors[assessment.assessed_level] || 'rgba(156, 163, 175, 0.8)'
  );

  const data = {
    labels,
    datasets: [
      {
        label: 'Assessment Score',
        data: scores,
        borderColor: 'rgba(99, 102, 241, 0.8)',
        backgroundColor: pointBackgroundColors,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
        tension: 0.4,
        fill: {
          target: 'origin',
          above: 'rgba(99, 102, 241, 0.1)',
        },
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(107, 114, 128, 0.5)',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          title: (tooltipItems) => `Assessment on ${tooltipItems[0].label}`,
          label: (tooltipItem) => {
            const index = tooltipItem.dataIndex;
            return [
              `Score: ${scores[index].toFixed(1)}%`,
              `Level: ${levels[index].charAt(0).toUpperCase() + levels[index].slice(1)}`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(107, 114, 128, 0.2)',
        },
        ticks: {
          color: 'rgba(156, 163, 175, 0.8)',
          font: {
            size: 11
          }
        }
      },
      y: {
        grid: {
          color: 'rgba(107, 114, 128, 0.2)',
        },
        ticks: {
          color: 'rgba(156, 163, 175, 0.8)',
          callback: (value) => `${value}%`,
          font: {
            size: 11
          }
        },
        min: 0,
        max: 100,
        beginAtZero: true
      }
    }
  };

  return (
    <div className="h-[300px] md:h-[350px] w-full">
      <Line data={data} options={options} />
      
      {/* Level legend */}
      <div className="flex justify-center mt-4 space-x-4">
        {Object.entries(levelColors).map(([level, color]) => (
          <div key={level} className="flex items-center">
            <span 
              className="w-3 h-3 rounded-full mr-2" 
              style={{ backgroundColor: color }}
            ></span>
            <span className="text-xs text-gray-300 capitalize">{level}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AssessmentHistoryChart;