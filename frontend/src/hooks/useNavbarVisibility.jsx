import { useState, useEffect } from 'react';

const useNavbarVisibility = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Show navbar if:
      // 1. User is near the top (< 100px)
      // 2. User is scrolling up
      // 3. User is hovering near the top
      if (currentScrollY < 60 || currentScrollY < lastScrollY || isHovering) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
      
      setLastScrollY(currentScrollY);
    };
    
    const handleMouseMove = (e) => {
      // Show navbar when mouse is near the top (within 60px)
      if (e.clientY <= 50) {
        setIsHovering(true);
        setIsVisible(true);
      } else {
        setIsHovering(false);
        // Don't immediately hide - this will be handled by the scroll handler
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [lastScrollY, isHovering]);

  return isVisible;
};

export default useNavbarVisibility;