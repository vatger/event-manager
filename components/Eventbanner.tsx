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
            <div className={`bg-gradient-to-br from-blue-500 to-95% to-blue-200 rounded-sm flex items-center justify-center ${className}`}>
                <div className="text-center text-white p-4">
                <Clock className="w-8 h-8 mx-auto mb-2" />
                <p className="font-semibold">{eventName}</p>
                <p className="text-sm opacity-90">Upcomming...</p>
                </div>
            </div>
            );
        }
        
        return (
            <img 
            src={bannerUrl} 
            className={className}
            alt={`${eventName} Banner`}
            onError={() => setImgError(true)}
            />
        );
        }

export default EventBanner
