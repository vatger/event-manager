'use client';

import { Button } from '@/components/ui/button';
import { useUser } from '@/hooks/useUser';
import { useState } from 'react';

interface SyncToSheetsButtonProps {
  eventId: number;
  className?: string;
}

export default function SyncToSheetsButton({ eventId, className = '' }: SyncToSheetsButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { canInOwnFIR } = useUser();

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

  const handleSyncClick = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirm = () => {
    setShowConfirmDialog(false);
    handleSync();
  };

  const handleCancel = () => {
    setShowConfirmDialog(false);
  };

  return (
    <>
      <div className={`flex flex-col gap-2 ${className}`}>
        <Button
          onClick={handleSyncClick}
          disabled={isLoading  || !canInOwnFIR("event.export")}
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
        </Button>
        
        {message && (
          <div className={`text-sm ${message.includes('Fehler') ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </div>
        )}
      </div>

      {/* Bestätigungs-Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg max-w-md w-full p-6 border shadow-lg">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Hinweis:
            </h3>
            
            <div className="text-sm text-muted-foreground mb-6 space-y-3">
              <p>
                <strong>Achtung:</strong> Beim Synchronisieren werden alle vorhandenen Daten 
                in der Google Sheets Output Tabelle <strong>komplett überschrieben</strong>.
              </p>
              <p>
                Kopiere nach dem Sync die Daten aus dem Output File in dein gewünschtes Sheet.
              </p>
              <p className="text-red-600 dark:text-red-400 font-medium">
                Arbeit<strong> nicht </strong>im Output Sheet!
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-accent rounded-md transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 rounded-md transition-colors"
              >
                Überschreiben und synchronisieren
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}