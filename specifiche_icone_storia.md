# Specifiche Tecniche Icone

| Caratteristica | Icona Titolo Principale | Icona Sezione |
| :--- | :--- | :--- |
| **Dimensioni Contenitore** | Fisse: **80x80px** (`w-20 h-20`) | Responsive: **48x48px** su mobile (`w-12 h-12`), **64x64px** su tablet/pc (`sm:w-16 sm:h-16`) |
| **Dimensione Icona Interna SVG** | Fissa: **40x40px** (`w-10 h-10`) | Responsive: **24x24px** (`w-6 h-6`) su mobile, **32x32px** (`sm:w-8 sm:h-8`) su tablet/pc |
| **Smussatura Angoli (Border Radius)** | Responsive: `rounded-xl` (mobile) → `sm:rounded-2xl` (tablet/pc) | Identica: `rounded-xl` → `sm:rounded-2xl` |
| **Ombreggiatura (Shadow)** | Molto marcata: `shadow-xl` | Marcata: `shadow-lg` (leggermente meno intensa) |
| **Margini** | Margine destro: **24px** (`mr-6`) | Nessun margine diretto sull'icona (gestito dal contenitore padre `space-x-6` = 24px) |