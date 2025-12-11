import React from 'react';

/**
 * AnimatedHands renders a simple animated hand emoji that
 * gently waves from side to side. The animation is driven by
 * a custom CSS class declared in index.css. This component
 * can be placed anywhere in the UI to add a playful touch.
 */
const AnimatedHands: React.FC = () => {
  return (
    <div className="flex justify-center items-center py-2">
      {/* Use a yellow pointing down hand emoji for visual flair. */}
      <span className="text-4xl animate-wave inline-block select-none">👇</span>
    </div>
  );
};

export default AnimatedHands;