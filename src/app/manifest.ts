import type { MetadataRoute } from "next";

// Lets iOS "Add to Home Screen" open the mock full-screen, without Safari chrome.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "facebook",
    short_name: "facebook",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
