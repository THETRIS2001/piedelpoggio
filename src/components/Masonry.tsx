import { useEffect, useState, useRef, useMemo } from 'react';
import './Masonry.css';
import Lightbox from './Lightbox';

interface MasonryItem {
  id: string;
  img: string;
  url: string;
  orig?: string;
  folderHref?: string;
  height?: number; // Added height property
}

// Restore all props to avoid breaking consumers, even if some are unused in this implementation
interface MasonryProps {
  items?: MasonryItem[];
  source?: 'media' | 'static';
  limit?: number;
  ease?: string;
  duration?: number;
  stagger?: number;
  animateFrom?: string;
  scaleOnHover?: boolean;
  hoverScale?: number;
  blurToFocus?: boolean;
  colorShiftOnHover?: boolean;
}

const getRandomHeight = () => {
  const heights = [260, 280, 290, 300, 320, 340, 360, 380, 400, 420, 440, 460, 480, 520, 550];
  return heights[Math.floor(Math.random() * heights.length)];
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

  // Layout state
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [columns, setColumns] = useState(1);
  // Store computed positions: { [itemId]: { top, left, width, height } }
  const [positions, setPositions] = useState<Record<string, { top: number; left: number; width: number; height: number }>>({});

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
            
            const size = Number(f.size || 0)
            
            // STRICT CHECK: Solo immagini valide e sotto 1MB
            if (size <= 0 || size > 1024 * 1024) continue;
            
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
            folderHref: `/media/${it.folder}`,
            height: getRandomHeight() // Assign random height for layout
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

  // Resize Observer to update column count
  useEffect(() => {
    if (!containerRef.current) return;

    const updateColumns = () => {
      const width = window.innerWidth;
      if (width >= 1280) setColumns(5); // xl
      else if (width >= 1024) setColumns(4); // lg
      else if (width >= 768) setColumns(3); // md
      else if (width >= 640) setColumns(2); // sm
      else setColumns(1);
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  // Calculate layout
  useEffect(() => {
    if (itemsData.length === 0 || !containerRef.current) return;

    // We assume 100% width of container, divided by columns with some gap
    // Actually, to replicate previous exact look, we need to know container width
    const containerWidth = containerRef.current.offsetWidth;
    const gap = 16; // 1rem = 16px
    const totalGap = (columns - 1) * gap;
    const columnWidth = (containerWidth - totalGap) / columns;

    const colHeights = new Array(columns).fill(0);
    const newPositions: Record<string, { top: number; left: number; width: number; height: number }> = {};

    itemsData.forEach(item => {
      // Find shortest column
      const minHeight = Math.min(...colHeights);
      const colIndex = colHeights.indexOf(minHeight);

      const top = minHeight;
      const left = colIndex * (columnWidth + gap);
      const height = item.height || 200; // Fallback height

      newPositions[item.id] = { top, left, width: columnWidth, height };
      
      // Update column height with item height + gap
      colHeights[colIndex] += height + gap;
    });

    setPositions(newPositions);
    setContainerHeight(Math.max(...colHeights));

  }, [itemsData, columns]); // Recalculate when items or columns change

  // Re-calculate on window resize (via container width change)
  useEffect(() => {
    const handleResize = () => {
       // Force re-layout by toggling a state or relying on column change?
       // Actually, column width depends on container width.
       // We can just rely on the existing effect if we include window width dependency or rely on resize event
       // But 'columns' state update might not happen if breakpoint doesn't change, yet width changes.
       // So we need to listen to resize and force update.
       // Simplest is to pass a key or just trigger update.
       // Let's rely on setColumns for breakpoints, but for fluid width we need to re-run layout.
       // We'll add a resize listener specifically for layout.
       
       // Actually, simpler:
       if (containerRef.current && itemsData.length > 0) {
          // Logic duplicated from above effect, or extract to function.
          // For now, let's just accept that 'columns' change triggers layout. 
          // If container width changes smoothly without breakpoint change, the layout might stretch or misalign 
          // unless we re-calculate 'columnWidth'.
          // So let's extract the layout logic.
       }
    };
    
    // Better: use a ResizeObserver on the container
    const observer = new ResizeObserver(() => {
        // Trigger layout update
        // We can just update a counter state to force effect
        setLayoutTick(t => t + 1);
    });
    
    if (containerRef.current) {
        observer.observe(containerRef.current);
    }
    
    return () => observer.disconnect();
  }, []);

  const [layoutTick, setLayoutTick] = useState(0);

  // Merged layout effect
  useEffect(() => {
    if (itemsData.length === 0 || !containerRef.current) return;

    const containerWidth = containerRef.current.offsetWidth;
    const gap = 16;
    const totalGap = (columns - 1) * gap;
    const columnWidth = (containerWidth - totalGap) / columns;

    const colHeights = new Array(columns).fill(0);
    const newPositions: Record<string, { top: number; left: number; width: number; height: number }> = {};

    itemsData.forEach(item => {
      const minHeight = Math.min(...colHeights);
      const colIndex = colHeights.indexOf(minHeight);

      const top = minHeight;
      const left = colIndex * (columnWidth + gap);
      const height = item.height || 300; 

      newPositions[item.id] = { top, left, width: columnWidth, height };
      colHeights[colIndex] += height + gap;
    });

    setPositions(newPositions);
    setContainerHeight(Math.max(...colHeights));
  }, [itemsData, columns, layoutTick]);


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
     // Return empty container with min height to avoid collapse
     return <div className="masonry-container relative w-full" style={{ minHeight: '200px' }}></div>
  }

  if (itemsData.length === 0) {
    return <div className="text-center py-10 text-gray-500">Nessuna immagine trovata</div>
  }

  return (
    <>
      <div 
        ref={containerRef} 
        className="masonry-container relative w-full" 
        style={{ height: containerHeight }}
      >
        {itemsData.map((item) => {
          const pos = positions[item.id];
          if (!pos) return null; // Wait for layout

          return (
            <div 
              key={item.id} 
              className="masonry-item absolute rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              style={{
                top: pos.top,
                left: pos.left,
                width: pos.width,
                height: pos.height
              }}
              onClick={() => handleImageClick(item)}
            >
              <img 
                src={item.img} 
                alt={item.id}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          );
        })}
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
