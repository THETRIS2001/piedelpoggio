import React from 'react';

interface PDFDocument {
  name: string;
  filename: string;
  description: string;
  category: 'linea-a' | 'linea-d';
  date: string;
}

interface PDFViewerProps {
  documents: PDFDocument[];
}

const PDFViewer: React.FC<PDFViewerProps> = ({ documents }) => {

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'linea-a':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'linea-d':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'linea-a':
        return 'from-blue-500 to-blue-600';
      case 'linea-d':
        return 'from-green-500 to-green-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'linea-a':
        return 'Linea A';
      case 'linea-d':
        return 'Linea D';
      default:
        return 'Documento';
    }
  };

  return (
    <div className="space-y-6">
      {/* Griglia documenti - massimo 3 per riga */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
        {documents.map((doc, index) => (
          <div
            key={index}
            className="bg-white rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200"
          >
            {/* Header del documento */}
            <div className={`bg-gradient-to-r ${getCategoryColor(doc.category)} p-4 text-white`}>
              <div className="flex items-center space-x-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>                <div>
                  <h3 className="font-bold text-lg">{getCategoryName(doc.category)}</h3>
                  <p className="text-sm opacity-90">{doc.date}</p>
                </div>
              </div>
            </div>

            {/* Contenuto */}
            <div className="p-6">
              <h4 className="font-semibold text-gray-800 mb-2 line-clamp-2">
                {doc.name}
              </h4>
              <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                {doc.description}
              </p>

              {/* Azioni */}
              <div className="flex space-x-3">
                <a
                  href={`/documents/${doc.filename}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors duration-200 flex items-center justify-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>Anteprima</span>
                </a>
                <a
                  href={`/documents/${doc.filename}`}
                  download
                  className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-600 transition-colors duration-200 flex items-center justify-center"
                  title="Scarica documento"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PDFViewer;