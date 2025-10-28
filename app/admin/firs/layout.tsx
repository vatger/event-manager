import { FIRNavbar } from "./_components/FIRnavbar";

export default function FIRsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* <FIRNavbar /> */}
      <main>{children}</main>
    </div>
  );
}