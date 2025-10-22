"use client"
import SignupGroupAssignment from '@/components/SignupGroupAssignment';
import { ControllerGroup } from '@/lib/endorsements/types';
import { isAirportTier1 } from '@/utils/configUtils';
import { useMemo, useState } from 'react';

export default function SignupDialog() {
  const [controllerGroup, setControllerGroup] = useState<ControllerGroup | null>(null);

  const handleGroupDetermined = (group: ControllerGroup) => {
    if (JSON.stringify(group) !== JSON.stringify(controllerGroup)) {
      setControllerGroup(group);
    }
  };
  const memoizedEvent = useMemo(() => ({
    id: "1",
    fir: "EDMM",
    airport: "EDDB",
    isTier1: isAirportTier1("EDDB")
  }), []);
  

  return (
    <div>
      {/* Ihre bestehenden Formularfelder */}
      
      <SignupGroupAssignment
        cid={1649341}
        event={memoizedEvent}
        rating={4}
        onGroupDetermined={handleGroupDetermined}
      />
      {/* Weitere Formularelemente */}
    </div>
  );
}