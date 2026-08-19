import { DoodleLoader } from "@/components/ui/doodle-loader";

export default function PlanBoardLoading() {
  return (
    <main className="page-shell flex items-center justify-center min-h-[60vh]">
      <DoodleLoader />
    </main>
  );
}
