import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Alex Study",
    short_name: "Alex Study",
    description: "Study companion for Alexandria University medical students",
    start_url: "/",
    display: "standalone",
    /* The notebook mood's own --background and --secondary, so the splash screen the OS
       synthesises from these matches the app the user lands in. They were previously a teal
       (#0d716c) and an off-white that appear nowhere in tokens.css. Notebook is the right mood
       to key off: it is the default, and the manifest is static so it cannot follow a
       per-user palette.

       theme_color is the ink navy rather than --primary (#49B6E5) on purpose -- it paints the
       Android status bar, and a light blue there leaves white system text nearly illegible.
       The navy is equally on-brand and is what the logo wordmark already uses. */
    background_color: "#F4EFEA",
    theme_color: "#263D5B",
    icons: [
      /* Ordered widest-support-last. Chrome and Safari both prefer the SVG and will render the
         mark at any size; favicon.ico stays as the fallback for anything that cannot. */
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
  };
}
