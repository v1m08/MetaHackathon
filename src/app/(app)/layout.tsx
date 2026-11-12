import { HangoutBanner } from "@/components/hangout/HangoutBanner";
import { DemoStrip, PhoneFrame } from "@/components/Shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PhoneFrame>
        <HangoutBanner />
        {children}
      </PhoneFrame>
      <DemoStrip />
    </>
  );
}
