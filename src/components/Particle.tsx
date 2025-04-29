// src/components/Particle.tsx (New File)
import React, { useEffect, useState } from "react";

interface ParticleProps {
  initialStyle: React.CSSProperties;
  finalStyle: React.CSSProperties;
}

const Particle: React.FC<ParticleProps> = ({ initialStyle, finalStyle }) => {
  const [applyFinalStyle, setApplyFinalStyle] = useState(false);

  useEffect(() => {
    // Use requestAnimationFrame to ensure the initial style is rendered before applying the final one
    // which triggers the CSS transition defined in the style object.
    const rafId = requestAnimationFrame(() => {
      setApplyFinalStyle(true);
    });
    // Cleanup function to cancel the frame request if the component unmounts
    return () => cancelAnimationFrame(rafId);
  }, []); // Empty dependency array ensures this effect runs only once after mount

  // Render the div with the style dynamically changing based on applyFinalStyle state
  return <div style={applyFinalStyle ? finalStyle : initialStyle} />;
};

export default Particle;
