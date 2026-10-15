import { ListSkeleton } from "@/components/ui/skeletons";

/*
  Toutes les pages de l'application de transport sont rendues à la demande
  (taxis disponibles, départs, courses) : sans cette frontière, un toucher sur
  un onglet ne montrait rien tant que le serveur n'avait pas répondu.
*/
export default function Loading() {
  return <ListSkeleton rows={4} height={72} />;
}
