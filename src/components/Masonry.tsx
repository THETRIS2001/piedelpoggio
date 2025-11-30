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
  colorShiftOnHover = false
}) => {
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

    const gridItems = items.map(child => {
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
  }, [columns, items, width]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMouseEnter = (item: MasonryItem) => {
    // CSS hover effects will handle the animations
  };

  const handleMouseLeave = (item: MasonryItem) => {
    // CSS hover effects will handle the animations
  };

  const handleImageClick = (item: MasonryItem) => {
    setSelectedImage({ src: item.img, alt: `Foto di Piedelpoggio ${item.id}` });
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
            style={{ cursor: 'pointer', width: '100%', height: '100%' }}
          >
            <img
              src={item.img}
              alt={`Foto di Piedelpoggio ${item.id}`}
              className="masonry-image"
              loading="lazy"
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
      />
    </div>
  );
};

export default Masonry;
