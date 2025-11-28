import React, { useEffect, useMemo, useState } from 'react';
import { formatDate, removeSecondsFromTime } from '../utils/date';

type Booking = {
  id: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:mm
  end: string;   // HH:mm
  title?: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  created_at: string;
};

type BookingFormData = {
  customerName: string;
  customerPhone: string;
  title: string;
};

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

// Funzione per mascherare il nome con asterischi
function maskCustomerName(name: string): string {
  if (!name || name.length <= 2) return name;
  
  const words = name.trim().split(' ');
  return words.map(word => {
    if (word.length <= 2) return word;
    return word.charAt(0) + '*'.repeat(word.length - 2) + word.charAt(word.length - 1);
  }).join(' ');
}

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function minutesFromTime(t: string) {
  if (!t) return 0; // Handle empty string
  const [hh, mm] = t.split(':').map(Number);
  // Gestisce mezzanotte (00:00) come fine giornata (1440 minuti)
  if (hh === 0 && mm === 0) {
    return 24 * 60; // 1440 minuti = mezzanotte del giorno successivo
  }
  return hh * 60 + mm;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

const WORK_START = 7 * 60; // 07:00
const WORK_END = 24 * 60;  // 24:00 (mezzanotte)
const STEP = 60; // 60 minuti (solo ore intere)

const generateSlots = () => {
  const slots: string[] = [];
  for (let m = WORK_START; m <= WORK_END; m += STEP) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    // Gestisce mezzanotte come 00:00 invece di 24:00
    if (m === WORK_END) {
      slots.push('00:00');
    } else {
      slots.push(`${hh}:${mm}`);
    }
  }
  return slots;
};

const slots = generateSlots();

const legendColors = {
  available: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  busy: 'bg-rose-100 text-rose-700 border-rose-200',
  selected: 'bg-primary-100 text-primary-700 border-primary-200',
};

const CalendarHeader: React.FC<{ month: number; year: number; onPrev: () => void; onNext: () => void; onToday: () => void; }>
= ({ month, year, onPrev, onNext, onToday }) => {
  const months = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <button aria-label="Mese precedente" className="p-2 rounded-lg hover:bg-gray-100" onClick={onPrev}>
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <h2 className="text-xl md:text-2xl font-semibold text-gray-900">{months[month]} {year}</h2>
        <button aria-label="Mese successivo" className="p-2 rounded-lg hover:bg-gray-100" onClick={onNext}>
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
      <button onClick={onToday} className="px-3 py-1 text-xs md:text-sm font-medium.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200">Oggi</button>
    </div>
  );
};

const BookingCalendar: React.FC = () => {
  const now = new Date();
  const [visibleMonth, setVisibleMonth] = useState(now.getMonth());
  const [visibleYear, setVisibleYear] = useState(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string>(toDateKey(now));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [selectionMode, setSelectionMode] = useState<'start' | 'end' | 'complete'>('start'); // Traccia lo stato della selezione
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState<{ bookingId: string; booking: Booking } | null>(null);
  const [cancelPhone, setCancelPhone] = useState('');
  const [cancelError, setCancelError] = useState<string>('');
  const [formData, setFormData] = useState<BookingFormData>({
    customerName: '',
    customerPhone: '',
    title: ''
  });

  // Fetch dati prenotazioni
  const loadBookings = async () => {
    try {
      const res = await fetch('/api/bookings', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.bookings)) {
        setBookings(data.bookings);
      }
    } catch (e) {
      console.error('Errore nel caricamento delle prenotazioni:', e);
    }
  };

  useEffect(() => {
    loadBookings();
    const id = setInterval(loadBookings, 30000); // Aggiorna ogni 30 secondi
    return () => clearInterval(id);
  }, []);

  // Gestisce il click su uno slot orario
  const handleSlotClick = (slotTime: string) => {
    const slotMinutes = minutesFromTime(slotTime);
    
    if (selectionMode === 'start' || selectionMode === 'complete') {
      // Impedisce la selezione di mezzanotte come orario di inizio
      if (slotTime === '00:00') {
        return;
      }
      
      // Primo click o reset: seleziona l'orario di inizio
      setStartTime(slotTime);
      setEndTime('');
      setSelectionMode('end');
    } else if (selectionMode === 'end') {
      const startMinutes = minutesFromTime(startTime);
      
      if (slotMinutes > startMinutes) {
        // Secondo click su orario successivo: seleziona l'orario di fine
        setEndTime(slotTime);
        setSelectionMode('complete');
      } else {
        // Click su orario precedente o uguale: riparte con nuovo inizio
        // Impedisce la selezione di mezzanotte come orario di inizio
        if (slotTime === '00:00') {
          return;
        }
        
        setStartTime(slotTime);
        setEndTime('');
        setSelectionMode('end');
      }
    }
  };

  // Reset della selezione quando cambia la data
  useEffect(() => {
    setStartTime('');
    setEndTime('');
    setSelectionMode('start');
  }, [selectedDate]);

  // Mostra messaggio temporaneo
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const daysMatrix = useMemo(() => {
    const firstOfMonth = new Date(visibleYear, visibleMonth, 1);
    const lastOfMonth = new Date(visibleYear, visibleMonth + 1, 0);
    // Allineare a settimana che inizia di lunedì
    const offset = (firstOfMonth.getDay() + 6) % 7; // 0 lunedì
    const totalDays = lastOfMonth.getDate();

    const cells: (Date | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(new Date(visibleYear, visibleMonth, d));
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  }, [visibleMonth, visibleYear]);

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    bookings.forEach(b => {
      const arr = map.get(b.date) || [];
      arr.push(b);
      map.set(b.date, arr);
    });
    return map;
  }, [bookings]);

  const occupiedForDate = useMemo(() => bookingsByDate.get(selectedDate) || [], [bookingsByDate, selectedDate]);

  const isSlotBusy = (dateKey: string, slotStart: string, slotEnd: string) => {
     const s = minutesFromTime(slotStart);
     const e = minutesFromTime(slotEnd);
     const list = bookingsByDate.get(dateKey) || [];
     return list.some(b => rangesOverlap(s, e, minutesFromTime(b.start), minutesFromTime(b.end)));
   };

  const canBookSlot = () => {
    // Check if both times are selected
    if (!startTime || !endTime) return false;
    
    const selectedDateObj = new Date(selectedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDateObj.setHours(0, 0, 0, 0);
    
    // Non si può prenotare nel passato
    if (selectedDateObj < today) return false;
    
    // Controlla se lo slot è già occupato
    return !isSlotBusy(selectedDate, startTime, endTime);
  };

  const handleBooking = async () => {
    if (!canBookSlot()) {
      showMessage('error', 'Slot non disponibile per la prenotazione');
      return;
    }

    if (!formData.customerName.trim() || !formData.customerPhone.trim()) {
      showMessage('error', 'Nome e telefono sono obbligatori');
      return;
    }

    // Validazione numero di telefono (formato italiano)
    const phoneRegex = /^(\+39\s?)?((3[0-9]{2}|32[0-9]|33[0-9]|34[0-9]|36[0-9]|37[0-9]|38[0-9]|39[0-9])\s?\d{6,7}|0[1-9]\d{1,3}\s?\d{6,8})$/;
    if (!phoneRegex.test(formData.customerPhone.trim())) {
      showMessage('error', 'Inserisci un numero di telefono valido (es: 3331234567 o 0612345678)');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          start: startTime,
          end: endTime,
          title: formData.title.trim(),
          customerName: formData.customerName.trim(),
          customerPhone: formData.customerPhone.trim(),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        showMessage('success', 'Prenotazione creata con successo!');
        setShowBookingForm(false);
        setFormData({ customerName: '', customerPhone: '', title: '' });
        await loadBookings(); // Ricarica le prenotazioni
      } else {
        showMessage('error', result.error || 'Errore nella creazione della prenotazione');
      }
    } catch (error) {
      showMessage('error', 'Errore di connessione');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;
    
    setShowCancelDialog({ bookingId, booking });
    setCancelPhone('');
    setCancelError('');
  };

  const confirmCancelBooking = async () => {
    if (!showCancelDialog) return;

    // Reset error
    setCancelError('');

    // Validazione campo vuoto
    if (!cancelPhone.trim()) {
      setCancelError('Inserisci il numero di telefono');
      return;
    }

    // Validazione formato numero di telefono
    const phoneRegex = /^(\+39\s?)?((3[0-9]{2}|32[0-9]|33[0-9]|34[0-9]|36[0-9]|37[0-9]|38[0-9]|39[0-9])\s?\d{6,7}|0[1-9]\d{1,3}\s?\d{6,8})$/;
    if (!phoneRegex.test(cancelPhone.trim())) {
      setCancelError('Formato numero di telefono non valido (es: 3331234567 o 0612345678)');
      return;
    }

    // Verifica che il telefono corrisponda a quello della prenotazione
    if (cancelPhone.trim() !== showCancelDialog.booking.customer_phone) {
      setCancelError('NUMERO SBAGLIATO: Il telefono inserito non corrisponde a quello della prenotazione');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/bookings?id=${showCancelDialog.bookingId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (response.ok) {
        showMessage('success', 'Prenotazione cancellata con successo!');
        setShowCancelDialog(null);
        setCancelPhone('');
        setCancelError('');
        await loadBookings(); // Ricarica le prenotazioni
      } else {
        setCancelError(result.error || 'Errore nella cancellazione della prenotazione');
      }
    } catch (error) {
      setCancelError('Errore di connessione');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrev = () => {
    const d = new Date(visibleYear, visibleMonth - 1, 1);
    setVisibleMonth(d.getMonth());
    setVisibleYear(d.getFullYear());
  };
  const handleNext = () => {
    const d = new Date(visibleYear, visibleMonth + 1, 1);
    setVisibleMonth(d.getMonth());
    setVisibleYear(d.getFullYear());
  };
  const handleToday = () => {
    const d = new Date();
    setVisibleMonth(d.getMonth());
    setVisibleYear(d.getFullYear());
    setSelectedDate(toDateKey(d));
  };

  // Assicurare che fine sia sempre dopo inizio
  useEffect(() => {
    if (startTime && endTime && minutesFromTime(endTime) <= minutesFromTime(startTime)) {
      const next = minutesFromTime(startTime) + STEP;
      const hh = String(Math.floor(next / 60)).padStart(2, '0');
      const mm = String(next % 60).padStart(2, '0');
      setEndTime(`${hh}:${mm}`);
    }
  }, [startTime, endTime]);

  return (
    <div>
      {/* Messaggio di stato */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg border ${message.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Intestazione calendario */}
      <CalendarHeader month={visibleMonth} year={visibleYear} onPrev={handlePrev} onNext={handleNext} onToday={handleToday} />

      {/* Giorni della settimana */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{w}</div>
        ))}
      </div>

      {/* Griglia calendario */}
      <div role="grid" aria-label="Calendario prenotazioni" className="grid grid-cols-7 gap-2">
        {daysMatrix.map((week, wi) => (
          <React.Fragment key={wi}>
            {week.map((day, di) => {
              if (!day) return <div key={`${wi}-${di}`} className="aspect-square sm:aspect-auto sm:h-24 rounded-xl border border-dashed border-gray-200 bg-gray-50" />;
              const key = toDateKey(day);
              const isSelected = key === selectedDate;
              const count = (bookingsByDate.get(key) || []).length;
              const isToday = key === toDateKey(new Date());
              
              // Controlla se il giorno è nel passato
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const dayDate = new Date(day);
              dayDate.setHours(0, 0, 0, 0);
              const isPastDay = dayDate < today;
              
              return (
                <button
                  key={key}
                  role="gridcell"
                  aria-selected={isSelected}
                  onClick={() => !isPastDay && setSelectedDate(key)}
                  disabled={isPastDay}
                  className={`aspect-square w-full sm:aspect-auto sm:h-24 rounded-xl border               transition-all duration-200 text-left p-2 focus:outline-none ${
                    isPastDay 
                      ? 'border-gray-300 bg-gray-100 cursor-not-allowed opacity-60' 
                      : count > 0
                        ? isSelected
                          ? 'border-red-300 bg-red-100 focus:ring-2 focus:ring-red-500'
                          : 'border-red-200 bg-red-50 hover:bg-red-100 focus:ring-2               focus:ring-red-500'
                        : isSelected 
                          ? 'border-primary-300 bg-primary-50 focus:ring-2              focus:ring-primary-500' 
                          : 'border-gray-200 bg-white hover:bg-gray-50 focus:ring-2               focus:ring-primary-500'
                  } ${isToday && !isPastDay ? 'shadow-inner' : ''}`}
                >
                  <div className="flex flex-col h-full">
                    <div className="flex items-start justify-between mb-1">
                      <span className={`text-sm font-semibold ${isPastDay ? 'text-gray-400' : 'text-gray-800'}`}>
                        {day.getDate()}
                      </span>
                      {count > 0 && (
                        <span className={`hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
                          isPastDay 
                            ? 'bg-gray-200 text-gray-500 border-gray-300' 
                            : 'bg-red-200 text-red-800 border-red-300'
                        }`}>
                          {count}
                        </span>
                      )}
                    </div>
                    <div className="hidden sm:block flex-1 space-y-0.5">
                      {(bookingsByDate.get(key) || []).slice(0,1).map((b, idx) => (
                        <div key={idx} className={`text-[10px] px-1.5 py-0.5 rounded ${
                          isPastDay 
                            ? 'bg-gray-200 text-gray-500' 
                            : 'bg-red-200 text-red-800'
                        } truncate`}>
                          {removeSecondsFromTime(b.start)}–{removeSecondsFromTime(b.end)}
                        </div>
                      ))}
                      {(count > 1) && (
                        <div className={`text-[10px] px-1.5 py-0.5 rounded ${
                          isPastDay 
                            ? 'bg-gray-200 text-gray-500' 
                            : 'bg-red-200 text-red-800'
                        }`}>
                          +{count - 1} altr{count > 2 ? 'e' : 'o'}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );

             })}
           </React.Fragment>
        ))}
      </div>

      {/* Selezione dettagli */}
      <div className="mt-6 grid md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Dettagli prenotazione</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600">Giorno</label>
                <div className="mt-1 px-3 py-2 bg-white rounded-lg border border-gray-200 text-gray-800">{selectedDate}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="start" className="text-xs text-gray-600">Ora inizio</label>
                  <select id="start" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1 w-full px-3 py-2 bg-white rounded-lg border border-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="">seleziona</option>
                    {slots.map(s => {
                      // Non mostrare 00:00 come orario di inizio (solo come fine)
                      if (s === '00:00') return null;
                      return <option key={s} value={s}>{s}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label htmlFor="end" className="text-xs text-gray-600">Ora fine</label>
                  <select id="end" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1 w-full px-3 py-2 bg-white rounded-lg border border-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="">seleziona</option>
                    {slots.map((s, i) => {
                      // mostriamo solo slot dopo start
                      if (!startTime || minutesFromTime(s) <= minutesFromTime(startTime)) return null;
                      return <option key={s} value={s}>{s}</option>;
                    })}
                  </select>
                </div>
              </div>
              
              {/* Pulsante per prenotare */}
              <div className="pt-2">
                {canBookSlot() ? (
                  <button
                    onClick={() => setShowBookingForm(true)}
                    disabled={isLoading}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Caricamento...' : 'Prenota questo slot'}
                  </button>
                ) : (
                  <div className="w-full px-4 py-2 bg-gray-200 text-gray-600 rounded-lg text-center">
                    {selectionMode === 'start' ? 'Clicca un orario per iniziare' : 
                     selectionMode === 'end' ? 'Clicca un orario successivo per finire' : 
                     !startTime || !endTime ? 'seleziona orario di inizio e fine' : 'Slot non disponibile'}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className={`px-2 py-1 rounded-md border ${legendColors.available}`}>Disponibile</span>
                <span className={`px-2 py-1 rounded-md border ${legendColors.busy}`}>Occupato</span>
                <span className={`px-2 py-1 rounded-md border ${legendColors.selected}`}>Selezionato</span>
                {selectionMode === 'end' && <span className="px-2 py-1 rounded-md border bg-gray-100 text-gray-400 border-gray-200">Non selezionabile</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Timeline oraria per il giorno selezionato */}
        <div className="md:col-span-2">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Orari disponibili per {selectedDate}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {slots.map((s, idx) => {
              const slotEndMinutes = minutesFromTime(s) + STEP;
              const eh = String(Math.floor(slotEndMinutes / 60)).padStart(2, '0');
              const em = String(slotEndMinutes % 60).padStart(2, '0');
              const eStr = `${eh}:${em}`;
              const busy = isSlotBusy(selectedDate, s, eStr);
              const selected = minutesFromTime(s) >= minutesFromTime(startTime) && minutesFromTime(eStr) <= minutesFromTime(endTime);
              
              // Determina se lo slot è disabilitato
              const isDisabled = busy || 
                                (selectionMode === 'end' && startTime && minutesFromTime(s) <= minutesFromTime(startTime)) ||
                                (selectionMode === 'start' && s === '00:00') ||
                                (selectionMode === 'complete' && s === '00:00');
              
              // Determina lo stile del bottone
              let buttonStyle = '';
              if (busy) {
                buttonStyle = 'bg-rose-100 text-rose-700 border-rose-200 cursor-not-allowed';
              } else if (selected) {
                buttonStyle = 'bg-primary-100 text-primary-700 border-primary-200';
              } else if (isDisabled) {
                buttonStyle = 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed';
              } else {
                buttonStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 cursor-pointer';
              }
              
              return (
                <button
                  key={`${selectedDate}-${s}`}
                  onClick={() => !isDisabled && handleSlotClick(s)}
                  disabled={isDisabled}
                  className={`px-3 py-2 rounded-lg border text-sm text-center transition-colors ${buttonStyle}`}
                >
                  {s}
                </button>
              );
            })}
          </div>

          {/* Prenotazioni visibili a tutti */}
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Prenotazioni del giorno</h4>
            {occupiedForDate.length === 0 ? (
              <p className="text-sm text-gray-600">Nessuna prenotazione presente.</p>
            ) : (
              <ul className="space-y-2">
                {occupiedForDate.map((b, i) => {
                  const masked = maskCustomerName(b.customer_name)
                  const titleRaw = b.title || ''
                  const titleSanitized = titleRaw && b.customer_name ? titleRaw.split(b.customer_name).join(masked) : titleRaw
                  return (
                    <li key={i} className="px-3 py-2 bg-white rounded-lg border border-gray-200 text-sm text-gray-800 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{removeSecondsFromTime(b.start)}–{removeSecondsFromTime(b.end)} {titleSanitized ? `· ${titleSanitized}` : ''}</div>
                        <div className="text-xs text-gray-600">{masked}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200">occupato</span>
                        <button
                          onClick={() => handleCancelBooking(b.id)}
                          disabled={isLoading}
                          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                        >
                          Cancella
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Form di prenotazione */}
      {showBookingForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Prenota il campo</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Nome *</label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Il tuo nome"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Telefono *</label>
                <input
                  type="tel"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Il tuo numero di telefono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Descrizione</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Es: Cena brace (opzionale)"
                />
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">
                  <strong>Riepilogo:</strong><br />
                  Data: {selectedDate}<br />
                  Orario: {removeSecondsFromTime(startTime)} - {removeSecondsFromTime(endTime)}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowBookingForm(false)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Annulla
              </button>
              <button
                onClick={handleBooking}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Prenotando...' : 'Conferma prenotazione'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog di cancellazione con autenticazione telefono */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Conferma cancellazione
            </h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Stai per cancellare la prenotazione di <strong>{maskCustomerName(showCancelDialog.booking.customer_name)}</strong>
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Data: {showCancelDialog.booking.date}<br />
                Orario: {removeSecondsFromTime(showCancelDialog.booking.start)} - {removeSecondsFromTime(showCancelDialog.booking.end)}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                Per confermare la cancellazione, inserisci il numero di telefono utilizzato per la prenotazione:
              </p>
              <input
                type="tel"
                value={cancelPhone}
                onChange={(e) => {
                  setCancelPhone(e.target.value);
                  setCancelError(''); // Clear error when user types
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  cancelError 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-red-500'
                }`}
                placeholder="Numero di telefono"
                autoFocus
              />
              {cancelError && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  {cancelError}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCancelDialog(null);
                  setCancelPhone('');
                  setCancelError('');
                }}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Annulla
              </button>
              <button
                onClick={confirmCancelBooking}
                disabled={isLoading || !cancelPhone.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Cancellando...' : 'Conferma cancellazione'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingCalendar;
