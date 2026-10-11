/* ==========================================================================
   portfolio-data.js — the ONLY place project content lives.

   js/portfolio.js renders the #portfolio deck and the case-study dialog from
   this array. To swap or add a project, edit an entry here (and drop its
   media into assets/portfolio/) — nothing else needs to change.

   type    "demo"   -> chip "Koncepció"      (own concept work)
           "client" -> chip "Ügyfélprojekt"  (real client)
   url     the live demo address. Stored for reference only — it is NOT
           linked anywhere on the page.
   addressLabel  optional text for the address pill in the browser-window mockup
                 (e.g. "clientdomain.hu"). Empty string = no pill at all. All
                 current projects are concept work, so it is empty for them.
   addressHref   optional. With a label AND an href the pill is a real link
                 (opens in a new tab) in the case-study dialog; with only a
                 label it is plain, non-clickable text. (Inside the stacked
                 cards the whole window is one button, and a link may not
                 live inside a button — there the pill is always plain text.)
   accent  the project's own brand colour (read from its stylesheet); drives
           the card glow, labels and the dialog glow via --accent.
   ========================================================================== */
window.PF_PROJECTS = [
  {
    slug: 'aurum',
    type: 'demo',
    name: 'Aurum Birtok',
    category: 'Luxusingatlan',
    accent: '#E4B15A',
    url: 'https://vargagyorgy1204-create.github.io/aurumbirtok/',
    addressLabel: '',
    addressHref: '',
    task: 'Egy prémium ingatlanközvetítőnek olyan oldal kell, amely már az első képernyőn exkluzív élményt ad, és méltó módon mutatja be a válogatott ingatlanokat.',
    solution: 'Filmszerű, teljes képernyős képek, elegáns szerif tipográfia, részletes ingatlankártyák és visszafogott, prémium animációk.',
    chips: ['Ingatlankártyák', 'Prémium tipográfia', 'Reszponzív'],
    caseStudy: {
      start: 'A luxusingatlanok vásárlói a hangulatra és a részletekre figyelnek – egy átlagos sablonoldal itt bizalmat rombol.',
      solution: 'Teljes képernyős hero, letisztult szerkezet, kiemelt számok és könnyen áttekinthető ingatlanlista, mindez sok levegővel és finom mozgással.',
      result: 'Olyan oldal, amely a kínált ingatlanok szintjét tükrözi, és egyértelműen a kapcsolatfelvétel felé vezeti a látogatót.'
    },
    media: {
      hero: 'assets/portfolio/hero-aurum.jpg',
      hero960: 'assets/portfolio/hero-aurum-960.jpg',
      shots: ['assets/portfolio/shot-aurum-2.jpg', 'assets/portfolio/shot-aurum-3.jpg'],
      loop: 'assets/portfolio/loop-aurum.webm'
    }
  },
  {
    slug: 'lakatos',
    type: 'demo',
    name: 'Lakatos Gábor',
    category: 'Borbély',
    accent: '#C8602A',
    url: 'https://vargagyorgy1204-create.github.io/lakatosgabor/',
    addressLabel: '',
    addressHref: '',
    task: 'Egy borbélyműhelynek olyan oldal kell, amely első pillantásra átadja a hely hangulatát, és pár kattintással időpontfoglaláshoz vezet.',
    solution: 'Sötét, karakteres dizájn, kiemelt foglalás gomb, galéria a munkákról és átlátható árlista – mobilra optimalizálva.',
    chips: ['Időpontfoglalás', 'Galéria', 'Árlista'],
    caseStudy: {
      start: 'Egy borbélynál a vendég többnyire telefonról, pár másodperc alatt dönt – a hangulatnak és a foglalásnak azonnal látszania kell.',
      solution: 'Karakteres tipográfia, sötét prémium színvilág, minden képernyőről elérhető foglalás gomb, galéria, árlista és közösségi linkek.',
      result: 'Egy oldal, amely a műhely stílusát adja át, és bárhonnan egy kattintásra van a foglalástól.'
    },
    media: {
      hero: 'assets/portfolio/hero-lakatos.jpg',
      hero960: 'assets/portfolio/hero-lakatos-960.jpg',
      shots: ['assets/portfolio/shot-lakatos-2.jpg', 'assets/portfolio/shot-lakatos-3.jpg'],
      loop: 'assets/portfolio/loop-lakatos.webm'
    }
  },
  {
    slug: 'fenyes',
    type: 'demo',
    name: 'Fényes',
    category: 'Takarítócég',
    accent: '#14B8A6',
    url: 'https://vargagyorgy1204-create.github.io/fenyes/',
    addressLabel: '',
    addressHref: '',
    task: 'Egy több városban működő takarítócégnek olyan oldal kell, amely bizalmat épít, és egy helyen mutatja be a szolgáltatásokat és az irodákat.',
    solution: 'Barátságos, letisztult dizájn, irodák és elérhetőségek a fejlécben, szolgáltatáskártyák, vélemények és gyors kapcsolatfelvétel.',
    chips: ['Több iroda', 'Vélemények', 'Gyors kapcsolat'],
    caseStudy: {
      start: 'Takarítócéget az emberek a bizalom alapján választanak – a látogatónak éreznie kell, hogy megbízható, elérhető csapattal van dolga.',
      solution: 'Világos szerkezet, kiemelt ügyfélszolgálat gomb, irodánkénti elérhetőségek, szolgáltatások áttekinthető kártyákon és vélemények.',
      result: 'Egy oldal, ahol a látogató gyorsan megtalálja a hozzá legközelebbi irodát, és azonnal kapcsolatba léphet.'
    },
    media: {
      hero: 'assets/portfolio/hero-fenyes.jpg',
      hero960: 'assets/portfolio/hero-fenyes-960.jpg',
      shots: ['assets/portfolio/shot-fenyes-2.jpg', 'assets/portfolio/shot-fenyes-3.jpg'],
      loop: 'assets/portfolio/loop-fenyes.webm'
    }
  },
  {
    slug: 'kitakaritunk',
    type: 'demo',
    name: 'Kitakarítunk',
    category: 'Takarítás',
    accent: '#3871C1',
    url: 'https://vargagyorgy1204-create.github.io/kitakaritunk/',
    addressLabel: '',
    addressHref: '',
    task: 'Egy takarítási szolgáltatónak magánszemélyeket és cégeket is meg kell szólítania, mindkettőjüknek a saját ajánlatával.',
    solution: 'Otthon / Iroda váltó, szolgáltatások típusonként rendezve, áttekinthető árak és egyértelmű rendelés gomb.',
    chips: ['Otthon / Iroda váltó', 'Szolgáltatáslista', 'Árak és rendelés'],
    caseStudy: {
      start: 'Egy családnak és egy irodának teljesen más takarításra van szüksége – egyetlen általános oldal egyiküket sem szólítja meg igazán.',
      solution: 'A fejlécben váltható Otthon / Iroda nézet, szolgáltatások típus szerint (felújítás utáni, nagytakarítás, ablaktisztítás stb.), világos, levegős dizájn.',
      result: 'Mindkét célcsoport a saját igényeire szabott tartalmat látja, és gyorsan megrendelheti a szolgáltatást.'
    },
    media: {
      hero: 'assets/portfolio/hero-kitakaritunk.jpg',
      hero960: 'assets/portfolio/hero-kitakaritunk-960.jpg',
      shots: ['assets/portfolio/shot-kitakaritunk-2.jpg', 'assets/portfolio/shot-kitakaritunk-3.jpg'],
      loop: 'assets/portfolio/loop-kitakaritunk.webm'
    }
  },
  {
    slug: 'othon',
    type: 'demo',
    name: 'Othon Kft.',
    category: 'Ingatlaniroda',
    accent: '#3D68F0',
    url: 'https://vargagyorgy1204-create.github.io/othonkft/',
    addressLabel: '',
    addressHref: '',
    task: 'Egy ingatlanirodának olyan oldal kell, ahol a látogató azonnal keresni kezdhet az ingatlanok között.',
    solution: 'A hero-ba épített keresősáv, kiemelt ajánlatok, bizalmat építő számok és modern, naplementés hangulatú megjelenés.',
    chips: ['Ingatlankereső', 'Kiemelt ajánlatok', 'Reszponzív'],
    caseStudy: {
      start: 'Aki ingatlanirodai oldalra érkezik, konkrét ingatlant keres – nem akar görgetni, hogy elkezdhesse.',
      solution: 'Keresés már az első képernyőn (típus, helyszín, ár), kiemelt prémium ajánlatok, tapasztalatot és eredményeket mutató számok.',
      result: 'A látogató az első másodpercben a keresésnél van, az iroda pedig profi, megbízható képet mutat.'
    },
    media: {
      hero: 'assets/portfolio/hero-othon.jpg',
      hero960: 'assets/portfolio/hero-othon-960.jpg',
      shots: ['assets/portfolio/shot-othon-2.jpg', 'assets/portfolio/shot-othon-3.jpg'],
      loop: 'assets/portfolio/loop-othon.webm'
    }
  },
  {
    slug: 'fitass',
    type: 'demo',
    name: 'Fitass',
    category: 'Fitnesz',
    accent: '#CA8A04',
    url: 'https://vargagyorgy1204-create.github.io/fitass/',
    addressLabel: '',
    addressHref: '',
    task: 'Egy edzőteremnek energikus oldal kell, amely motivál, és bemutatja az edzéslehetőségeket.',
    solution: 'Sötét alap arany kiemelésekkel, elegáns tipográfia, mozgó sávok és az edzéstípusok, edzők áttekinthető bemutatása.',
    chips: ['Edzéstípusok', 'Edzők bemutatása', 'Reszponzív'],
    caseStudy: {
      start: 'Egy edzőterem weboldalának ugyanazt az energiát kell átadnia, mint maga a terem – egy unalmas oldal senkit nem motivál.',
      solution: 'Sötét alap arany akcentusokkal, erős tipográfia, mozgás és az edzéslehetőségek, edzők világos bemutatása.',
      result: 'Egy oldal, amely már görgetés közben kedvet csinál az edzéshez, és a jelentkezés felé vezet.'
    },
    media: {
      hero: 'assets/portfolio/hero-fitass.jpg',
      hero960: 'assets/portfolio/hero-fitass-960.jpg',
      shots: ['assets/portfolio/shot-fitass-2.jpg', 'assets/portfolio/shot-fitass-3.jpg'],
      loop: 'assets/portfolio/loop-fitass.webm'
    }
  }
];
