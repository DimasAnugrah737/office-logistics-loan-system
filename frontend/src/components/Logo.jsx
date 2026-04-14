import React from 'react';

const Logo = ({ className = "h-12 w-auto", showText = true }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Icon Part */}
      <div className="relative w-12 h-12 flex-shrink-0">
        <svg
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Building (Stacked Boxes) */}
          <g className="fill-current opacity-90">
             {/* Bottom Layer */}
             <rect x="5" y="80" width="65" height="15" rx="1" />
             {/* Layer 2 */}
             <rect x="10" y="62" width="55" height="15" rx="1" />
             {/* Layer 3 */}
             <rect x="15" y="44" width="45" height="15" rx="1" />
             {/* Top Layer */}
             <rect x="20" y="26" width="35" height="15" rx="1" />
          </g>

          {/* Windows (White Details) */}
          <g fill="white" fillOpacity="0.4">
             <rect x="52" y="84" width="8" height="4" rx="0.5" />
             <rect x="42" y="66" width="8" height="4" rx="0.5" />
             <rect x="34" y="48" width="8" height="4" rx="0.5" />
             <rect x="28" y="30" width="8" height="4" rx="0.5" />
          </g>
          
          {/* Truck (Refined Silhouette) */}
          <g fill="white" className="drop-shadow-sm">
             <rect x="12" y="85" width="12" height="6" rx="0.5" /> {/* Body */}
             <rect x="24" y="87" width="5" height="4" rx="0.5" /> {/* Cabin */}
             <circle cx="15" cy="91" r="1.5" /> {/* Wheel 1 */}
             <circle cx="21" cy="91" r="1.5" /> {/* Wheel 2 */}
          </g>

          {/* Green Checkmark (Bold and Sharp) */}
          <path
            d="M20 65L45 90L105 20"
            stroke="#22c55e"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="filter drop-shadow-md"
          />
          <path
            d="M20 65L45 90L105 20"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-20"
          />
        </svg>
      </div>

      {/* Text Part */}
      {showText && (
        <div className="flex flex-col leading-none select-none">
          <div className="flex flex-col">
            <span className="text-[14px] sm:text-lg font-black uppercase tracking-tighter text-current opacity-90">
              Office Logistics
            </span>
            <div className="flex items-center gap-1">
               <span className="text-[12px] sm:text-base font-black uppercase tracking-tight text-current opacity-60"> & </span>
               <span className="text-[12px] sm:text-base font-black uppercase tracking-tight text-[#22c55e]"> Loan System </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Logo;
