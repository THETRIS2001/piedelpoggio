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
  onPrev?: () => void;
  onNext?: () => void;
}

const Lightbox: React.FC<LightboxProps> = ({ isOpen, imageSrc, imageAlt, onClose, folderHref, onPrev, onNext }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
  }, [imageSrc]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && onPrev) {
        onPrev();
      } else if (e.key === 'ArrowRight' && onNext) {
        onNext();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      // Riabilita il pinch zoom, spento sul resto del sito.
      document.documentElement.classList.add('lightbox-open');
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
      document.documentElement.classList.remove('lightbox-open');
    };
  }, [isOpen, onClose, onPrev, onNext]);

  if (!isOpen) return null;

  const lightboxContent = (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-container relative w-full h-full flex items-center justify-center">
        {onPrev && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            className="fixed left-2 md:left-4 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm transition-all z-[110]"
            aria-label="Precedente"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}
        {onNext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="fixed right-2 md:right-4 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm transition-all z-[110]"
            aria-label="Successiva"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center z-[105] pointer-events-none transition-opacity duration-300">
            <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
          </div>
        )}
        <div 
          className="relative max-w-[95vw] max-h-[90vh] flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={imageSrc}
            alt={imageAlt}
            className="lightbox-image relative z-[106]"
            style={{
              maxWidth: '95vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              opacity: isLoaded ? 1 : 0,
              transition: 'opacity 0.2s ease-in-out'
            }}
            onLoad={() => setIsLoaded(true)}
          />
          {folderHref && isLoaded && (
            <a
              href={folderHref}
              className="lightbox-cta z-[107]"
            >
              Apri galleria
            </a>
          )}
        </div>
      </div>
    </div>
  );

  // Render using portal to ensure it's at the top level of the DOM
  return typeof document !== 'undefined'
    ? createPortal(lightboxContent, document.body)
    : null;
};

export default Lightbox;
