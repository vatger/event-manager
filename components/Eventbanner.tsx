import { Clock } from 'lucide-react';
import React, { useState } from 'react'


function EventBanner({ bannerUrl, eventName, className = "" }: { 
    bannerUrl: string; 
    eventName: string;
    className?: string;
  }) {
    const [imgError, setImgError] = useState(false);
    
    if (imgError || !bannerUrl) {
      return (
        <div className={`bg-gradient-to-br from-blue-900 to-95% to-blue-200 rounded-sm flex items-center justify-center aspect-video ${className}`}>
          <div className="text-center text-white p-4">
            <Clock className="w-8 h-8 mx-auto mb-2" />
            <p className="font-semibold">{eventName}</p>
            <p className="text-sm opacity-90">Upcoming...</p>
          </div>
        </div>
      );
    }
    
    return (
      <div className={`overflow-hidden ${className} aspect-video`}>
        <img 
          src={bannerUrl} 
          className="w-full h-full object-cover"
          alt={`${eventName} Banner`}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

export default EventBanner
