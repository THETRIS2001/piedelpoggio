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

// Helper to cast D1 result to Booking
// D1 returns columns as is. SQLite stores booleans as 0/1 if not careful, but here we use text/strings mostly.
// Our schema uses TEXT for everything except maybe id which is TEXT.
// So casting should be straightforward.

export async function getBookings(db: D1Database): Promise<Booking[]> {
  const { results } = await db
    .prepare('SELECT * FROM bookings ORDER BY date ASC, start ASC')
    .all<Booking>();
  
  return results || [];
}

export async function createBooking(db: D1Database, booking: Omit<Booking, 'id' | 'created_at'>): Promise<Booking> {
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  
  const newBooking: Booking = {
    ...booking,
    id,
    created_at
  };

  await db
    .prepare(
      `INSERT INTO bookings (id, date, start, end, title, customer_name, customer_phone, customer_email, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      newBooking.id,
      newBooking.date,
      newBooking.start,
      newBooking.end,
      newBooking.title || null,
      newBooking.customer_name,
      newBooking.customer_phone,
      newBooking.customer_email || null,
      newBooking.created_at
    )
    .run();

  return newBooking;
}

export async function deleteBooking(db: D1Database, id: string): Promise<void> {
  await db
    .prepare('DELETE FROM bookings WHERE id = ?')
    .bind(id)
    .run();
}

export async function getBookingById(db: D1Database, id: string): Promise<Booking | null> {
  const result = await db
    .prepare('SELECT * FROM bookings WHERE id = ? LIMIT 1')
    .bind(id)
    .first<Booking>();
  
  return result || null;
}

export async function checkBookingConflict(
  db: D1Database,
  date: string, 
  start: string, 
  end: string, 
  excludeId?: string
): Promise<boolean> {
  // Logic:
  // A booking B conflicts with requested (start, end) if:
  // B.date == date AND
  // (B.start < end AND B.end > start)
  // i.e. The intervals overlap.

  let query = `
    SELECT count(*) as count 
    FROM bookings 
    WHERE date = ? 
    AND start < ? 
    AND end > ?
  `;
  
  const args = [date, end, start];

  if (excludeId) {
    query += ` AND id != ?`;
    args.push(excludeId);
  }

  const result = await db.prepare(query).bind(...args).first<{ count: number }>();
  
  return (result?.count ?? 0) > 0;
}
