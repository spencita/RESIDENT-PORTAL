/**
 * api/calendar.js
 * Vercel serverless function — generates a personalized .ics calendar.
 * Reads schedule data from ./schedule.json (same api/ folder).
 *
 * Usage: GET /api/calendar?name=Maria+Osorio
 * Returns RFC 5545 iCalendar (iPhone/Google/Outlook compatible).
 */

const SCHEDULE = require('./schedule.json');

function escapeICS(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function fold(line) {
  if (line.length <= 75) return line;
  const chunks = [line.slice(0, 75)];
  let pos = 75;
  while (pos < line.length) {
    chunks.push(' ' + line.slice(pos, pos + 74));
    pos += 74;
  }
  return chunks.join('\r\n');
}

function buildICS(resident) {
  const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
  const safeName = resident.name.replace(/\s+/g, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UMJMH//IM Residency AY2627//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    fold('X-WR-CALNAME:UM/JMH IM Residency \u2014 ' + resident.name),
    'X-WR-TIMEZONE:America/New_York',
    'REFRESH-INTERVAL;VALUE=DURATION:PT24H',
    fold('SOURCE;VALUE=URI:https://imcore.org/api/calendar?name=' + encodeURIComponent(resident.name)),
  ];
  resident.events.forEach(function(ev, i) {
    const category = ev.category || ev.title;
    const desc = escapeICS('UM/JMH Internal Medicine Residency\nPeriod: ' + (ev.period || '') + '\nType: ' + category + '\nhttps://imcore.org');
    lines.push('BEGIN:VEVENT');
    lines.push('UID:umjmh-' + safeName + '-' + i + '-ay2627@imcore.org');
    lines.push('DTSTAMP:' + now);
    lines.push('DTSTART;VALUE=DATE:' + ev.start.replace(/-/g, ''));
    lines.push('DTEND;VALUE=DATE:' + ev.end.replace(/-/g, ''));
    lines.push(fold('SUMMARY:' + escapeICS(ev.title)));
    lines.push(fold('DESCRIPTION:' + desc));
    lines.push(fold('CATEGORIES:' + escapeICS(category)));
    lines.push('TRANSP:TRANSPARENT');
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

module.exports = function handler(req, res) {
  const { name } = req.query;
  if (!name) {
    res.status(400).json({ error: 'Missing parameter: name', example: '/api/calendar?name=Maria+Osorio' });
    return;
  }
  const key = Object.keys(SCHEDULE).find(k => k.toLowerCase() === name.toLowerCase().trim());
  if (!key) {
    res.status(404).json({ error: 'Resident not found: ' + name });
    return;
  }
  const ics = buildICS(SCHEDULE[key]);
  const filename = key.replace(/\s+/g, '_') + '_AY2627.ics';
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).send(ics);
};
