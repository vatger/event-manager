
import { GroupService } from '@/lib/endorsements/groupService';
import { getRatingValue } from '@/utils/ratingToValue';

export default async function SignupDialog() {
  const user = {
    userCID: 1649341,
    rating: 2
  }
  const event = {
    airport: "EDDN",
    fir: "EDMM"
  }
  const mockdata = {
    endorsements: ["EDDM_GNDDEL"],
    solos: [{position: "EDDM_STA_CTR", expiry: new Date("2025-10-28T23:59:00.000Z")}],
  }
  const {group, restrictions} = await GroupService.getControllerGroup({user, event})
  return (
    <div>
      Group: {group} <br></br>
      Restriction: {restrictions.join("; ")}
    </div>
  );
}