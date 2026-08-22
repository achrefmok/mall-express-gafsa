import { DashboardSkeleton } from "@/components/ui/skeletons";

/** Même charpente que le vendeur : un bandeau chiffré, puis des rangées. */
export default function Loading() {
  return <DashboardSkeleton rows={6} />;
}
