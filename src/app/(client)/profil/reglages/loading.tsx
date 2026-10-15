import { ListSkeleton } from "@/components/ui/skeletons";

/** Un formulaire : quelques blocs, la place réservée avant les données. */
export default function Loading() {
  return <ListSkeleton rows={4} height={64} />;
}
