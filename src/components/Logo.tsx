import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      <path 
        d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        className="opacity-20"
      />
      <path 
        d="M12 18C15.3137 18 18 15.3137 18 12C18 10 16.5 8 14.5 7.5C12.5 7 11.5 8.5 10.5 9C9.5 9.5 8.5 9 7.5 8C6.5 7 6 7.5 6 10C6 14.4183 8.68629 18 12 18Z" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="currentColor" className="opacity-40" />
      <path 
        d="M12 5V2" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round"
      />
      <path 
        d="M17 7L19 5" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round"
      />
      <path 
        d="M7 7L5 5" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round"
      />
    </svg>
  );
};
