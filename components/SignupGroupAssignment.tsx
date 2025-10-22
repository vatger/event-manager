'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GroupService } from '../lib/endorsements/groupService';
import { EventData, ControllerGroup } from '../lib/endorsements/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { getBadgeClassForEndorsement } from '@/utils/EndorsementBadge';
import { Skeleton } from './ui/skeleton';

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
    
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <Alert>
        <AlertDescription>
            {groupData && (groupData.endorsements.length > 0  || !event.isTier1) && groupData.group ? (
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
                    ✗ You are not allowed to control {event.airport}
                </p>
            )}

            {loading &&
              <div>
                <Skeleton className='h-[20px] w-[60px] rounded-full' />
                <Skeleton className='h-[20px] w-[120px] rounded-full mt-2' />
              </div>
            }
        </AlertDescription>
    </Alert>
  );
}