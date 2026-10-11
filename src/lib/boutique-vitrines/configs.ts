import type { ConfigVitrine, SceneVitrine, VitrineId } from "./types";

/*
  Valeurs du handoff « Comprendre le design de l'app » (dossiers
  01-mode … 10-location) : `accent` de chaque catégorie, objet `DISP` du
  prototype pour la scène. Les accents oklch ont été convertis en hex une
  fois pour toutes (le contrôle de contraste lit du hex) ; les scènes
  gardent leur oklch, que le navigateur lit directement.
*/

/** L'or du portant — le même métal que le handoff, réutilisé par la scène claire. */
const OR = {
  boule: "radial-gradient(circle at 35% 30%,#fff8e4,#c9a14f 55%,#6b4f1d)",
  mat: "linear-gradient(90deg,#7a5a22,#fff3d0 40%,#b08a3e 65%,#5e441a)",
  anneau: "conic-gradient(from 20deg,#fff3d0,#b08a3e,#f6e3b4,#7a5a22,#fbe9be,#a07c34,#fff3d0)",
  fil: "linear-gradient(180deg,#f6e3b4,#b08a3e)",
  cintre: "linear-gradient(90deg,#8a6a2a,#fff3d0 50%,#8a6a2a)",
  attache: "#e8cd96",
};

/*
  Mode — showroom blanc (demande de l'utilisateur, 2026-10-12) : un mur
  blanc cassé, un sol clair, un portant doré, des ombres douces ; aucun
  bouton, rotation très lente au repos. Les pièces du fond s'estompent dans
  le blanc au lieu de s'assombrir.
*/
const SCENE_PORTANT: SceneVitrine = {
  titre: { fr: "Portant 360°", ar: "الرّف الدوّار 360°" },
  suspendu: true,
  fond:
    "radial-gradient(70% 55% at 50% 38%,#ffffff,transparent 72%),linear-gradient(180deg,#fbfaf8 0%,#f4f1ec 76%,#e9e3da 76.3%,#f3efe9 84%,#faf8f5 100%)",
  mur: "rgba(150,120,70,.4)",
  lampe: "rgba(255,236,200,.75)",
  cone: "linear-gradient(180deg,rgba(255,232,190,.3),transparent 80%)",
  carte: {
    largeur: 86,
    hauteur: 124,
    rayon: "12px",
    liseré: "0 0 0 1px rgba(201,161,79,.22),0 12px 18px -6px rgba(70,50,25,.28),0 22px 30px -18px rgba(70,50,25,.25)",
  },
  dos: "linear-gradient(160deg,#f7f3ec,#e6ddd0)",
  marque: "#c9a14f",
  pastille: "linear-gradient(90deg,#e8cd96,#c9a14f)",
  encrePastille: "#1a1320",
  controles: false,
  vitesse: -7,
  brume: { couleur: "#ffffff", max: 0.55 },
  sol: "radial-gradient(closest-side,rgba(70,50,25,.22),rgba(70,50,25,.08) 55%,transparent)",
  luminaire: "#e7e1d7",
  fondCarte: "#efe9e1",
  etiquette: { fond: "linear-gradient(180deg,transparent,rgba(255,255,255,.94) 45%)", texte: "#241f2e" },
  metal: { ...OR, socleCentre: "#f4f0ea" },
};

export const VITRINES: Record<VitrineId, ConfigVitrine> = {
  mode: {
    id: "mode",
    label: { fr: "Mode", ar: "أزياء" },
    accent: "#6d4b8f",
    accentDoux: "#ece8f0",
    fondPage: "#eeeaf3",
    libelleAction: { fr: "Demander au vendeur", ar: "اسأل البائع" },
    filtre: { titre: { fr: "Ma taille", ar: "مقاسي" }, source: "tailles", options: [] },
    scene: SCENE_PORTANT,
  },

  telephones: {
    id: "telephones",
    label: { fr: "Téléphones", ar: "هواتف" },
    accent: "#005aba", // oklch(.48 .17 255)
    accentDoux: "#deeaf6",
    fondPage: "#e7ebf5",
    libelleAction: { fr: "Demander un téléphone", ar: "اسأل عن هاتف" },
    filtre: {
      titre: { fr: "Ma marque", ar: "ماركتي" },
      source: { attributs: ["marque"] },
      options: [
        { cle: "samsung", fr: "Samsung", ar: "Samsung", motsCles: ["samsung", "galaxy", "سامسونج", "غالاكسي"] },
        { cle: "iphone", fr: "iPhone", ar: "iPhone", motsCles: ["iphone", "apple", "ايفون", "آيفون"] },
        { cle: "xiaomi", fr: "Xiaomi", ar: "Xiaomi", motsCles: ["xiaomi", "redmi", "poco", "شاومي", "ريدمي"] },
        { cle: "oppo", fr: "Oppo", ar: "Oppo", motsCles: ["oppo", "اوبو", "أوبو"] },
        { cle: "infinix", fr: "Infinix", ar: "Infinix", motsCles: ["infinix"] },
        { cle: "huawei", fr: "Huawei", ar: "Huawei", motsCles: ["huawei", "honor"] },
      ],
    },
    scene: {
      titre: { fr: "Socle de verre 360°", ar: "منصّة العرض الزجاجية 360°" },
      suspendu: false,
      fond: "radial-gradient(70% 55% at 50% 70%,rgba(60,120,255,.35),transparent 70%),linear-gradient(180deg,#05070d,#0b1224)",
      mur: "rgba(140,180,255,.4)",
      lampe: "rgba(120,170,255,.8)",
      cone: "linear-gradient(180deg,rgba(150,190,255,.18),transparent 85%)",
      disque: "radial-gradient(circle,rgba(160,200,255,.35),rgba(40,80,180,.15) 60%,rgba(20,40,90,.6))",
      bord: "#0d1a3a",
      ombreDisque: "0 0 0 2px oklch(.72 .15 240),0 0 40px oklch(.65 .18 250)",
      carte: { largeur: 72, hauteur: 140, rayon: "18px", liseré: "inset 0 0 0 4px #07080c,0 0 0 1px rgba(150,190,255,.45),0 16px 30px rgba(0,0,0,.6)" },
      dos: "linear-gradient(160deg,#141a2a,#05070d)",
      marque: "oklch(.72 .15 240)",
      pastille: "oklch(.72 .15 240)",
      encrePastille: "#05070d",
    },
  },

  parfumerie: {
    id: "parfumerie",
    label: { fr: "Parfumerie", ar: "عطور" },
    accent: "#993845", // oklch(.48 .13 15)
    accentDoux: "#f2e5e7",
    fondPage: "#f0e9ee",
    libelleAction: { fr: "Demander un échantillon", ar: "اطلب عيّنة" },
    filtre: {
      titre: { fr: "Ma famille olfactive", ar: "عائلتي العطرية" },
      source: { attributs: ["famille_olfactive"] },
      options: [
        { cle: "floral", fr: "Floral", ar: "زهري", motsCles: ["floral", "fleur", "زهري", "ورد", "ياسمين"] },
        { cle: "boise", fr: "Boisé", ar: "خشبي", motsCles: ["bois", "cedre", "santal", "خشبي"] },
        { cle: "oriental", fr: "Oriental", ar: "شرقي", motsCles: ["oriental", "ambre", "oud", "musc", "شرقي", "عود", "مسك"] },
        { cle: "frais", fr: "Frais", ar: "منعش", motsCles: ["frais", "fraich", "agrume", "citrus", "aquatique", "marin", "منعش"] },
      ],
    },
    scene: {
      titre: { fr: "Plateau de marbre 360°", ar: "رفّ العطور الرخامي 360°" },
      suspendu: false,
      fond: "radial-gradient(70% 55% at 50% 40%,rgba(230,160,170,.35),transparent 70%),linear-gradient(180deg,#1c0f14,#2b161d)",
      mur: "rgba(240,200,190,.45)",
      lampe: "rgba(255,210,200,.8)",
      cone: "linear-gradient(180deg,rgba(255,215,205,.22),transparent 85%)",
      disque: "radial-gradient(circle at 35% 35%,#ffffff,#efe7e2 40%,#cdbfb7 85%)",
      bord: "#9c8a80",
      ombreDisque: "0 0 0 3px #e3c39a,0 20px 40px rgba(0,0,0,.5)",
      carte: { largeur: 78, hauteur: 132, rayon: "999px 999px 14px 14px", liseré: "0 0 0 1.5px #e3c39a,0 16px 28px rgba(0,0,0,.5)" },
      dos: "linear-gradient(160deg,#3a1f28,#1c0f14)",
      marque: "#e3c39a",
      pastille: "linear-gradient(90deg,#f3dcc0,#d9b07c)",
      encrePastille: "#2b161d",
    },
  },

  /*
    Cosmétiques — sans maquette dans le handoff : vitrine ajoutée le
    2026-10-12 à la demande de l'utilisateur (« coiffeuse lumineuse, rose
    poudré »). Même moteur, même structure que les autres métiers.
  */
  cosmetiques: {
    id: "cosmetiques",
    label: { fr: "Cosmétiques", ar: "تجميل" },
    accent: "#994b6c", // oklch(.52 .11 355)
    accentDoux: "#f2e8ec",
    fondPage: "#f0eaf1",
    libelleAction: { fr: "Demander conseil", ar: "اطلب نصيحة" },
    filtre: {
      titre: { fr: "Mon besoin", ar: "احتياجي" },
      source: { attributs: ["besoin"] },
      options: [
        { cle: "maquillage", fr: "Maquillage", ar: "مكياج", motsCles: ["maquillage", "beaute-maquillage", "fard", "palette", "rouge a levres", "mascara", "fond de teint", "gloss", "eyeliner", "مكياج"] },
        { cle: "soin", fr: "Soin visage", ar: "عناية بالوجه", motsCles: ["soin", "beaute-soin", "serum", "creme", "visage", "nettoyant", "masque", "booster", "عناية", "بشرة"] },
        { cle: "cheveux", fr: "Cheveux", ar: "شعر", motsCles: ["cheveu", "brosse", "shampo", "lisseur", "keratin", "seche-cheveux", "شعر"] },
        { cle: "corps", fr: "Corps", ar: "جسم", motsCles: ["corps", "epilat", "lait corporel", "gommage", "جسم"] },
      ],
    },
    scene: {
      titre: { fr: "Coiffeuse 360°", ar: "طاولة التجميل 360°" },
      suspendu: false,
      // Un miroir ovale entouré d'ampoules, sur un mur rose poudré.
      fond: [
        ...[8, 22, 36, 50, 64, 78, 92].map(
          (x, i) =>
            `radial-gradient(circle at ${x}% ${i === 0 || i === 6 ? 30 : i === 1 || i === 5 ? 15 : 9}%,#fffaf0 0 4px,rgba(255,228,190,.55) 5px,transparent 13px)`,
        ),
        "radial-gradient(40% 34% at 50% 30%,rgba(255,255,255,.95),rgba(255,255,255,.65) 82%,#e9c6cf 83%,#e9c6cf 85%,transparent 86%)",
        "linear-gradient(180deg,#fbf0f2 0%,#f5e2e7 74%,#ecd2d9 74.3%,#f6e8ec 100%)",
      ].join(","),
      mur: "rgba(153,75,108,.42)",
      lampe: "rgba(255,236,215,.9)",
      cone: "linear-gradient(180deg,rgba(255,240,225,.55),transparent 85%)",
      disque: "radial-gradient(circle,#ffffff 0 58%,#f7e3e8 59% 72%,#ffffff 73%)",
      bord: "#e8c3cd",
      ombreDisque: "0 0 0 3px #e9b9c6,0 16px 30px rgba(140,60,80,.22)",
      carte: { largeur: 80, hauteur: 116, rayon: "20px", liseré: "0 0 0 3px #fff,0 0 0 4px #efc6d1,0 14px 24px rgba(140,60,80,.25)" },
      dos: "linear-gradient(160deg,#ffffff,#f6e1e7)",
      marque: "#c97a92",
      pastille: "linear-gradient(90deg,#f6d3dc,#e7a9ba)",
      encrePastille: "#4a1f2c",
      brume: { couleur: "#ffffff", max: 0.5 },
      luminaire: "#efd9de",
      fondCarte: "#f6e6ea",
      etiquette: { fond: "linear-gradient(180deg,transparent,rgba(255,255,255,.94) 45%)", texte: "#3a1f28" },
    },
  },

  parapharmacie: {
    id: "parapharmacie",
    label: { fr: "Parapharmacie", ar: "شبه صيدلية" },
    accent: "#006c52", // oklch(.47 .1 170)
    accentDoux: "#deece9",
    fondPage: "#e7ecef",
    libelleAction: { fr: "Demander au pharmacien", ar: "اسأل الصيدلي" },
    filtre: {
      titre: { fr: "Mon type de peau", ar: "نوع بشرتي" },
      source: { attributs: ["peau", "besoin"] },
      options: [
        { cle: "seche", fr: "Sèche", ar: "جافة", motsCles: ["sec", "seche", "جاف", "جافة"] },
        { cle: "grasse", fr: "Grasse", ar: "دهنية", motsCles: ["gras", "grasse", "mixte", "دهني", "دهنية"] },
        { cle: "sensible", fr: "Sensible", ar: "حساسة", motsCles: ["sensib", "حساس", "حساسة"] },
        { cle: "enfants", fr: "Bébé & enfant", ar: "أطفال", motsCles: ["bebe", "enfant", "اطفال", "أطفال", "رضيع"] },
      ],
    },
    scene: {
      titre: { fr: "Tour de soin 360°", ar: "برج العناية 360°" },
      suspendu: false,
      fond: "radial-gradient(70% 55% at 50% 40%,#ffffff,transparent 70%),linear-gradient(180deg,#e6f4ef,#d3ebe3)",
      mur: "oklch(.5 .1 170 / .5)",
      lampe: "rgba(255,255,255,1)",
      cone: "linear-gradient(180deg,rgba(255,255,255,.7),transparent 85%)",
      disque: "radial-gradient(circle,#ffffff,#f1f7f5 70%,#d7e9e2)",
      bord: "#a9cdbf",
      ombreDisque: "0 0 0 3px oklch(.6 .11 170),0 16px 30px rgba(20,80,60,.25)",
      carte: { largeur: 84, hauteur: 112, rayon: "16px", liseré: "0 0 0 2px #fff,0 0 0 3px oklch(.75 .08 170),0 14px 24px rgba(20,80,60,.25)" },
      dos: "linear-gradient(160deg,#ffffff,#e3f1ec)",
      marque: "oklch(.55 .11 170)",
      pastille: "oklch(.5 .11 170)",
      encrePastille: "#fff",
    },
  },

  electromenager: {
    id: "electromenager",
    label: { fr: "Électroménager", ar: "أجهزة منزلية" },
    accent: "#0a5470", // oklch(.42 .08 230)
    accentDoux: "#dfe9ec",
    fondPage: "#e8eaf1",
    libelleAction: { fr: "Demander un devis", ar: "اطلب عرض سعر" },
    filtre: {
      titre: { fr: "Pour quelle pièce ?", ar: "لأيّ غرفة؟" },
      source: { attributs: ["piece"] },
      options: [
        { cle: "cuisine", fr: "Cuisine", ar: "مطبخ", motsCles: ["cuisine", "four", "frigo", "refrigerateur", "congelateur", "cuisiniere", "مطبخ", "ثلاجة", "فرن"] },
        { cle: "lavage", fr: "Lavage", ar: "غسيل", motsCles: ["lav", "linge", "seche-linge", "غسيل", "غسالة"] },
        { cle: "clim", fr: "Climatisation", ar: "تكييف", motsCles: ["clim", "chauff", "ventilat", "تكييف", "مكيف"] },
        { cle: "petit", fr: "Petit électro", ar: "صغير", motsCles: ["petit", "mixeur", "bouilloire", "cafetiere", "صغير"] },
      ],
    },
    scene: {
      titre: { fr: "Showroom tournant 360°", ar: "صالة العرض الدوّارة 360°" },
      suspendu: false,
      fond: "radial-gradient(70% 50% at 50% 75%,rgba(160,230,255,.22),transparent 70%),linear-gradient(180deg,#0c0f12,#161b21)",
      mur: "rgba(190,230,255,.38)",
      lampe: "rgba(220,245,255,.9)",
      cone: "linear-gradient(180deg,rgba(220,245,255,.18),transparent 85%)",
      disque: "radial-gradient(circle,#2a323b,#11161b 75%)",
      bord: "#05070a",
      ombreDisque: "0 0 0 2px #bfeaff,0 0 26px #6fd0ff",
      carte: { largeur: 96, hauteur: 104, rayon: "10px", liseré: "0 0 0 1px rgba(190,230,255,.4),0 16px 28px rgba(0,0,0,.6)" },
      dos: "linear-gradient(160deg,#1d242c,#0c0f12)",
      marque: "#bfeaff",
      pastille: "#bfeaff",
      encrePastille: "#0c0f12",
    },
  },

  moto: {
    id: "moto",
    label: { fr: "Moto & pièces", ar: "موتو وقطع غيار" },
    accent: "#a53e00", // oklch(.5 .15 45)
    accentDoux: "#f3e6de",
    fondPage: "#f1e9ea",
    libelleAction: { fr: "Demander une pièce", ar: "اسأل عن قطعة" },
    filtre: {
      titre: { fr: "Ma moto", ar: "الموتو متاعي" },
      source: { attributs: ["compatibilite", "marque"] },
      options: [
        { cle: "yamaha", fr: "Yamaha", ar: "Yamaha", motsCles: ["yamaha", "ياماها"] },
        { cle: "honda", fr: "Honda", ar: "Honda", motsCles: ["honda", "هوندا"] },
        { cle: "sym", fr: "SYM", ar: "SYM", motsCles: ["sym"] },
        { cle: "kymco", fr: "Kymco", ar: "Kymco", motsCles: ["kymco"] },
        { cle: "peugeot", fr: "Peugeot", ar: "Peugeot", motsCles: ["peugeot", "بيجو"] },
      ],
    },
    scene: {
      titre: { fr: "Plateau d'atelier 360°", ar: "منصّة الورشة 360°" },
      suspendu: false,
      fond: "linear-gradient(45deg,rgba(255,255,255,.03) 25%,transparent 25% 75%,rgba(255,255,255,.03) 75%) 0 0/16px 16px,radial-gradient(70% 55% at 50% 40%,rgba(255,170,60,.22),transparent 70%),linear-gradient(180deg,#141414,#1d1d1d)",
      mur: "rgba(242,183,5,.5)",
      lampe: "rgba(255,200,120,.85)",
      cone: "linear-gradient(180deg,rgba(255,210,150,.18),transparent 85%)",
      disque: "radial-gradient(circle,#2b2b2b 0 62%,transparent 63%),repeating-conic-gradient(#f2b705 0 12deg,#151515 12deg 24deg)",
      bord: "#0a0a0a",
      ombreDisque: "0 0 0 2px #f2b705,0 20px 40px rgba(0,0,0,.6)",
      carte: { largeur: 92, hauteur: 108, rayon: "6px", liseré: "inset 0 4px 0 #f2b705,0 0 0 1px rgba(255,255,255,.15),0 16px 28px rgba(0,0,0,.6)" },
      dos: "repeating-linear-gradient(45deg,#1b1b1b 0 8px,#222 8px 16px)",
      marque: "#f2b705",
      pastille: "#f2b705",
      encrePastille: "#141414",
    },
  },

  patisserie: {
    id: "patisserie",
    label: { fr: "Pâtisserie", ar: "حلويات" },
    accent: "#9f3960", // oklch(.5 .14 0)
    accentDoux: "#f3e5ea",
    fondPage: "#f1e9f0",
    libelleAction: { fr: "Commander pour une occasion", ar: "اطلب لمناسبة" },
    filtre: {
      titre: { fr: "L'occasion", ar: "المناسبة" },
      source: { attributs: ["occasion"] },
      options: [
        { cle: "anniversaire", fr: "Anniversaire", ar: "عيد ميلاد", motsCles: ["anniv", "gateau", "عيد ميلاد", "تورتة"] },
        { cle: "mariage", fr: "Mariage", ar: "عرس", motsCles: ["mariage", "fiancailles", "عرس", "زفاف", "خطوبة"] },
        { cle: "quotidien", fr: "Tous les jours", ar: "يومي", motsCles: ["quotid", "viennois", "croissant", "pain", "يومي"] },
        { cle: "traditionnel", fr: "Traditionnel", ar: "تقليدي", motsCles: ["tradition", "baklawa", "makroud", "ghraiba", "kaak", "تقليدي", "بقلاوة", "مقروض", "غريبة", "كعك"] },
      ],
    },
    scene: {
      titre: { fr: "Présentoir à gâteaux 360°", ar: "حامل الحلويات الدوّار 360°" },
      suspendu: false,
      fond: "radial-gradient(70% 55% at 50% 40%,#fff,transparent 70%),linear-gradient(180deg,#fbe8e4,#f4d6d0)",
      mur: "oklch(.55 .14 0 / .5)",
      lampe: "rgba(255,240,230,1)",
      cone: "linear-gradient(180deg,rgba(255,255,255,.6),transparent 85%)",
      disque: "radial-gradient(circle,#fff 0 55%,#fbe3e6 56% 70%,#fff 71%)",
      bord: "#e7bfc6",
      ombreDisque: "0 0 0 3px #f1c9cf,0 16px 30px rgba(140,60,70,.25)",
      carte: { largeur: 92, hauteur: 92, rayon: "50%", liseré: "0 0 0 4px #fff,0 0 0 5px #f1c9cf,0 14px 24px rgba(140,60,70,.3)" },
      dos: "radial-gradient(circle,#fff,#fbe3e6)",
      marque: "oklch(.55 .14 0)",
      pastille: "oklch(.55 .14 0)",
      encrePastille: "#fff",
    },
  },

  animalerie: {
    id: "animalerie",
    label: { fr: "Animalerie", ar: "حيوانات أليفة" },
    accent: "#006b6c", // oklch(.47 .1 195)
    accentDoux: "#deecec",
    fondPage: "#e7ecf1",
    libelleAction: { fr: "Une question pour mon animal", ar: "اسأل عن حيواني" },
    filtre: {
      titre: { fr: "Mon animal", ar: "حيواني" },
      source: { attributs: ["animal"] },
      options: [
        { cle: "chat", fr: "Chat", ar: "قط", motsCles: ["chat", "chaton", "animaux-chats", "قط", "قطط"] },
        { cle: "chien", fr: "Chien", ar: "كلب", motsCles: ["chien", "chiot", "animaux-chiens", "كلب", "كلاب"] },
        { cle: "oiseaux", fr: "Oiseaux", ar: "طيور", motsCles: ["oiseau", "perroquet", "canari", "animaux-oiseaux", "طير", "طيور"] },
        { cle: "poissons", fr: "Poissons", ar: "أسماك", motsCles: ["poisson", "aquarium", "animaux-poissons", "سمك", "أسماك"] },
      ],
    },
    scene: {
      titre: { fr: "Manège des animaux 360°", ar: "دوّامة الحيوانات 360°" },
      suspendu: false,
      fond: "radial-gradient(70% 55% at 50% 40%,#fff,transparent 70%),linear-gradient(180deg,#fff3d6,#ffe4a8)",
      mur: "oklch(.5 .11 195 / .55)",
      lampe: "rgba(255,250,230,1)",
      cone: "linear-gradient(180deg,rgba(255,255,255,.55),transparent 85%)",
      disque: "radial-gradient(circle at 30% 30%,#fff 0 4px,transparent 5px) 0 0/22px 22px,oklch(.62 .11 195)",
      bord: "oklch(.45 .09 195)",
      ombreDisque: "0 0 0 4px #fff,0 0 0 6px oklch(.75 .14 75),0 16px 30px rgba(120,80,0,.25)",
      carte: { largeur: 88, hauteur: 108, rayon: "42% 58% 46% 54% / 40% 40% 60% 60%", liseré: "0 0 0 3px #fff,0 14px 24px rgba(120,80,0,.3)" },
      dos: "oklch(.62 .11 195)",
      marque: "#fff",
      pastille: "oklch(.75 .14 75)",
      encrePastille: "#3a2a00",
    },
  },

  sport: {
    id: "sport",
    label: { fr: "Sport", ar: "رياضة" },
    accent: "#1f600c", // oklch(.43 .13 140)
    accentDoux: "#e2eadf",
    fondPage: "#e9ebeb",
    libelleAction: { fr: "Demander conseil", ar: "اسأل البائع" },
    filtre: {
      titre: { fr: "Mon sport", ar: "رياضتي" },
      source: { attributs: ["sport"] },
      options: [
        { cle: "course", fr: "Course", ar: "جري", motsCles: ["course", "running", "jogging", "جري"] },
        { cle: "foot", fr: "Football", ar: "كرة", motsCles: ["foot", "ballon", "crampon", "كرة"] },
        { cle: "salle", fr: "Musculation", ar: "قاعة", motsCles: ["muscu", "fitness", "halter", "gym", "قاعة"] },
        { cle: "natation", fr: "Natation", ar: "سباحة", motsCles: ["natation", "piscine", "maillot", "سباحة"] },
      ],
    },
    scene: {
      titre: { fr: "Podium des champions 360°", ar: "منصّة الأبطال 360°" },
      suspendu: false,
      fond: "radial-gradient(40% 30% at 15% 0,rgba(255,255,255,.25),transparent),radial-gradient(40% 30% at 85% 0,rgba(255,255,255,.25),transparent),linear-gradient(180deg,#0f1110,#18201a)",
      mur: "oklch(.89 .2 125 / .55)",
      lampe: "rgba(230,255,200,.9)",
      cone: "linear-gradient(180deg,rgba(220,255,170,.16),transparent 85%)",
      disque: "radial-gradient(circle,#1d231f 0 70%,transparent 71%),conic-gradient(oklch(.89 .2 125),#2a3a20,oklch(.89 .2 125),#2a3a20,oklch(.89 .2 125))",
      bord: "#060806",
      ombreDisque: "0 0 0 2px oklch(.89 .2 125),0 0 30px oklch(.8 .2 130)",
      carte: { largeur: 82, hauteur: 124, rayon: "6px", liseré: "0 0 0 1px oklch(.89 .2 125 / .6),0 16px 28px rgba(0,0,0,.6)" },
      dos: "linear-gradient(160deg,#1d231f,#0f1110)",
      marque: "oklch(.89 .2 125)",
      pastille: "oklch(.89 .2 125)",
      encrePastille: "#0f1110",
    },
  },

  location: {
    id: "location",
    label: { fr: "Location", ar: "كراء" },
    accent: "#294778", // oklch(.4 .09 260)
    accentDoux: "#e3e7ed",
    fondPage: "#eaeaf1",
    libelleAction: { fr: "Vérifier la disponibilité", ar: "تحقّق من التوفّر" },
    filtre: {
      titre: { fr: "Que voulez-vous louer ?", ar: "ماذا تريد أن تكتري؟" },
      source: { attributs: ["type"] },
      options: [
        { cle: "voitures", fr: "Voitures", ar: "سيارات", motsCles: ["voiture", "auto", "location-voitures", "سيارة", "سيارات"] },
        { cle: "fetes", fr: "Fêtes", ar: "أفراح", motsCles: ["fete", "mariage", "location-fetes", "أفراح", "عرس"] },
        { cle: "son", fr: "Sonorisation", ar: "صوت", motsCles: ["sono", "enceinte", "micro", "location-sonorisation", "صوت"] },
        { cle: "camping", fr: "Camping", ar: "تخييم", motsCles: ["camping", "tente", "location-camping", "تخييم", "خيمة"] },
      ],
    },
    scene: {
      titre: { fr: "Showroom de location 360°", ar: "معرض الكراء 360°" },
      suspendu: false,
      fond: "radial-gradient(70% 55% at 50% 40%,rgba(230,190,110,.22),transparent 70%),linear-gradient(180deg,#0b1220,#141e33)",
      mur: "rgba(230,190,110,.5)",
      lampe: "rgba(255,225,170,.85)",
      cone: "linear-gradient(180deg,rgba(255,225,170,.18),transparent 85%)",
      disque: "radial-gradient(circle,#18233b 0 66%,transparent 67%),repeating-conic-gradient(#e6be6e 0 2deg,#18233b 2deg 15deg)",
      bord: "#070b14",
      ombreDisque: "0 0 0 2px #e6be6e,0 20px 40px rgba(0,0,0,.55)",
      carte: { largeur: 98, hauteur: 100, rayon: "12px", liseré: "0 0 0 1px rgba(230,190,110,.5),0 16px 28px rgba(0,0,0,.55)" },
      dos: "linear-gradient(160deg,#1c2945,#0b1220)",
      marque: "#e6be6e",
      pastille: "linear-gradient(90deg,#f1d79c,#e6be6e)",
      encrePastille: "#0b1220",
    },
  },
};

/**
 * Les réglages facultatifs d'une scène, complétés par les valeurs du
 * handoff (scène sombre, Pause visible, voile noir de profondeur) : ce que
 * toutes les vitrines sauf Mode utilisent sans rien déclarer.
 */
export function reglagesScene(scene: SceneVitrine) {
  return {
    controles: scene.controles ?? true,
    vitesse: scene.vitesse ?? -14,
    brume: scene.brume ?? { couleur: "#000000", max: 0.55 },
    sol:
      scene.sol ??
      (scene.suspendu
        ? "radial-gradient(closest-side,rgba(255,230,190,.25),transparent)"
        : "radial-gradient(closest-side,rgba(255,255,255,.18),transparent)"),
    luminaire: scene.luminaire === undefined ? "#0f0c13" : scene.luminaire,
    fondCarte: scene.fondCarte ?? "#2c2736",
    fondSansPhoto: "linear-gradient(160deg,#4a4458,#2c2736)",
    etiquette: scene.etiquette ?? { fond: "linear-gradient(180deg,transparent,rgba(12,8,16,.86))", texte: "#ffffff" },
    metal: scene.metal ?? { ...OR, socleCentre: "#2a2431" },
  };
}
