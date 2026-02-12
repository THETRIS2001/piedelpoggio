# Specifiche Tecniche Icone - Pagina Storia

Questo documento descrive le caratteristiche tecniche delle icone presenti nella pagina `storia.astro` per garantire coerenza stilistica nelle future implementazioni.

| Caratteristica | Icona Titolo Principale ("STORIA DI PIEDELPOGGIO") | Icona Sezione ("Piedelpoggio: Storia, Vita...") |
| :--- | :--- | :--- |
| **Visibilità** | Nascosta su mobile (`hidden`), visibile da tablet in su (`md:flex`) | Sempre visibile |
| **Dimensioni Contenitore** | Fisse: **80x80px** (`w-20 h-20`) | Responsive: **48x48px** su mobile (`w-12 h-12`), **64x64px** su tablet/pc (`sm:w-16 sm:h-16`) |
| **Sfumatura (Gradient)** | Diagonale: Ambra → Arancione scuro (`bg-gradient-to-br from-amber-500 to-orange-600`) | Identica: Ambra → Arancione scuro (`bg-gradient-to-br from-amber-500 to-orange-600`) |
| **Smussatura Angoli (Border Radius)** | Responsive: `rounded-xl` (mobile) → `sm:rounded-2xl` (tablet/pc) | Identica: `rounded-xl` → `sm:rounded-2xl` |
| **Ombreggiatura (Shadow)** | Molto marcata: `shadow-xl` | Marcata: `shadow-lg` (leggermente meno intensa) |
| **Margini** | Margine destro: **24px** (`mr-6`) | Nessun margine diretto sull'icona (gestito dal contenitore padre `space-x-6` = 24px) |
| **Dimensione Icona Interna SVG** | Fissa: **40x40px** (`w-10 h-10`) | Responsive: **24x24px** (`w-6 h-6`) su mobile, **32x32px** (`sm:w-8 sm:h-8`) su tablet/pc |
| **Colore Icona Interna** | Bianco (`text-white`) | Bianco (`text-white`) |
| **Posizionamento (Flex)** | `items-center justify-center` (centrata) | `items-center justify-center` (centrata), contenitore padre `flex-shrink-0` (non si schiaccia) |

## Note di Implementazione
- L'icona del titolo è pensata per essere un elemento decorativo dominante, visibile solo su schermi ampi.
- L'icona di sezione è pensata per accompagnare i titoli dei vari paragrafi, adattandosi alle dimensioni dello schermo per mantenere leggibilità e proporzioni.

NON DEVI CAMBIARE IL COLORE MA SOLO SEGUIRE LE ISTRUZIONI DI SOPRA

basandoti su queste specifiche voglio che controlli se le pagine che ti dirò seguono questgo stile. se si mi dici solo ok con spunta verde, altrimenti lo cambi e mi dici sinteticamente cosa hai cambiato. lo faremo una pagina alla volta perche in una pagina possono esserci piu icone, in base a che pagina è. se è una pagina che ha altre icone molto piu piccole perche magari riguardano sottosezioni, per ora ignoriamole perche non ci interessano

MODIFICA IL CODICE SOLO LO STRETTO NECESSARIO CHE SERVE PER SISTEMARE