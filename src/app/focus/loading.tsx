import { DoodleLoader } from "@/components/ui/doodle-loader";

export default function FocusLoading() {
  return (
    <main className="page-shell flex items-center justify-center min-h-[60vh]">
      <DoodleLoader />
    </main>
  );
}
