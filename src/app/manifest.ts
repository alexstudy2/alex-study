import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Alex Study",
    short_name: "Alex Study",
    description: "Study companion for Alexandria University medical students",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f0e8",
    theme_color: "#0d716c",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
