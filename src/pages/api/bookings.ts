import type { APIRoute } from 'astro';
import { getBookings, createBooking, deleteBooking, checkBookingConflict, getBookingById, type Booking } from '../../lib/supabase';

export const prerender = false;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');

    const bookings = await getBookings();
    
    // Filtra per data se specificata
    const filteredBookings = date 
      ? bookings.filter(booking => booking.date === date)
      : bookings;

    return new Response(JSON.stringify({ 
      bookings: filteredBookings 
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error in GET /api/bookings:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch bookings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    
    // Validazione dei dati richiesti
    const requiredFields = ['date', 'start', 'end', 'customerName', 'customerPhone'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return new Response(JSON.stringify({ 
          error: `Missing required field: ${field}` 
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
    }

    // Validazione formato data
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(body.date)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid date format. Use YYYY-MM-DD' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Validazione formato orario
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(body.start) || !timeRegex.test(body.end)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid time format. Use HH:mm' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Controlla conflitti di orario
    const hasConflict = await checkBookingConflict(body.date, body.start, body.end);
    if (hasConflict) {
      return new Response(JSON.stringify({ 
        error: 'Time slot conflict. This time is already booked.' 
      }), {
        status: 409,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Crea la prenotazione
    const newBooking = await createBooking({
      date: body.date,
      start: body.start,
      end: body.end,
      title: body.title || `Prenotazione ${body.customerName}`,
      customer_name: body.customerName,
      customer_phone: body.customerPhone,
      customer_email: body.customerEmail,
    });

    try {
      const RESEND_API_KEY = (locals as any)?.runtime?.env?.RESEND_API_KEY || import.meta.env.RESEND_API_KEY;
      if (RESEND_API_KEY) {
        const subject = `Nuova prenotazione campo: ${newBooking.date} ${newBooking.start}–${newBooking.end}`;
        const html = `
          <div style="font-family: Arial, sans-serif;">
            <h2>Nuova prenotazione campo sportivo</h2>
            <p><strong>Nome:</strong> ${escapeHtml(newBooking.customer_name)}</p>
            <p><strong>Telefono:</strong> ${escapeHtml(newBooking.customer_phone)}</p>
            ${newBooking.customer_email ? `<p><strong>Email:</strong> ${escapeHtml(newBooking.customer_email)}</p>` : ''}
            <p><strong>Quando:</strong> ${escapeHtml(newBooking.date)} ${escapeHtml(newBooking.start)}–${escapeHtml(newBooking.end)}</p>
            ${newBooking.title ? `<p><strong>Titolo:</strong> ${escapeHtml(newBooking.title)}</p>` : ''}
          </div>
        `;
        const payload = {
          from: 'Prenotazioni Pro Loco <onboarding@resend.dev>',
          to: ['pro.piedelpoggio@gmail.com'],
          subject,
          html,
        };
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      }
    } catch (e) {
      console.error('Email send error (create booking):', e);
    }

    return new Response(JSON.stringify({ 
      booking: newBooking,
      message: 'Booking created successfully' 
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Error in POST /api/bookings:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to create booking',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ 
        error: 'Missing booking ID' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const booking = await getBookingById(id);
    await deleteBooking(id);

    try {
      if (booking) {
        const RESEND_API_KEY = (locals as any)?.runtime?.env?.RESEND_API_KEY || import.meta.env.RESEND_API_KEY;
        if (RESEND_API_KEY) {
          const subject = `Cancellazione prenotazione campo: ${booking.date} ${booking.start}–${booking.end}`;
          const html = `
            <div style="font-family: Arial, sans-serif;">
              <h2>Prenotazione cancellata</h2>
              <p><strong>Nome:</strong> ${escapeHtml(booking.customer_name)}</p>
              <p><strong>Telefono:</strong> ${escapeHtml(booking.customer_phone)}</p>
              ${booking.customer_email ? `<p><strong>Email:</strong> ${escapeHtml(booking.customer_email)}</p>` : ''}
              <p><strong>Quando:</strong> ${escapeHtml(booking.date)} ${escapeHtml(booking.start)}–${escapeHtml(booking.end)}</p>
              ${booking.title ? `<p><strong>Titolo:</strong> ${escapeHtml(booking.title)}</p>` : ''}
            </div>
          `;
          const payload = {
            from: 'Prenotazioni Pro Loco <onboarding@resend.dev>',
            to: ['pro.piedelpoggio@gmail.com'],
            subject,
            html,
          };
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
        }
      }
    } catch (e) {
      console.error('Email send error (delete booking):', e);
    }

    return new Response(JSON.stringify({ 
      message: 'Booking deleted successfully' 
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Error in DELETE /api/bookings:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to delete booking',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
