'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GroupService } from './groupService';
import { EventData, ControllerGroup } from './types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { getBadgeClassForEndorsement } from '@/utils/EndorsementBadge';

interface Props {
  cid: number;
  event: EventData;
  rating: number;
  onGroupDetermined: (group: ControllerGroup) => void;
}

export default function SignupGroupAssignment({ 
  cid, 
  event, 
  rating, 
  onGroupDetermined 
}: Props) {
  const [groupData, setGroupData] = useState<ControllerGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Verhindere unendliche Updates mit useRef
  const hasDetermined = useRef(false);
  const eventIdRef = useRef(event.id);
  const cidRef = useRef(cid);

  // Stabilisiere die onGroupDetermined Funktion
  const onGroupDeterminedStable = useCallback((group: ControllerGroup) => {
    onGroupDetermined(group);
  }, [onGroupDetermined]);

  useEffect(() => {
    // Nur ausführen wenn sich CID oder Event ID ändern UND noch nicht bestimmt wurde
    if (hasDetermined.current && cidRef.current === cid && eventIdRef.current === event.id) {
      return;
    }

    const determineGroup = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await GroupService.determineControllerGroup(cid, event, rating);
        
        setGroupData(result);
        onGroupDeterminedStable(result);
        
        // Markiere als bestimmt
        hasDetermined.current = true;
        eventIdRef.current = event.id;
        cidRef.current = cid;
        
      } catch (err) {
        setError('Fehler bei der Gruppenbestimmung');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    determineGroup();
  }, [cid, event.id, rating, onGroupDeterminedStable]); // Nur event.id statt gesamtes event object

  if (loading) return <div>Bestimme Gruppe...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <Alert>
        <AlertDescription>
            {groupData && groupData.endorsements.length > 0  ? (
                <div>
                    <Badge className={getBadgeClassForEndorsement(groupData.group)}>{groupData.group}</Badge>
                    {groupData.remarks.length == 0 ? (
                        <p className="text-xs text-green-600 mt-2">
                            ✓ You can controll up to {groupData.group}, based on your Training Data
                        </p>
                    ) : (
                        <div className='mt-2'>
                            {groupData.remarks.map((rmk, index) => (
                                <p key={index} className="text-xs">
                                • {rmk}
                              </p>
                            ))}
                        </div>
                    )}
                    
                </div>
            ) : (
                <p className='text-red-600'>
                    Could not load endorsements for {event.airport}
                </p>
            )}
        </AlertDescription>
    </Alert>
  );
}