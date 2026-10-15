import { ListSkeleton } from "@/components/ui/skeletons";

/** Des départs : des lignes, la place réservée avant les données. */
export default function Loading() {
  return <ListSkeleton rows={5} height={72} />;
}
