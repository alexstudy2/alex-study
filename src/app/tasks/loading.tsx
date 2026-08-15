import { DoodleLoader } from "@/components/ui/doodle-loader";

export default function Loading() {
  return (
    <main className="page-shell flex items-center justify-center min-h-[60vh]">
      <DoodleLoader />
    </main>
  );
}
