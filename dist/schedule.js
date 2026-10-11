// Pure scheduling functions. Times are minutes after midnight in campus time.
export const DAY_CODES = ['U', 'M', 'T', 'W', 'R', 'F', 'S'];
export const SCHEDULE_START = 7 * 60;
export const SCHEDULE_END = 22 * 60 + 30;

export function toMinutes(time) {
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error('Choose a valid time.');
  }
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function parseDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Choose a valid day.');
  const value = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== date) throw new Error('Choose a valid day.');
  return value;
}

export function validateSchedule(data) {
  if (!data || !Array.isArray(data.rooms) || !data.rooms.length) throw new Error('The JSON must contain a nonempty rooms array.');
  if (data.timezone !== 'America/Los_Angeles') throw new Error('Expected a schedule in America/Los_Angeles campus time.');
  let firstDate = '9999-12-31', lastDate = '0000-01-01';
  let meetingCount = 0;
  const seen = new Set();
  for (const room of data.rooms) {
    if (!room.room || typeof room.room !== 'string' || !room.building || typeof room.building !== 'string' || !Array.isArray(room.meetings) || !room.meetings.length) throw new Error('A room is missing its code, building, or meetings.');
    if (seen.has(room.room)) throw new Error(`Duplicate room: ${room.room}`);
    seen.add(room.room);
    for (const meeting of room.meetings) {
      if (!Array.isArray(meeting.days) || !meeting.days.length || meeting.days.some(day => !DAY_CODES.includes(day))) throw new Error(`Invalid meeting days in ${room.room}.`);
      parseDate(meeting.start_date); parseDate(meeting.end_date);
      if (meeting.start_date > meeting.end_date || toMinutes(meeting.start_time) >= toMinutes(meeting.end_time)) throw new Error(`Invalid meeting range in ${room.room}.`);
      firstDate = meeting.start_date < firstDate ? meeting.start_date : firstDate;
      lastDate = meeting.end_date > lastDate ? meeting.end_date : lastDate;
      meetingCount++;
    }
  }
  return { firstDate, lastDate, meetingCount };
}

export function meetingsOnDate(room, date) {
  const day = DAY_CODES[parseDate(date).getUTCDay()];
  return room.meetings.filter(meeting => meeting.days.includes(day) && meeting.start_date <= date && date <= meeting.end_date)
    .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
}

export function roomHasNoClassAt(room, date, time = '') {
  if (time === '') return true;
  const minute = toMinutes(time);
  return !meetingsOnDate(room, date).some(meeting =>
    toMinutes(meeting.start_time) <= minute && minute < toMinutes(meeting.end_time));
}

export function findAvailableRooms(data, { building = '', date, time, duration = 60 }) {
  parseDate(date);
  const start = toMinutes(time), length = Number(duration), end = start + length;
  if (!Number.isInteger(length) || length <= 0 || end > 1440) throw new Error('Choose a study session that finishes by midnight.');
  return data.rooms.filter(room => !building || room.building === building).flatMap(room => {
    const meetings = meetingsOnDate(room, date);
    // Half-open intervals: a class ending at 10:00 does not block a 10:00 search.
    const occupied = meetings.some(meeting => toMinutes(meeting.start_time) < end && start < toMinutes(meeting.end_time));
    if (occupied) return [];
    const nextMeeting = meetings.find(meeting => toMinutes(meeting.start_time) >= end) ?? null;
    return [{ ...room, nextMeeting }];
  }).sort((a, b) => a.building.localeCompare(b.building) || a.room.localeCompare(b.room, undefined, { numeric: true }));
}

export function formatTime(minutes) {
  if (minutes === 1440) return 'midnight';
  const hours = Math.floor(minutes / 60), remainder = minutes % 60;
  return `${hours % 12 || 12}:${String(remainder).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
}

// Build a complete day as alternating gaps and occupied intervals. Overlapping
// (or back-to-back) meetings form one busy block so no false gap appears.
export function daySegments(room, date, start = 0, end = 1440) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 1440 || start >= end) throw new Error('Invalid schedule window.');
  const busy = [];
  for (const meeting of meetingsOnDate(room, date)) {
    const from = Math.max(start, toMinutes(meeting.start_time));
    const to = Math.min(end, toMinutes(meeting.end_time));
    if (from >= to) continue;
    const previous = busy.at(-1);
    if (previous && from <= previous.end) {
      previous.end = Math.max(previous.end, to);
      previous.meetings.push(meeting);
    } else busy.push({ type: 'busy', start: from, end: to, meetings: [meeting] });
  }
  const segments = [];
  let cursor = start;
  for (const interval of busy) {
    if (cursor < interval.start) segments.push({ type: 'free', start: cursor, end: interval.start, meetings: [] });
    segments.push(interval);
    cursor = interval.end;
  }
  if (cursor < end) segments.push({ type: 'free', start: cursor, end, meetings: [] });
  return segments;
}

export function visibleDaySegments(room, date) {
  const meetings = meetingsOnDate(room, date);
  const fullDay = daySegments(room, date);
  return fullDay.flatMap((segment, index) => {
    const start = Math.max(SCHEDULE_START, segment.start);
    const end = Math.min(SCHEDULE_END, segment.end);
    if (start >= end) return [];
    if (segment.type !== 'free') return [{ ...segment, start, end }];
    // Use the actual gap, before clipping to the visible 7 AM–10:30 PM window.
    const gapMinutes = segment.end - segment.start;
    const betweenClasses = fullDay[index - 1]?.type === 'busy' && fullDay[index + 1]?.type === 'busy';
    const nextMeeting = meetings.find(meeting => toMinutes(meeting.start_time) >= segment.end) ?? null;
    return [{ ...segment, start, end, nextMeeting, gapMinutes, isShortGap: Boolean(betweenClasses && gapMinutes < 60) }];
  });
}
