import React from 'react';

interface TemperatureData {
  time: string;
  temperature: number;
  isPast: boolean;
}

interface HourlyTemperatureChartProps {
  data: TemperatureData[];
  currentTime: string;
  showAllLabels?: boolean;
}

const HourlyTemperatureChart: React.FC<HourlyTemperatureChartProps> = ({ data, currentTime, showAllLabels = false }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-lg mb-4">
        <h3 className="text-black text-sm font-medium mb-4">Temperatura Oraria</h3>
        <div className="text-white/70 text-xs">Dati non disponibili</div>
      </div>
    );
  }

  // Trova i valori min e max per scalare il grafico
  const temperatures = data.map(d => d.temperature);
  const minTemp = Math.min(...temperatures);
  const maxTemp = Math.max(...temperatures);
  const tempRange = maxTemp - minTemp || 1;

  // Calcola la posizione dell'ora corrente
  const currentHour = new Date(currentTime).getHours();
  const currentIndex = data.findIndex(d => {
    const dataHour = new Date(d.time).getHours();
    return dataHour === currentHour;
  });

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg mb-4">
      <h3 className="text-black text-sm font-medium mb-6">Temperatura Oraria</h3>

      <div className="relative w-full h-20 mb-4">
        {/* Container del grafico */}
        <div className="relative w-full h-full flex items-end justify-between px-2">


          {/* Canvas per la linea di connessione */}
          <canvas
            ref={(canvas) => {
              if (canvas && data.length > 0) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  // Imposta le dimensioni del canvas
                  const rect = canvas.getBoundingClientRect();
                  canvas.width = rect.width * window.devicePixelRatio;
                  canvas.height = rect.height * window.devicePixelRatio;
                  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

                  // Pulisci il canvas
                  ctx.clearRect(0, 0, rect.width, rect.height);

                  // Crea il gradiente
                  const gradient = ctx.createLinearGradient(0, 0, rect.width, 0);
                  gradient.addColorStop(0, '#9CA3AF');
                  gradient.addColorStop(0.5, '#60A5FA');
                  gradient.addColorStop(1, '#3B82F6');

                  // Imposta lo stile della linea
                  ctx.strokeStyle = gradient;
                  ctx.lineWidth = 2;
                  ctx.lineCap = 'round';
                  ctx.lineJoin = 'round';

                  // Disegna la linea curva smussata
                  const points = data.map((point, index) => {
                    const containerWidth = rect.width - 16;
                    const x = 8 + ((index + 0.5) / data.length) * containerWidth;
                    const height = ((point.temperature - minTemp) / tempRange) * 60;
                    const y = rect.height - height;
                    return { x, y };
                  });

                  if (points.length > 0) {
                    ctx.beginPath();
                    ctx.moveTo(points[0].x, points[0].y);

                    for (let i = 0; i < points.length - 1; i++) {
                      const p0 = points[i === 0 ? 0 : i - 1];
                      const p1 = points[i];
                      const p2 = points[i + 1];
                      const p3 = points[i + 2] || p2;

                      const tension = 0.2;

                      const cp1x = p1.x + (p2.x - p0.x) * tension;
                      const cp1y = p1.y + (p2.y - p0.y) * tension;

                      const cp2x = p2.x - (p3.x - p1.x) * tension;
                      const cp2y = p2.y - (p3.y - p1.y) * tension;

                      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
                    }
                    ctx.stroke();
                  }
                }
              }
            }}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 1 }}
          />

          {data.map((point, index) => {
            const height = ((point.temperature - minTemp) / tempRange) * 60; // 60px max height
            const mobileOffset = height - 4; // Mobile: sottraggo 4px (metà di 8px)
            const desktopOffset = height - 6; // Desktop: sottraggo 6px (metà di 12px)

            return (
              <div key={index} className="relative flex flex-col items-center" style={{ width: `${100 / data.length}%`, zIndex: 2 }}>
                {/* Temperatura sopra il punto - mostra solo ogni 3 ore per corrispondenza con etichette, a meno che showAllLabels sia true */}
                <div className={`text-xs sm:text-xs text-gray-600 mb-1 font-medium ${!showAllLabels && index % 3 !== 0 ? 'hidden sm:block' : ''}`} style={{ fontSize: '10px' }}>
                  {Math.round(point.temperature)}°
                </div>

                {/* Punto del grafico mobile */}
                <div
                  className="w-2 h-2 rounded-full border-2 border-white bg-blue-400 shadow-sm flex-shrink-0 sm:hidden"
                  style={{
                    marginBottom: `${mobileOffset}px`,
                    transition: 'all 0.3s ease'
                  }}
                />

                {/* Punto del grafico desktop */}
                <div
                  className="hidden sm:block w-3 h-3 rounded-full border-2 border-white bg-blue-400 shadow-sm flex-shrink-0"
                  style={{
                    marginBottom: `${desktopOffset}px`,
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
            <span className={`font-medium ${!showAllLabels && index % 3 !== 0 ? 'hidden sm:inline' : ''}`}>
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

export default HourlyTemperatureChart;