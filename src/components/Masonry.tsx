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

const preloadImages = async (urls: string[]) => {
  await Promise.all(
    urls.map(
      src =>
        new Promise(resolve => {
          const img = new Image();
          img.src = src;
          img.onload = img.onerror = () => resolve(undefined);
        })
    )
  );
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
  const getRandomHeight = () => {
    const heights = [260, 280, 300, 320, 340, 360, 380, 400, 420, 440, 460, 480, 520]
    return heights[Math.floor(Math.random() * heights.length)]
  }
  const cfLowRes = (url: string) => {
    if (!url) return url
    const path = url.startsWith('/') ? url : '/' + url
    return `/cdn-cgi/image/fit=scale-down,width=500,quality=80,format=webp${path}`
  }
  useEffect(() => {
    if (source !== 'media') return
    ;(async () => {
      try {
        const res = await fetch('/api/media?list=events')
        const data = await res.json()
        const events = Array.isArray(data.events) ? data.events : []
        const photos: MasonryItem[] = []
        const isLarge = async (src: string) => {
          try {
            const r = await fetch(src, { method: 'HEAD', cache: 'no-store' })
            const cl = Number(r.headers.get('content-length') || '0')
            return cl > 1024 * 1024
          } catch {
            return false
          }
        }
        for (const ev of events) {
          const folder = String(ev.folder || '')
          const files = Array.isArray(ev.files) ? ev.files : []
          for (const f of files) {
            const name = String(f.name || '')
            if (/\.(mp4|webm|ogg)$/i.test(name)) continue
            const orig = String(f.url || '')
            const useLow = await isLarge(orig)
            const img = useLow ? cfLowRes(orig) : orig
            photos.push({ id: `${folder}/${name}`, img, url: orig, height: getRandomHeight(), orig, folderHref: `/media/${folder}` })
          }
        }
        const shuffled = photos.sort(() => Math.random() - 0.5)
        setItemsData(shuffled.slice(0, Math.max(1, limit)))
      } catch {}
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

  return (
    <div className="masonry-container" ref={containerRef}>
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
