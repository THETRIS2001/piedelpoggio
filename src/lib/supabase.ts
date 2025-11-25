import { createClient } from '@supabase/supabase-js';

// Configurazione Supabase
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Tipi per le prenotazioni
export type Booking = {
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

// Funzioni helper per le prenotazioni
export async function getBookings(): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('date', { ascending: true })
    .order('start', { ascending: true });

  if (error) {
    console.error('Error fetching bookings:', error);
    throw error;
  }

  return data || [];
}

export async function createBooking(booking: Omit<Booking, 'id' | 'created_at'>): Promise<Booking> {
  const { data, error } = await supabase
    .from('bookings')
    .insert([{
      ...booking,
      created_at: new Date().toISOString()
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating booking:', error);
    throw error;
  }

  return data;
}

export async function deleteBooking(id: string): Promise<void> {
  const { error } = await supabase
    .from('bookings')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting booking:', error);
    throw error;
  }
}

export async function getBookingById(id: string): Promise<Booking | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .limit(1);

  if (error) {
    console.error('Error fetching booking by id:', error);
    throw error;
  }

  return Array.isArray(data) && data.length > 0 ? (data[0] as Booking) : null;
}

// Funzione per verificare conflitti di orario
export async function checkBookingConflict(
  date: string, 
  start: string, 
  end: string, 
  excludeId?: string
): Promise<boolean> {
  let query = supabase
    .from('bookings')
    .select('id, start, end')
    .eq('date', date);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error checking conflicts:', error);
    throw error;
  }

  if (!data) return false;

  // Converti orari in minuti per il confronto
  const minutesFromTime = (time: string): number => {
    const [hh, mm] = time.split(':').map(Number);
    return hh * 60 + mm;
  };

  const newStart = minutesFromTime(start);
  const newEnd = minutesFromTime(end);

  // Controlla sovrapposizioni
  return data.some(booking => {
    const existingStart = minutesFromTime(booking.start);
    const existingEnd = minutesFromTime(booking.end);
    
    return (newStart < existingEnd && newEnd > existingStart);
  });
}
