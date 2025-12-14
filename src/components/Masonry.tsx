import { useEffect, useState } from 'react';
import './Masonry.css';
import Lightbox from './Lightbox';

interface MasonryItem {
  id: string;
  img: string;
  url: string;
  orig?: string;
  folderHref?: string;
}

interface MasonryProps {
  items?: MasonryItem[];
  source?: 'media' | 'static';
  limit?: number;
}

const Masonry: React.FC<MasonryProps> = ({
  items = [],
  source = 'static',
  limit = 12
}) => {
  const [itemsData, setItemsData] = useState<MasonryItem[]>(source === 'media' ? [] : items)
  const [loading, setLoading] = useState(source === 'media')
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);
  const [selectedFolderHref, setSelectedFolderHref] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (source !== 'media') return
    
    const fetchData = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/media?list=events')
        const data = await res.json()
        const events = Array.isArray(data.events) ? data.events : []
        
        // 1. Raccogli TUTTE le immagini valide (< 1MB) da TUTTI gli eventi
        const validImages: Array<{ folder: string; name: string; url: string }> = []
        
        for (const ev of events) {
          const folder = String(ev.folder || '')
          const files = Array.isArray(ev.files) ? ev.files : []
          
          for (const f of files) {
            const name = String(f.name || '')
            // Ignora video
            if (/\.(mp4|webm|ogg)$/i.test(name)) continue
            
            // CONTROLLO DIMENSIONE
            // Il server ci deve passare la size. Se non c'è o è 0, assumiamo sia valida per sicurezza
            // o la scartiamo? L'utente dice "ci sono al 100%".
            // Se size > 1MB scartiamo. 
            const size = Number(f.size || 0)
            
            // Logica semplificata: se abbiamo il size ed è > 1MB, SKIP.
            // Se size è 0 o undefined (non rilevato), la includiamo (beneficio del dubbio)
            // oppure la scartiamo se vogliamo essere rigidi.
            // Dato il problema precedente, assumiamo che se size c'è, lo rispettiamo.
            if (size > 1024 * 1024) continue;
            
            validImages.push({
              folder,
              name,
              url: String(f.url || '')
            })
          }
        }
        
        // 2. Mischia tutto
        const shuffled = validImages.sort(() => Math.random() - 0.5)
        
        // 3. Prendi le prime N
        const selected = shuffled.slice(0, limit)

        const out: MasonryItem[] = selected.map(it => ({
            id: `${it.folder}/${it.name}`, 
            img: it.url, 
            url: it.url, 
            orig: it.url, 
            folderHref: `/media/${it.folder}` 
        }))
        
        setItemsData(out)
      } catch (e) {
        console.error("Masonry fetch error", e)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [source, limit])

  const handleImageClick = (item: MasonryItem) => {
    const src = item.orig || item.img
    setSelectedImage({ src, alt: `Foto di Piedelpoggio ${item.id}` });
    setSelectedFolderHref(item.folderHref)
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setSelectedImage(null);
  };

  if (loading) {
    return (
      <div className="masonry-grid">
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="masonry-item-skeleton animate-pulse bg-gray-200 rounded-xl mb-4" style={{ height: '300px' }}></div>
        ))}
      </div>
    )
  }

  if (itemsData.length === 0) {
    return <div className="text-center py-10 text-gray-500">Nessuna immagine trovata</div>
  }

  return (
    <>
      <div className="masonry-grid">
        {itemsData.map((item) => (
          <div 
            key={item.id} 
            className="masonry-item mb-4 break-inside-avoid"
            onClick={() => handleImageClick(item)}
          >
            <img 
              src={item.img} 
              alt={item.id}
              className="w-full h-auto rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              loading="lazy"
            />
          </div>
        ))}
      </div>

      <Lightbox
        isOpen={lightboxOpen}
        imageSrc={selectedImage?.src || ''}
        imageAlt={selectedImage?.alt || ''}
        onClose={closeLightbox}
        folderHref={selectedFolderHref}
      />
    </>
  );
};

export default Masonry;