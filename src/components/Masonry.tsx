import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './Masonry.css';
import Lightbox from './Lightbox';

const useMedia = (queries: string[], values: number[], defaultValue: number) => {
  const get = () => {
    if (typeof window === 'undefined') return defaultValue;
    return values[queries.findIndex(q => matchMedia(q).matches)] ?? defaultValue;
  };

  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    setValue(get());
    
    const handler = () => setValue(get);
    queries.forEach(q => matchMedia(q).addEventListener('change', handler));
    return () => queries.forEach(q => matchMedia(q).removeEventListener('change', handler));
  }, [queries]);

  return value;
};

const useMeasure = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return [ref, size] as const;
};

interface MasonryItem {
  id: string;
  img: string;
  url: string;
  height: number;
  orig?: string;
  folderHref?: string;
}

interface MasonryProps {
  items: MasonryItem[];
  ease?: string;
  duration?: number;
  stagger?: number;
  animateFrom?: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'random';
  scaleOnHover?: boolean;
  hoverScale?: number;
  blurToFocus?: boolean;
  colorShiftOnHover?: boolean;
  source?: 'media' | 'static';
  limit?: number;
}

const Masonry: React.FC<MasonryProps> = ({
  items,
  ease = 'ease-out',
  duration = 0.6,
  stagger = 0.05,
  animateFrom = 'bottom',
  scaleOnHover = true,
  hoverScale = 0.95,
  blurToFocus = true,
  colorShiftOnHover = false,
  source = 'static',
  limit = 12
}) => {
  const [itemsData, setItemsData] = useState<MasonryItem[]>(source === 'media' ? [] : (items || []))
  const [loading, setLoading] = useState(source === 'media')
  
  const getRandomHeight = () => {
    const heights = [260, 280, 300, 320, 340, 360, 380, 400, 420, 440, 460, 480, 520]
    return heights[Math.floor(Math.random() * heights.length)]
  }

  useEffect(() => {
    if (source !== 'media') return
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/media?list=events')
        const data = await res.json()
        const events = Array.isArray(data.events) ? data.events : []
        
        // Costruiamo il pool di file validi
        const filesPool: Array<{ folder: string; name: string; url: string; size?: number }> = []
        
        for (const ev of events) {
          const folder = String(ev.folder || '')
          const files = Array.isArray(ev.files) ? ev.files : []
          for (const f of files) {
            const name = String(f.name || '')
            // Escludiamo video
            if (/\.(mp4|webm|ogg)$/i.test(name)) continue
            
            // FILTRO CRITICO: Solo immagini < 1MB
            // Il server ora ci manda il size. Se non c'è size, per sicurezza scartiamo.
            const size = Number(f.size || 0)
            if (size > 0 && size < 1024 * 1024) {
               filesPool.push({ 
                 folder, 
                 name, 
                 url: String(f.url || ''), 
                 size 
               })
            }
          }
        }
        
        // Ora abbiamo SOLO immagini sicure. Ne prendiamo random quante ne servono.
        const shuffled = filesPool.sort(() => Math.random() - 0.5)
        const selected = shuffled.slice(0, limit)

        const out: MasonryItem[] = selected.map(it => ({
            id: `${it.folder}/${it.name}`, 
            img: it.url, 
            url: it.url, 
            height: getRandomHeight(), 
            orig: it.url, 
            folderHref: `/media/${it.folder}` 
        }))
        
        setItemsData(out)
      } catch {
      } finally {
        setLoading(false)
      }
    })()
  }, [source, limit])

  const columns = useMedia(
    ['(min-width:1500px)', '(min-width:1000px)', '(min-width:600px)', '(min-width:400px)'],
    [5, 4, 3, 2],
    1
  );

  const [containerRef, { width }] = useMeasure();
  const [mounted, setMounted] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);


  const grid = useMemo(() => {
    if (!width) return [];

    const colHeights = new Array(columns).fill(0);
    const gap = 16; // Spazio tra le immagini
    const columnWidth = (width - gap * (columns - 1)) / columns;

    const srcItems = source === 'media' ? itemsData : items
    const gridItems = srcItems.map(child => {
      const col = colHeights.indexOf(Math.min(...colHeights));
      const x = col * (columnWidth + gap);
      const height = child.height / 2;
      const y = colHeights[col];

      colHeights[col] += height + gap; // Aggiungi gap verticale

      return { ...child, x, y, w: columnWidth, h: height };
    });

    // Calcola l'altezza totale necessaria
    const maxHeight = Math.max(...colHeights);
    
    // Aggiorna l'altezza del container
    if (containerRef.current) {
      containerRef.current.style.height = `${maxHeight}px`;
    }

    return gridItems;
  }, [columns, items, itemsData, source, width]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMouseEnter = (item: MasonryItem) => {
    // CSS hover effects will handle the animations
  };

  const handleMouseLeave = (item: MasonryItem) => {
    // CSS hover effects will handle the animations
  };

  const [selectedFolderHref, setSelectedFolderHref] = useState<string | undefined>(undefined)
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
      <div className="grid grid-cols-2 min-[600px]:grid-cols-3 min-[1000px]:grid-cols-4 min-[1500px]:grid-cols-5 gap-4 p-4">
        {Array.from({ length: limit || 12 }).map((_, i) => (
          <div 
            key={i} 
            className="animate-pulse bg-gray-200 rounded-lg" 
            style={{ height: `${getRandomHeight()}px` }}
          ></div>
        ))}
      </div>
    )
  }

  // Force re-calculation of grid layout after loading
  // When loading finishes, we might have items but width/height calculation needs to run
  if (!loading && itemsData.length > 0 && grid.length === 0 && width > 0) {
     // This is just a safeguard, usually useMemo handles it.
     // But if grid is empty despite having items and width, something is wrong.
  }

  return (
    <div className="masonry-container" ref={containerRef} style={{ minHeight: '600px' }}>
      {grid.length === 0 && !loading && itemsData.length === 0 && (
         <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            Nessuna immagine disponibile
         </div>
      )}
      {grid.map((item, index) => (
        <div
          key={item.id}
          data-key={item.id}
          className={`masonry-item ${mounted ? 'masonry-item-visible' : ''}`}
          style={{
            position: 'absolute',
            left: item.x,
            top: item.y,
            width: item.w,
            height: item.h,
            animationDelay: `${index * stagger}s`,
            '--hover-scale': hoverScale,
          } as React.CSSProperties}
          onMouseEnter={() => handleMouseEnter(item)}
          onMouseLeave={() => handleMouseLeave(item)}
        >
          <div 
            onClick={() => handleImageClick(item)}
            style={{ cursor: 'pointer', width: '100%', height: '100%', background: '#fff' }}
          >
            <img
              src={item.img}
              alt={`Foto di Piedelpoggio ${item.id}`}
              className="masonry-image"
              loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
            {colorShiftOnHover && <div className="color-overlay" />}
          </div>
        </div>
      ))}
      
      <Lightbox
        isOpen={lightboxOpen}
        imageSrc={selectedImage?.src || ''}
        imageAlt={selectedImage?.alt || ''}
        onClose={closeLightbox}
        folderHref={selectedFolderHref}
      />
    </div>
  );
};

export default Masonry;