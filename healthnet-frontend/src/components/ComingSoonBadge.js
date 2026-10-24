import React from 'react';

const ComingSoonBadge = ({ className = '' }) => (
  <span className={`inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 ${className}`}>
    Coming soon
  </span>
);

// Marks placeholder numbers that aren't real user data yet
export const SampleDataBadge = ({ className = '' }) => (
  <span className={`inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 ${className}`}>
    Sample data
  </span>
);

export default ComingSoonBadge;
