'use client';

import { useState } from 'react';

interface SyncToSheetsButtonProps {
  eventId: number;
  className?: string;
}

export default function SyncToSheetsButton({ eventId, className = '' }: SyncToSheetsButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>('');

  const handleSync = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/events/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventId }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Erfolgreich zu Google Sheets synchronisiert!');
      } else {
        setMessage(`Fehler: ${data.error}`);
      }
    } catch (error) {
      console.error('Sync error:', error);
      setMessage('Fehler: Netzwerkfehler beim Synchronisieren');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <button
        onClick={handleSync}
        disabled={isLoading}
        className={`
          px-4 py-2 rounded-md font-medium text-sm
          ${isLoading 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700 text-white'
          }
          transition-colors duration-200
        `}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Synchronisiere...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Zu Sheets synchronisieren
          </span>
        )}
      </button>
      
      {message && (
        <div className={`text-sm ${message.includes('Fehler') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </div>
      )}
    </div>
  );
}