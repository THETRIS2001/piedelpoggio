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

  const getRandomHeight = () => {
    const heights = [260, 280, 300, 320, 340, 360, 380, 400, 420, 440, 460, 480, 520]
    return heights[Math.floor(Math.random() * heights.length)]
  }

  useEffect(() => {
    if (source !== 'media') return
      ; (async () => {
        try {
          const res = await fetch('/api/media?list=events')
          const data = await res.json()
          const events = Array.isArray(data.events) ? data.events : []

          const validImages: MasonryItem[] = []

          for (const ev of events) {
            const folder = String(ev.folder || '')
            const files = Array.isArray(ev.files) ? ev.files : []

            for (const f of files) {
              const name = String(f.name || '')
              if (/\.(mp4|webm|ogg)$/i.test(name)) continue

              const size = Number(f.size || 0)
              if (!size || size >= 1024 * 1024) continue
              const url = String(f.url || '')

              validImages.push({
                id: `${folder}/${name}`,
                img: url,
                url: url,
                height: getRandomHeight(),
                orig: url,
                folderHref: `/media/${folder}`
              })
            }
          }

          // 2. Mescola e prendi le prime N
          const shuffled = validImages.sort(() => Math.random() - 0.5).slice(0, limit)
          setItemsData(shuffled)
        } catch (e) {
          console.error("Masonry error:", e)
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

  const [imageDimensions, setImageDimensions] = useState<Record<string, number>>({});

  const handleImageLoad = (id: string, event: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    const ratio = naturalHeight / naturalWidth;
    setImageDimensions(prev => {
      if (prev[id] === ratio) return prev;
      return { ...prev, [id]: ratio };
    });
  };

  const grid = useMemo(() => {
    if (!width) return { items: [], maxHeight: 0 };

    const colHeights = new Array(columns).fill(0);
    const gap = 16;
    const columnWidth = (width - gap * (columns - 1)) / columns;

    const srcItems = source === 'media' ? itemsData : items;

    // Explicitly calculate positions using full height
    const gridItems = srcItems.map(child => {
      // Find the shortest column
      const minH = Math.min(...colHeights);
      const col = colHeights.indexOf(minH);

      const x = col * (columnWidth + gap);

      // Calculate height based on aspect ratio if available, otherwise use provided height
      const ratio = imageDimensions[child.id];
      const height = ratio ? columnWidth * ratio : child.height;

      const y = colHeights[col];

      // Update column height
      colHeights[col] += height + gap;

      return { ...child, x, y, w: columnWidth, h: height };
    });

    const maxHeight = Math.max(...colHeights);

    return { items: gridItems, maxHeight };
  }, [columns, items, itemsData, source, width, imageDimensions]);

  useLayoutEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.height = `${grid.maxHeight}px`;
    }
  }, [grid.maxHeight]);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      {grid.items.map((item, index) => (
        <div
          key={item.id}
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
              onLoad={(e) => handleImageLoad(item.id, e)}
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
