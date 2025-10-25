
import { GroupService } from '@/lib/endorsements/groupService';

export default async function SignupDialog() {
  const user = {
    userCID: 1626019,
    rating: 5
  }
  const event = {
    airport: "EDDM",
    fir: "EDMM"
  }
  const {group, restrictions} = await GroupService.getControllerGroup({user, event})
  return (
    <div>
      Group: {group} <br></br>
      Restriction: {restrictions.join("; ")}
    </div>
  );
}