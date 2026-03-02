import * as React from 'react';
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
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
  }, [imageSrc]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const lightboxContent = (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-container">
        <img
          src={imageSrc}
          alt={imageAlt}
          className="lightbox-image"
          style={{
            maxWidth: '95vw',
            maxHeight: '90vh',
            objectFit: 'contain',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.2s ease-in-out'
          }}
          onLoad={() => setIsLoaded(true)}
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
