import React from "react";

function SkeletonCard() {
  return (
    <div className="bg-white/70 backdrop-blur-md border border-blue-100 rounded-2xl shadow-md overflow-hidden animate-pulse">
      
      {/* Image Skeleton */}
      <div className="h-20 w-full bg-gray-200" />

      {/* Content */}
      <div className="p-3 space-y-3">
        
        {/* Title */}
        <div className="h-3 w-2/3 bg-gray-200 rounded" />

        {/* Location */}
        <div className="h-2 w-1/2 bg-gray-200 rounded" />

        {/* Icons */}
        <div className="grid grid-cols-5 gap-2 mt-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 w-4 bg-gray-200 rounded-full" />
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center mt-2">
          <div className="h-2 w-10 bg-gray-200 rounded" />
          <div className="h-5 w-12 bg-gray-200 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default SkeletonCard;