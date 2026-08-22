import { ListSkeleton } from "@/components/ui/skeletons";

/** La recherche interroge deux tables : l'attente est réelle, elle a sa forme. */
export default function Loading() {
  return <ListSkeleton rows={4} height={96} />;
}
