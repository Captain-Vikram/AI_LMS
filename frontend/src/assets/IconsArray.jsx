import React from 'react';

// Graduation Cap
export const GraduationIcon = () => (
  <svg key="graduation" viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
    <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
  </svg>
);

// Chart / Analytics
export const ChartIcon = () => (
  <svg key="chart" viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 20V10M12 20V4M6 20v-6"></path>
  </svg>
);

// Certificate
export const CertificateIcon = () => (
  <svg key="certificate" viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="9" y1="9" x2="15" y2="9"></line>
    <line x1="9" y1="12" x2="15" y2="12"></line>
    <line x1="9" y1="15" x2="13" y2="15"></line>
  </svg>
);

// Globe/Network
export const GlobeIcon = () => (
  <svg key="globe" viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
    <path d="M2 12h20"></path>
  </svg>
);

// Lightbulb
export const LightbulbIcon = () => (
  <svg key="lightbulb" viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6M12 2v5M12 8a4 4 0 0 1 0 8"></path>
    <path d="M12 16v3"></path>
    <path d="M8.93 16a8 8 0 1 1 6.14 0"></path>
  </svg>
);

// Book
export const BookIcon = () => (
  <svg key="book" viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
  </svg>
);

// Code
export const CodeIcon = () => (
  <svg key="code" viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6"></polyline>
    <polyline points="8 6 2 12 8 18"></polyline>
  </svg>
);

// Laptop
export const LaptopIcon = () => (
  <svg key="laptop" viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
    <line x1="2" y1="20" x2="22" y2="20"></line>
    <path d="M6 20v-1a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"></path>
  </svg>
);

// Target
export const TargetIcon = () => (
  <svg key="target" viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <circle cx="12" cy="12" r="6"></circle>
    <circle cx="12" cy="12" r="2"></circle>
  </svg>
);

// Rocket
export const RocketIcon = () => (
  <svg key="rocket" viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path>
    <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path>
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path>
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path>
  </svg>
);

// Export an array with all icons for easy import
export const IconsArray = [
  <GraduationIcon key="graduation" />,
  <ChartIcon key="chart" />,
  <CertificateIcon key="certificate" />,
  <GlobeIcon key="globe" />,
  <LightbulbIcon key="lightbulb" />,
  <BookIcon key="book" />,
  <CodeIcon key="code" />,
  <LaptopIcon key="laptop" />,
  <TargetIcon key="target" />,
  <RocketIcon key="rocket" />
];