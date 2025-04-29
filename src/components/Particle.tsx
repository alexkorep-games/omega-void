// src/components/Particle.tsx
import React, { useEffect, useState } from "react";

interface ParticleProps {
  initialStyle: React.CSSProperties;
  finalStyle: React.CSSProperties;
}

const Particle: React.FC<ParticleProps> = ({ initialStyle, finalStyle }) => {
  const [applyFinalStyle, setApplyFinalStyle] = useState(false);

  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      setApplyFinalStyle(true);
    });
    return () => cancelAnimationFrame(rafId);
  }, []);

  return <div style={applyFinalStyle ? finalStyle : initialStyle} />;
};

export default Particle;
