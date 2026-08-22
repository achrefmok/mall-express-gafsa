import { ListSkeleton } from "@/components/ui/skeletons";

/** Un fil de discussion : des bulles de hauteurs voisines. */
export default function Loading() {
  return <ListSkeleton rows={5} height={48} />;
}
