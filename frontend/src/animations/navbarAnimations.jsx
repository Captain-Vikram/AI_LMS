export const navbarVariants = {
    hidden: { y: -100, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { 
        type: "spring", 
        stiffness: 60, 
        damping: 15,
        when: "beforeChildren",
        staggerChildren: 0.1 
      } 
    }
  };
  
  export const childVariants = {
    hidden: { y: -20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { 
        type: "spring", 
        stiffness: 80, 
        damping: 15,
        mass: 0.5
      } 
    }
  };