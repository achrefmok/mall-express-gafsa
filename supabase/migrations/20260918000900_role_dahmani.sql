-- Le rôle `dahmani_admin`, seul dans son fichier.
--
-- PostgreSQL refuse qu'une valeur d'énumération soit employée dans la
-- transaction qui l'ajoute. Mise avec le reste, elle ferait échouer tout le
-- lot — d'où ce fichier d'une ligne, à passer avant l'autre.
--
-- Ce rôle n'hérite de rien : `is_admin()` teste `role = 'admin'` et le
-- laissera dehors. Tout ce qu'il pourra faire lui sera donné explicitement,
-- politique par politique, dans la migration suivante.

alter type public.user_role add value if not exists 'dahmani_admin';
