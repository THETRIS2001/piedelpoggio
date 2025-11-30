import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './Lightbox.css';

interface LightboxProps {
  isOpen: boolean;
  imageSrc: string;
  imageAlt: string;
  onClose: () => void;
  folderHref?: string;
}

const Lightbox: React.FC<LightboxProps> = ({ isOpen, imageSrc, imageAlt, onClose, folderHref }) => {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      
      // Carica l'immagine per ottenere le dimensioni originali
      const img = new Image();
      img.onload = () => {
        const maxWidth = window.innerWidth * 0.8; // 80vw
        const maxHeight = window.innerHeight * 0.8; // 80vh
        
        const originalWidth = img.naturalWidth;
        const originalHeight = img.naturalHeight;
        
        // Calcola il fattore di scala basato sulla dimensione maggiore
        const scaleWidth = maxWidth / originalWidth;
        const scaleHeight = maxHeight / originalHeight;
        const scale = Math.min(scaleWidth, scaleHeight);
        
        // Applica il fattore di scala mantenendo le proporzioni
        const newWidth = originalWidth * scale;
        const newHeight = originalHeight * scale;
        
        setImageSize({ width: newWidth, height: newHeight });
      };
      img.src = imageSrc;
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, imageSrc]);

  if (!isOpen) return null;

  const lightboxContent = (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-container">
        <img 
          src={imageSrc} 
          alt={imageAlt} 
          className="lightbox-image"
          style={{
            width: imageSize.width,
            height: imageSize.height,
          }}
          onClick={onClose}
        />
        {folderHref && (
          <a
            href={folderHref}
            className="lightbox-cta"
          >
            Apri galleria
          </a>
        )}
      </div>
    </div>
  );

  // Render using portal to ensure it's at the top level of the DOM
  return typeof document !== 'undefined' 
    ? createPortal(lightboxContent, document.body)
    : null;
};

export default Lightbox;
