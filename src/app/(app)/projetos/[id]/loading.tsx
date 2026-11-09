import { OverviewSkeleton } from "@/modules/projects/overview-skeleton";

export default function ProjectLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-5">
      <OverviewSkeleton />
    </div>
  );
}
