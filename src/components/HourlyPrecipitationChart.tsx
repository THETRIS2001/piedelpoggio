import React from 'react';

interface PrecipitationData {
  time: string;
  probability: number;
  quantity: number;
  isPast: boolean;
}

interface HourlyPrecipitationChartProps {
  data: PrecipitationData[];
  currentTime: string;
}

const HourlyPrecipitationChart: React.FC<HourlyPrecipitationChartProps> = ({ data, currentTime }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-lg mb-4">
        <h3 className="text-black text-sm font-medium mb-4">Precipitazioni Orarie</h3>
        <div className="text-white/70 text-xs">Dati non disponibili</div>
      </div>
    );
  }

  // Trova i valori max per scalare il grafico
  const maxQuantity = Math.max(...data.map(d => d.quantity)) || 0;
  const maxProbability = Math.max(...data.map(d => d.probability)) || 0;

  // Verifica se non sono previste precipitazioni
  const noPrecipitations = maxQuantity === 0;

  // Calcola la posizione dell'ora corrente
  const currentHour = new Date(currentTime).getHours();
  const currentIndex = data.findIndex(d => {
    const dataHour = new Date(d.time).getHours();
    return dataHour === currentHour;
  });

  if (noPrecipitations) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-lg mb-4 p-2 text-center">
        <h3 className="text-black text-sm font-medium mb-2">Precipitazioni Orarie</h3>
        <div className="flex flex-col items-center justify-center py-4 bg-blue-50/30 rounded-lg border border-blue-100/50">
          <span className="text-2xl mb-1">☀️</span>
          <p className="text-blue-700 text-xs font-medium">Non sono previste precipitazioni nelle prossime 24 ore</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg mb-4">
      <h3 className="text-black text-sm font-medium mb-6">Precipitazioni Orarie</h3>

      <div className="relative w-full h-20 mb-4">
        {/* Container del grafico */}
        <div className="relative w-full h-full flex items-end justify-between px-2">
          {data.map((point, index) => {
            const barHeight = (point.quantity / maxQuantity) * 50; // 50px max height per le barre
            const isCurrentHour = index === currentIndex;

            return (
              <div key={index} className="relative flex flex-col items-center justify-end flex-shrink-0" style={{ width: `${100 / data.length}%`, height: '100%' }}>
                {/* Probabilità sopra la barra - mostra solo se quantity > 0 e ogni 3 ore per evitare sovrapposizioni */}
                {point.quantity > 0 && (
                  <div className={`text-xs text-gray-600 mb-1 font-medium absolute ${index % 3 !== 0 ? 'hidden sm:block' : ''}`} style={{ bottom: `${barHeight + 8}px`, left: '50%', transform: 'translateX(-50%)', fontSize: '10px' }}>
                    {Math.round(point.probability)}%
                  </div>
                )}

                {/* Barra quantità - più stretta per evitare sovrapposizioni */}
                <div
                  className="w-2 sm:w-3 bg-cyan-300/60 rounded-t flex-shrink-0"
                  style={{
                    height: `${barHeight}px`,
                    transition: 'all 0.3s ease'
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Linea di base del grafico */}
        <div className="absolute bottom-0 left-2 right-2 h-px bg-white/20" />
      </div>

      {/* Etichette orarie */}
      <div className="flex justify-between text-xs text-gray-600 px-2">
        {data.map((d, index) => (
          <div key={index} className="text-center" style={{ width: `${100 / data.length}%` }}>
            <span className={`font-medium ${index % 3 !== 0 ? 'hidden sm:inline' : ''}`}>
              <span className="sm:hidden">
                {new Date(d.time).getHours().toString().padStart(2, '0')}
              </span>
              <span className="hidden sm:inline">
                {new Date(d.time).getHours().toString().padStart(2, '0')}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HourlyPrecipitationChart;