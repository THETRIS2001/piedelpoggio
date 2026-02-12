// ─── Utility per template email belli e moderni ───
// Tutti i template condividono lo stesso design system per coerenza grafica.

function escapeHtml(input: string): string {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ─── Design tokens ───
const colors = {
    primary: '#E01E00',
    primaryDark: '#B81800',
    primaryLight: '#FF4D2E',
    accent: '#FF6B47',
    success: '#10B981',
    successDark: '#059669',
    danger: '#EF4444',
    dangerDark: '#DC2626',
    amber: '#F59E0B',
    amberDark: '#D97706',
    bg: '#F8FAFC',
    cardBg: '#FFFFFF',
    textPrimary: '#1E293B',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
};

// ─── Layout wrapper condiviso ───
function wrapEmail(content: string, preheader?: string): string {
    return `<!DOCTYPE html>
<html lang="it" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0; mso-table-rspace: 0; }
    img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; padding: 0 16px !important; }
      .content-cell { padding: 28px 20px !important; }
      .hero-padding { padding: 32px 20px 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${colors.bg};font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  ${preheader ? `<div style="display:none;font-size:1px;color:${colors.bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>` : ''}

  <!-- Outer table -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${colors.bg};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <!-- Container -->
        <table role="presentation" width="580" cellpadding="0" cellspacing="0" class="container" style="max-width:580px;width:100%;">
          ${content}

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-top:1px solid ${colors.border};padding-top:20px;text-align:center;">
                    <p style="margin:0 0 6px;font-size:13px;color:${colors.textMuted};line-height:1.5;">
                      Pro Loco Piedelpoggio &middot; Frazione di Leonessa (RI)
                    </p>
                    <p style="margin:0;font-size:12px;color:${colors.textMuted};line-height:1.5;">
                      Questa email è stata generata automaticamente da <a href="https://piedelpoggio.it" style="color:${colors.primary};text-decoration:none;">piedelpoggio.it</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Componente: Hero banner colorato con titolo ───
function heroSection(title: string, subtitle: string, gradientStart: string, gradientEnd: string, emoji: string): string {
    return `
  <tr>
    <td style="background:linear-gradient(135deg, ${gradientStart}, ${gradientEnd});border-radius:16px 16px 0 0;padding:40px 32px 28px;" class="hero-padding">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="font-size:36px;line-height:1;margin-bottom:12px;">${emoji}</div>
            <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#FFFFFF;line-height:1.3;letter-spacing:-0.3px;">${escapeHtml(title)}</h1>
            <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.85);line-height:1.5;font-weight:400;">${escapeHtml(subtitle)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

// ─── Componente: Riga info con icona ───
function infoRow(label: string, value: string, iconColor: string): string {
    return `
  <tr>
    <td style="padding:12px 0;border-bottom:1px solid ${colors.borderLight};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="8" style="background-color:${iconColor};border-radius:4px;" valign="top">&nbsp;</td>
          <td style="padding-left:16px;" valign="top">
            <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:${colors.textMuted};text-transform:uppercase;letter-spacing:0.8px;">${escapeHtml(label)}</p>
            <p style="margin:0;font-size:15px;font-weight:600;color:${colors.textPrimary};line-height:1.4;">${value}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

// ─── Componente: Card con sfondo leggero ───
function card(content: string, bgColor: string = colors.cardBg): string {
    return `
  <tr>
    <td style="background-color:${bgColor};padding:28px 32px;" class="content-cell">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${content}
      </table>
    </td>
  </tr>`;
}

// ─── Componente: Blocco testuale lungo ───
function textBlock(label: string, text: string, accentColor: string): string {
    return `
  <tr>
    <td style="padding-top:20px;">
      <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:${colors.textMuted};text-transform:uppercase;letter-spacing:0.8px;">${escapeHtml(label)}</p>
      <div style="background-color:${colors.bg};border-left:4px solid ${accentColor};border-radius:0 8px 8px 0;padding:16px 20px;">
        <p style="margin:0;font-size:14px;color:${colors.textPrimary};line-height:1.7;white-space:pre-wrap;">${text}</p>
      </div>
    </td>
  </tr>`;
}

// ─── Componente: Badge di stato ───
function statusBadge(text: string, bgColor: string, textColor: string): string {
    return `<span style="display:inline-block;background-color:${bgColor};color:${textColor};font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:0.6px;">${escapeHtml(text)}</span>`;
}

// ═══════════════════════════════════════════════
//  EMAIL 1: Nuova Idea / Suggerimento
// ═══════════════════════════════════════════════
export function buildIdeaEmail(data: {
    nome: string;
    cognome: string;
    email?: string;
    telefono?: string;
    idea: string;
}): string {
    const { nome, cognome, email, telefono, idea } = data;

    const contactRows = [
        infoRow('Mittente', `${escapeHtml(nome)} ${escapeHtml(cognome)}`, colors.primary),
        email ? infoRow('Email', `<a href="mailto:${escapeHtml(email)}" style="color:${colors.primary};text-decoration:none;">${escapeHtml(email)}</a>`, colors.accent) : '',
        telefono ? infoRow('Telefono', `<a href="tel:${escapeHtml(telefono)}" style="color:${colors.primary};text-decoration:none;">${escapeHtml(telefono)}</a>`, colors.amber) : '',
    ].filter(Boolean).join('');

    const content = [
        heroSection('Nuova idea ricevuta', `${nome} ${cognome} ha inviato un suggerimento`, colors.primary, colors.primaryDark, '💡'),
        card(`
      <tr><td><p style="margin:0 0 16px;font-size:16px;font-weight:700;color:${colors.textPrimary};">Dettagli contatto</p></td></tr>
      ${contactRows}
      ${textBlock('Suggerimento', escapeHtml(idea), colors.primary)}
    `),
        // call to action
        card(`
      <tr>
        <td align="center" style="padding:8px 0;">
          ${email ? `<a href="mailto:${escapeHtml(email)}?subject=Re: Il tuo suggerimento per Piedelpoggio" style="display:inline-block;background:linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark});color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.3px;">Rispondi al mittente</a>` : `<p style="margin:0;font-size:13px;color:${colors.textMuted};font-style:italic;">Nessuna email di contatto fornita</p>`}
        </td>
      </tr>
    `, colors.borderLight),
    ].join('');

    return wrapEmail(content, `Nuovo suggerimento da ${nome} ${cognome}`);
}

// ═══════════════════════════════════════════════
//  EMAIL 2: Nuova Prenotazione Campo
// ═══════════════════════════════════════════════
export function buildNewBookingEmail(data: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    date: string;
    start: string;
    end: string;
    title?: string;
}): string {
    const { customerName, customerPhone, customerEmail, date, start, end, title } = data;

    // Formatta la data in italiano
    const dateObj = new Date(date + 'T00:00:00');
    const giorni = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const mesi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    const formattedDate = `${giorni[dateObj.getDay()]} ${dateObj.getDate()} ${mesi[dateObj.getMonth()]} ${dateObj.getFullYear()}`;

    const infoRows = [
        infoRow('Data', escapeHtml(formattedDate), colors.success),
        infoRow('Orario', `${escapeHtml(start)} – ${escapeHtml(end)}`, colors.successDark),
        title ? infoRow('Descrizione', escapeHtml(title), colors.amber) : '',
    ].filter(Boolean).join('');

    const contactRows = [
        infoRow('Prenotato da', escapeHtml(customerName), colors.primary),
        infoRow('Telefono', `<a href="tel:${escapeHtml(customerPhone)}" style="color:${colors.primary};text-decoration:none;">${escapeHtml(customerPhone)}</a>`, colors.accent),
        customerEmail ? infoRow('Email', `<a href="mailto:${escapeHtml(customerEmail)}" style="color:${colors.primary};text-decoration:none;">${escapeHtml(customerEmail)}</a>`, colors.amber) : '',
    ].filter(Boolean).join('');

    const content = [
        heroSection('Nuova prenotazione', `Campo sportivo prenotato per ${formattedDate}`, colors.success, colors.successDark, '🏟️'),
        card(`
      <tr>
        <td style="padding-bottom:8px;">
          ${statusBadge('Confermata', '#D1FAE5', '#065F46')}
        </td>
      </tr>
      <tr><td><p style="margin:12px 0 16px;font-size:16px;font-weight:700;color:${colors.textPrimary};">Dettagli prenotazione</p></td></tr>
      ${infoRows}
      <tr><td style="padding-top:24px;"><p style="margin:0 0 16px;font-size:16px;font-weight:700;color:${colors.textPrimary};">Contatto</p></td></tr>
      ${contactRows}
    `),
        // Promemoria importo
        card(`
      <tr>
        <td style="background:linear-gradient(135deg, #FEF3C7, #FDE68A);border-radius:12px;padding:20px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="48" valign="top">
                <div style="width:42px;height:42px;background-color:#FFFFFF;border-radius:12px;text-align:center;line-height:42px;font-size:20px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">💰</div>
              </td>
              <td style="padding-left:16px;" valign="top">
                <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:${colors.amberDark};text-transform:uppercase;letter-spacing:0.8px;">Importo da versare</p>
                <p style="margin:0;font-size:28px;font-weight:900;color:#92400E;letter-spacing:-0.5px;">25€</p>
                <p style="margin:4px 0 0;font-size:12px;color:#92400E;opacity:0.8;">da consegnare ad un membro della Pro Loco</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `, colors.borderLight),
    ].join('');

    return wrapEmail(content, `Nuova prenotazione: ${formattedDate} ${start}–${end}`);
}

// ═══════════════════════════════════════════════
//  EMAIL 3: Cancellazione Prenotazione
// ═══════════════════════════════════════════════
export function buildCancelBookingEmail(data: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    date: string;
    start: string;
    end: string;
    title?: string;
}): string {
    const { customerName, customerPhone, customerEmail, date, start, end, title } = data;

    // Formatta la data in italiano
    const dateObj = new Date(date + 'T00:00:00');
    const giorni = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const mesi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    const formattedDate = `${giorni[dateObj.getDay()]} ${dateObj.getDate()} ${mesi[dateObj.getMonth()]} ${dateObj.getFullYear()}`;

    const infoRows = [
        infoRow('Data', escapeHtml(formattedDate), colors.danger),
        infoRow('Orario', `${escapeHtml(start)} – ${escapeHtml(end)}`, colors.dangerDark),
        title ? infoRow('Descrizione', escapeHtml(title), colors.textMuted) : '',
    ].filter(Boolean).join('');

    const contactRows = [
        infoRow('Cancellato da', escapeHtml(customerName), colors.primary),
        infoRow('Telefono', `<a href="tel:${escapeHtml(customerPhone)}" style="color:${colors.primary};text-decoration:none;">${escapeHtml(customerPhone)}</a>`, colors.accent),
        customerEmail ? infoRow('Email', `<a href="mailto:${escapeHtml(customerEmail)}" style="color:${colors.primary};text-decoration:none;">${escapeHtml(customerEmail)}</a>`, colors.amber) : '',
    ].filter(Boolean).join('');

    const content = [
        heroSection('Prenotazione cancellata', `La prenotazione del ${formattedDate} è stata annullata`, colors.danger, colors.dangerDark, '❌'),
        card(`
      <tr>
        <td style="padding-bottom:8px;">
          ${statusBadge('Cancellata', '#FEE2E2', '#991B1B')}
        </td>
      </tr>
      <tr><td><p style="margin:12px 0 16px;font-size:16px;font-weight:700;color:${colors.textPrimary};">Dettagli prenotazione annullata</p></td></tr>
      ${infoRows}
      <tr><td style="padding-top:24px;"><p style="margin:0 0 16px;font-size:16px;font-weight:700;color:${colors.textPrimary};">Contatto</p></td></tr>
      ${contactRows}
    `),
        card(`
      <tr>
        <td style="background-color:#FEF2F2;border-radius:12px;padding:16px 20px;border:1px solid #FECACA;">
          <p style="margin:0;font-size:13px;color:#991B1B;line-height:1.6;">
            <strong>Nota:</strong> Lo slot orario ${escapeHtml(start)} – ${escapeHtml(end)} del ${escapeHtml(formattedDate)} è ora nuovamente disponibile per altre prenotazioni.
          </p>
        </td>
      </tr>
    `, colors.borderLight),
    ].join('');

    return wrapEmail(content, `Prenotazione cancellata: ${formattedDate} ${start}–${end}`);
}
