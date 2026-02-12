import type { APIRoute } from 'astro';
import { buildIdeaEmail } from '../../utils/emailTemplates';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const form = await request.formData();

    const nome = (form.get('nome') || '').toString().trim();
    const cognome = (form.get('cognome') || '').toString().trim();
    const email = (form.get('email') || '').toString().trim();
    const telefono = (form.get('telefono') || '').toString().trim();
    const idea = (form.get('idea') || '').toString().trim();

    // Validazione minima lato server
    if (!nome || !cognome || !idea || idea.length < 10) {
      return new Response('', {
        status: 303,
        headers: {
          Location: '/suggerisci-idea?errore=1',
        },
      });
    }

    const subject = `💡 Nuova idea da ${nome} ${cognome}`;
    const html = buildIdeaEmail({ nome, cognome, email: email || undefined, telefono: telefono || undefined, idea });

    const RESEND_API_KEY = (locals as any)?.runtime?.env?.RESEND_API_KEY || import.meta.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      console.error('Missing RESEND_API_KEY environment variable');
      return new Response('', {
        status: 303,
        headers: {
          Location: '/suggerisci-idea?errore=1',
        },
      });
    }

    // Invio email via Resend (compatibile con Cloudflare Workers)
    const payload = {
      from: 'Suggerimenti Pro Loco <onboarding@resend.dev>',
      to: ['pro.piedelpoggio@gmail.com'],
      reply_to: email || undefined,
      subject,
      html,
    };

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Resend API error:', res.status, errorText);
      return new Response('', {
        status: 303,
        headers: {
          Location: '/suggerisci-idea?errore=1',
        },
      });
    }

    return new Response('', {
      status: 303,
      headers: {
        Location: '/suggerisci-idea?inviato=1',
      },
    });
  } catch (error) {
    console.error('Error in POST /api/suggerisci-idea:', error);
    return new Response('', {
      status: 303,
      headers: {
        Location: '/suggerisci-idea?errore=1',
      },
    });
  }
};
