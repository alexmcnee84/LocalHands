import { useState, useEffect } from "react";

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

export function SplashScreen({ onComplete, duration = 2500 }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleDismiss = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      setIsVisible(false);
      onComplete();
    }, 500);
  };

  const handleClick = () => {
    handleDismiss();
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black cursor-pointer transition-opacity duration-500 ${
        isFadingOut ? "opacity-0" : "opacity-100"
      }`}
      onClick={handleClick}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div className="splash-glow-orb splash-glow-orb-1" />
        <div className="splash-glow-orb splash-glow-orb-2" />
        <div className="splash-glow-orb splash-glow-orb-3" />
      </div>

      <div className="relative z-10 text-center px-8">
        <h1
          className={`splash-title text-4xl md:text-6xl lg:text-7xl font-bold mb-6 transition-all duration-1000 ${
            isFadingOut ? "opacity-0 scale-95" : "opacity-100 scale-100"
          }`}
        >
          <span className="splash-text-glow">LocalHands</span>
        </h1>
        <p
          className={`splash-tagline text-lg md:text-xl lg:text-2xl text-cyan-300/80 tracking-wider transition-all duration-1000 delay-200 ${
            isFadingOut ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
          }`}
        >
          Build anything. No gatekeepers.
        </p>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <p className="text-cyan-400/40 text-sm animate-pulse">
          Click anywhere to continue
        </p>
      </div>
    </div>
  );
}

export default SplashScreen;
