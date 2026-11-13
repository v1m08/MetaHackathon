// Venue Wi-Fi often hands out IPv6 addresses that go nowhere; outbound calls (Muse, image hosts) then die with
// "fetch failed". Importing this module makes every server-side fetch prefer IPv4.
import { setDefaultResultOrder } from "node:dns";

setDefaultResultOrder("ipv4first");
