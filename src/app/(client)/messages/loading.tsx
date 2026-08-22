import { ListSkeleton } from "@/components/ui/skeletons";

/** Une liste de conversations : des lignes courtes, pas des fiches. */
export default function Loading() {
  return <ListSkeleton rows={6} height={56} />;
}
