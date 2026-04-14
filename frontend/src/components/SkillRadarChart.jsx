import React from 'react';
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const SkillRadarChart = ({ assessments }) => {
  if (!assessments || assessments.length < 2) {
    return <div className="text-center text-gray-400 py-8">Need at least two assessments for comparison</div>;
  }
  
  // Sort assessments by date (newest first)
  const sortedAssessments = [...assessments].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
  
  // Get latest two assessments
  const latest = sortedAssessments[0];
  const previous = sortedAssessments[1];
  
  // Extract skill areas from both assessments
  const allSkills = new Set();
  [...latest.skill_gaps.areas, ...previous.skill_gaps.areas].forEach(area => {
    allSkills.add(area.skill);
  });
  
  const skillLabels = Array.from(allSkills);
  
  // Create datasets for comparison
  // Map skill levels to numerical values: "needs improvement" = 40, "satisfactory" = 80
  const mapSkillLevel = (level) => level === "needs improvement" ? 40 : 80;
  
  // Get skill scores
  const latestData = skillLabels.map(skill => {
    const area = latest.skill_gaps.areas.find(a => a.skill === skill);
    return area ? mapSkillLevel(area.level) : 0;
  });
  
  const previousData = skillLabels.map(skill => {
    const area = previous.skill_gaps.areas.find(a => a.skill === skill);
    return area ? mapSkillLevel(area.level) : 0;
  });
  
  const data = {
    labels: skillLabels,
    datasets: [
      {
        label: 'Latest Assessment',
        data: latestData,
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        borderColor: 'rgba(99, 102, 241, 1)',
        pointBackgroundColor: 'rgba(99, 102, 241, 1)',
        pointBorderColor: '#fff',
        pointHoverRadius: 6,
      },
      {
        label: 'Previous Assessment',
        data: previousData,
        backgroundColor: 'rgba(156, 163, 175, 0.2)',
        borderColor: 'rgba(156, 163, 175, 1)',
        pointBackgroundColor: 'rgba(156, 163, 175, 1)',
        pointBorderColor: '#fff',
        pointHoverRadius: 6,
      }
    ]
  };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        angleLines: {
          color: 'rgba(156, 163, 175, 0.2)',
        },
        grid: {
          color: 'rgba(156, 163, 175, 0.2)',
        },
        pointLabels: {
          color: 'rgba(255, 255, 255, 0.7)',
          font: {
            size: 11
          }
        },
        ticks: {
          display: false,
          backdropColor: 'transparent',
        },
        min: 0,
        max: 100,
        beginAtZero: true
      }
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: 'rgba(255, 255, 255, 0.7)',
          boxWidth: 12,
          padding: 20,
          font: {
            size: 11
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        callbacks: {
          label: (context) => {
            const value = context.raw;
            const assessment = context.dataset.label.includes('Latest') ? 'Latest' : 'Previous';
            return `${assessment}: ${value >= 70 ? 'Satisfactory' : 'Needs Improvement'}`;
          }
        }
      }
    }
  };
  
  return (
    <div className="h-[250px] md:h-[300px] w-full">
      <Radar data={data} options={options} />
    </div>
  );
};

export default SkillRadarChart;