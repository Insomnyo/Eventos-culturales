import fs from 'node:fs/promises';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';
import { shortTicket } from './tickets.js';
import { formatDni } from './dni.js';

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

// Escapa HTML: nombre/título/ubicación los escribe un usuario → nunca se interpolan crudos en el correo.
const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const formatDate = (date) =>
  new Intl.DateTimeFormat('es-AR', { dateStyle: 'full', timeStyle: 'short', timeZone: env.EVENT_TIMEZONE }).format(new Date(date));

const layout = (body) => `<!doctype html><html lang="es"><body style="margin:0;background:#f6f1f7;font-family:Arial,Helvetica,sans-serif;color:#1e0f2b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
      <tr><td style="background:#2b1240;padding:24px 28px;color:#e3c27a;font-size:22px;font-weight:bold">Telón</td></tr>
      <tr><td style="padding:28px">${body}</td></tr>
    </table>
  </td></tr></table></body></html>`;

export function buildTicketEmail({ name, dni, event, ticketCode }) {
  const when = formatDate(event.starts_at);
  const dniText = dni ? formatDni(dni) : null;
  return {
    subject: `Tu entrada para ${event.title}`,
    text: [
      `Hola ${name},`, '', `Tu lugar está confirmado: ${event.title}`, `Fecha: ${when}`, `Lugar: ${event.location}`, '',
      `Código de entrada: ${ticketCode}`, ...(dniText ? [`DNI del titular: ${dniText}`] : []),
      'Presentalo en la puerta. Si olvidaste la entrada, el organizador puede encontrarte con tu DNI. También lo ves en "Mis entradas" dentro de tu cuenta.',
    ].join('\n'),
    html: layout(`
      <p style="margin:0 0 6px">Hola ${escapeHtml(name)}, tu lugar está confirmado.</p>
      <h1 style="margin:0 0 16px;font-size:24px;color:#4a1d5c">${escapeHtml(event.title)}</h1>
      <p style="margin:0 0 4px"><strong>Fecha:</strong> ${escapeHtml(when)}</p>
      <p style="margin:0 0 20px"><strong>Lugar:</strong> ${escapeHtml(event.location)}</p>
      <div style="border:2px dashed #c99a3b;border-radius:10px;padding:16px;text-align:center">
        <div style="font-size:12px;color:#7b4f34">Código de entrada</div>
        <div style="font-size:20px;font-weight:bold;letter-spacing:1px;margin-top:4px">${escapeHtml(shortTicket(ticketCode))}</div>
        <div style="font-size:11px;color:#6b5a75;margin-top:6px;word-break:break-all">${escapeHtml(ticketCode)}</div>
        ${dniText ? `<div style="margin-top:10px;font-size:13px;color:#1e0f2b"><strong>DNI del titular:</strong> ${escapeHtml(dniText)}</div>` : ''}
      </div>
      <p style="margin:20px 0 0;font-size:13px;color:#6b5a75">Presentá este código en la puerta. Si te olvidás la entrada, el organizador puede encontrarte con tu DNI. También la tenés en “Mis entradas” dentro de tu cuenta.</p>`),
  };
}

/** Aviso de cambio de día/hora o de cancelación de un evento. `link` es null si el evento ya no existe. */
export function buildEventChangeEmail({ name, type, title, oldStartsAt, newStartsAt, link }) {
  const button = link
    ? `<p style="margin:0 0 20px"><a href="${escapeHtml(link)}" style="background:#4a1d5c;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Ver el evento</a></p>`
    : '';
  if (type === 'event_cancelled') {
    return {
      subject: `Se canceló «${title}»`,
      text: `Hola ${name},\n\nLamentamos avisarte que se canceló el evento «${title}». Tu reserva quedó sin efecto.${link ? `\n\nMás información: ${link}` : ''}`,
      html: layout(`
        <p style="margin:0 0 6px">Hola ${escapeHtml(name)},</p>
        <h1 style="margin:0 0 16px;font-size:22px;color:#b3261e">Se canceló «${escapeHtml(title)}»</h1>
        <p style="margin:0 0 20px">Lamentamos avisarte que este evento se canceló y tu reserva quedó sin efecto. Podés ver otras funciones en la cartelera.</p>
        ${button}`),
    };
  }
  const before = formatDate(oldStartsAt);
  const after = formatDate(newStartsAt);
  return {
    subject: `Cambió el horario de «${title}»`,
    text: `Hola ${name},\n\nEl evento «${title}» cambió de día u horario.\n\nAntes: ${before}\nAhora: ${after}\n\nTu reserva sigue vigente. Si no podés asistir en la nueva fecha, podés cancelarla desde "Mis entradas".${link ? `\n\nVer el evento: ${link}` : ''}`,
    html: layout(`
      <p style="margin:0 0 6px">Hola ${escapeHtml(name)},</p>
      <h1 style="margin:0 0 16px;font-size:22px;color:#4a1d5c">Cambió el horario de «${escapeHtml(title)}»</h1>
      <p style="margin:0 0 4px;color:#6b5a75"><strong>Antes:</strong> <s>${escapeHtml(before)}</s></p>
      <p style="margin:0 0 20px"><strong>Ahora:</strong> ${escapeHtml(after)}</p>
      <p style="margin:0 0 20px;font-size:14px">Tu reserva sigue vigente. Si no podés asistir en la nueva fecha, podés cancelarla desde “Mis entradas” para liberar tu lugar.</p>
      ${button}`),
  };
}

export function buildVerificationEmail({ name, link }) {
  return {
    subject: 'Verificá tu email en Telón',
    text: `Hola ${name},\n\nPara activar las reservas verificá tu email con este enlace (vence en 24 horas):\n${link}\n\nSi no creaste una cuenta, ignorá este mensaje.`,
    html: layout(`
      <p style="margin:0 0 12px">Hola ${escapeHtml(name)}, ¡bienvenido/a a Telón!</p>
      <p style="margin:0 0 20px">Verificá tu email para poder reservar lugares. El enlace vence en 24 horas.</p>
      <p style="margin:0 0 20px"><a href="${escapeHtml(link)}" style="background:#4a1d5c;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Verificar mi email</a></p>
      <p style="margin:0;font-size:12px;color:#6b5a75;word-break:break-all">Si el botón no funciona, copiá este enlace: ${escapeHtml(link)}</p>`),
  };
}

/**
 * Envía un correo. Devuelve true si salió por SMTP.
 * Sin SMTP configurado (típico en local): se imprime el contenido en la consola del backend
 * y se guarda un .html en backend/mail-outbox/ para poder abrirlo en el navegador.
 * Nunca lanza: un fallo de correo no debe romper la operación de negocio.
 */
export async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    try {
      const dir = path.join(env.backendRoot, 'mail-outbox');
      await fs.mkdir(dir, { recursive: true });
      const safeName = to.replace(/[^a-z0-9@.-]/gi, '_');
      await fs.writeFile(path.join(dir, `${Date.now()}-${safeName}.html`), html, 'utf8');
    } catch { /* ignorar */ }
    logger.warn(`\n──────── EMAIL (SMTP sin configurar) ────────\nPara: ${to}\nAsunto: ${subject}\n\n${text}\n──────────────────────────────────────────────`);
    return false;
  }
  try {
    await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, text, html });
    return true;
  } catch (err) {
    logger.error({ err: err.message }, 'Fallo al enviar el correo');
    return false;
  }
}

export const sendTicketEmail = ({ to, name, dni, event, ticketCode }) => sendMail({ to, ...buildTicketEmail({ name, dni, event, ticketCode }) });
/**
 * Envía el aviso a cada persona afectada, de a 5 por vez (sin saturar el servidor SMTP).
 * Se llama DESPUÉS de confirmar el cambio en la base y sin esperar la respuesta HTTP: un fallo de correo
 * nunca revierte el cambio del evento (los avisos de la campana ya quedaron guardados).
 */
export async function sendEventChangeEmails(recipients, payload) {
  let sent = 0;
  for (let i = 0; i < recipients.length; i += 5) {
    const results = await Promise.allSettled(recipients.slice(i, i + 5).map((r) =>
      sendMail({ to: r.email, ...buildEventChangeEmail({ ...payload, name: r.full_name }) })));
    sent += results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
  }
  logger.info({ recipients: recipients.length, sent, type: payload.type }, 'Avisos de cambio de evento por correo procesados');
  return sent;
}

export const sendVerificationEmail = ({ to, name, link }) => sendMail({ to, ...buildVerificationEmail({ name, link }) });
