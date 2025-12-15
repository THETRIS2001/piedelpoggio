DROP TABLE IF EXISTS bookings;
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL, -- YYYY-MM-DD
  start TEXT NOT NULL, -- HH:mm
  end TEXT NOT NULL, -- HH:mm
  title TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  created_at TEXT NOT NULL
);

-- Index for faster queries by date (used in getBookings and conflict checks)
CREATE INDEX idx_bookings_date ON bookings(date);
