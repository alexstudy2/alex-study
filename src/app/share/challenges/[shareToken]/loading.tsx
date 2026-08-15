import { DoodleLoader } from "@/components/ui/doodle-loader";

export default function SharedChallengeLoading() {
  return (
    <main className="page-shell flex items-center justify-center min-h-[60vh]">
      <DoodleLoader />
    </main>
  );
}
