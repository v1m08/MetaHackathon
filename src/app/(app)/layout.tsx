import { GameNudge } from "@/components/GameNudge";
import { DemoStrip, PhoneFrame } from "@/components/Shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PhoneFrame>{children}</PhoneFrame>
      <GameNudge />
      <DemoStrip />
    </>
  );
}
