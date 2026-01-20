// app/signin/page.tsx
import { getServerSession } from "next-auth";
import SignInClient from "./SignInClient";

export default async function SignInPage() {
  const session = await getServerSession();
  
  
  return <SignInClient session={session} isDevMode={process.env.DEV_MODE === "true"} />;
}