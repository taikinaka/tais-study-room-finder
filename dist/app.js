import { validateSchedule, parseDate, toMinutes, formatTime, visibleDaySegments, SCHEDULE_START, SCHEDULE_END, roomHasNoClassAt } from './schedule.js';
import { buildingLabel } from './buildings.js';
import { roomFloor, floorsForBuilding } from './filters.js';

const $ = id => document.getElementById(id);
const controls = ['building', 'date', 'room-filter', 'time-choice', 'time-filter', 'clear-time', 'floor-filter', 'filter-toggle', 'reset-extra-filters'];
const HOUR_WIDTH = 80, DAY_WIDTH = (SCHEDULE_END - SCHEDULE_START) / 60 * HOUR_WIDTH;
let schedule, range, selectedBlock;
const dayLabel = date => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(parseDate(date));

// Show on every visit/reload, including restoration from the back-forward cache.
// Dismissal is deliberately not saved in sessionStorage or localStorage.
function showWelcomeNotice() {
  if (!$('welcome-notice').open) $('welcome-notice').showModal();
}
showWelcomeNotice();
window.addEventListener('pageshow', showWelcomeNotice);

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function updateThemeButton() {
  const isDark = document.documentElement.dataset.theme !== 'light';
  $('theme-toggle').textContent = isDark ? '☀ Light theme' : '☾ Dark theme';
  $('theme-toggle').setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
}
$('theme-toggle').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('study-room-theme', theme); } catch {}
  updateThemeButton();
});
updateThemeButton();

function showError(message) {
  $('error').textContent = message;
  $('error').hidden = false;
  $('schedule-section').hidden = true;
  $('previous-day').disabled = true;
  $('next-day').disabled = true;
}

function showDetails(room, segment, button) {
  if (selectedBlock) selectedBlock.setAttribute('aria-pressed', 'false');
  selectedBlock = button;
  button.setAttribute('aria-pressed', 'true');
  const time = `${formatTime(segment.start)} – ${formatTime(segment.end)}`;
  $('details-title').textContent = `${room.room} · ${segment.type === 'free' ? 'No scheduled class' : 'Class scheduled'}`;
  $('details-content').replaceChildren(element('p', '', `${dayLabel($('date').value)} · ${time} · Pacific time`));
  if (segment.type === 'free') {
    const minutes = segment.end - segment.start;
    const hours = Math.floor(minutes / 60), remainder = minutes % 60;
    const length = [hours ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : '', remainder ? `${remainder} minutes` : ''].filter(Boolean).join(' ');
    $('details-content').append(element('p', '', `${length} with no scheduled class in this dataset. Check that the room is unlocked and permitted for study.`));
    $('details-content').append(element('p', '', segment.nextMeeting
      ? `Next class: ${segment.nextMeeting.course || 'Class'} at ${formatTime(toMinutes(segment.nextMeeting.start_time))}.`
      : 'No more classes are listed for this room today.'));
    if (segment.isShortGap) $('details-content').append(element('p', '', `Short gap between classes: ${segment.gapMinutes} minutes total.`));
  } else {
    const list = element('ul', '');
    for (const meeting of segment.meetings) {
      list.append(element('li', '', `${meeting.course || 'Class'}${meeting.title ? ' · ' + meeting.title : ''} · ${formatTime(toMinutes(meeting.start_time))} – ${formatTime(toMinutes(meeting.end_time))}`));
    }
    $('details-content').append(list);
  }
  $('details').hidden = false;
  $('close-details').focus({ preventScroll: true });
  $('details').scrollIntoView({ block: 'nearest' });
}
$('close-details').addEventListener('click', () => {
  $('details').hidden = true;
  if (selectedBlock) { selectedBlock.setAttribute('aria-pressed', 'false'); selectedBlock.focus(); }
});

function track() {
  const node = element('div', 'timeline-track');
  node.style.width = `${DAY_WIDTH}px`;
  node.style.setProperty('--hour-width', `${HOUR_WIDTH}px`);
  return node;
}

function renderSchedule() {
  if (!schedule) return;
  try {
    const date = $('date').value;
    parseDate(date);
    if (date < range.firstDate || date > range.lastDate) throw new Error('Choose a day within this dataset’s date range.');
    $('error').hidden = true;
    $('details').hidden = true;
    selectedBlock = null;
    $('previous-day').disabled = date <= range.firstDate;
    $('next-day').disabled = date >= range.lastDate;
    const building = $('building').value, filter = $('room-filter').value.trim().toUpperCase();
    const selectedTime = $('time-filter').value;
    const floor = $('floor-filter').value;
    const activeFilters = Number(Boolean(selectedTime || $('time-filter').validity.badInput)) + Number(floor !== '');
    $('filter-count').textContent = activeFilters;
    $('filter-count').hidden = activeFilters === 0;
    $('filter-toggle').setAttribute('aria-label', `Filters${activeFilters ? ', ' + activeFilters + ' active' : ''}`);
    $('reset-extra-filters').disabled = !floor && !$('time-choice').value;
    $('clear-time').disabled = selectedTime === '' && !$('time-filter').validity.badInput;
    if ($('time-filter').validity.badInput) throw new Error('Enter a complete time, or use Clear to remove the time filter.');
    if (selectedTime && (toMinutes(selectedTime) < SCHEDULE_START || toMinutes(selectedTime) > SCHEDULE_END)) throw new Error('Choose a time between 7 AM and 10:30 PM, or clear the time filter.');
    const rooms = schedule.rooms.filter(room => (!building || room.building === building) && room.room.toUpperCase().includes(filter) && (floor === '' || roomFloor(room) === floor) && roomHasNoClassAt(room, date, selectedTime))
      .sort((a, b) => a.building.localeCompare(b.building) || a.room.localeCompare(b.room, undefined, { numeric: true }));
    $('schedule-title').textContent = dayLabel(date);
    $('schedule-summary').textContent = `${building ? buildingLabel(building) : 'All buildings'}${floor !== '' ? ' · Floor ' + floor : ''} · ${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'} · 7 AM – 10:30 PM${selectedTime ? ' · No scheduled class at ' + formatTime(toMinutes(selectedTime)) : ''}`;
    const axis = element('div', 'timeline-row timeline-axis');
    axis.setAttribute('role', 'row');
    const heading = element('div', 'room-label', 'ROOM');
    heading.setAttribute('role', 'columnheader');
    const hours = track(); hours.setAttribute('role', 'columnheader'); hours.setAttribute('aria-label', 'Hours in Pacific time');
    for (let hour = SCHEDULE_START / 60; hour * 60 <= SCHEDULE_END - 60; hour++) {
      const tick = element('span', 'hour-label', `${hour % 12 || 12} ${hour >= 12 ? 'PM' : 'AM'}`);
      tick.style.left = `${(hour * 60 - SCHEDULE_START) / 60 * HOUR_WIDTH}px`; hours.append(tick);
    }
    hours.append(element('span', 'hour-label last-hour', '10:30 PM'));
    axis.append(heading, hours);
    const rows = rooms.map(room => {
      const row = element('div', 'timeline-row'); row.setAttribute('role', 'row');
      const name = element('div', 'room-label', room.room); name.setAttribute('role', 'rowheader');
      const lane = track(); lane.setAttribute('role', 'cell'); lane.setAttribute('aria-label', `${room.room} class schedule`);
      for (const segment of visibleDaySegments(room, date)) {
        const width = (segment.end - segment.start) / 60 * HOUR_WIDTH;
        const later = segment.type === 'free' && segment.isShortGap;
        const button = element('button', `time-block ${segment.type}${later ? ' later' : ''}${width < 40 ? ' narrow' : ''}`);
        button.type = 'button';
        button.style.left = `${(segment.start - SCHEDULE_START) / 60 * HOUR_WIDTH + 1}px`;
        button.style.width = `${Math.max(1, width - 2)}px`;
        const title = segment.type === 'free' ? later ? 'Short gap' : 'No class' : segment.meetings.length > 1 ? `${segment.meetings.length} classes` : segment.meetings[0].course || 'Class';
        const status = segment.type === 'free' ? `No scheduled class${later ? '; gap between classes under one hour' : ''}${segment.nextMeeting ? '; next class at ' + formatTime(toMinutes(segment.nextMeeting.start_time)) : '; no more classes listed today'}` : 'Class scheduled';
        const time = `${formatTime(segment.start)} – ${formatTime(segment.end)}`;
        const description = `${room.room}: ${status}, ${time}${segment.type === 'busy' ? '. ' + segment.meetings.map(meeting => meeting.course || 'Class').join(', ') : ''}`;
        button.setAttribute('aria-label', description);
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-controls', 'details');
        button.title = description;
        if (width >= 40) button.append(element('span', 'block-title', title));
        if (width >= 130) button.append(element('span', 'block-time', time));
        button.addEventListener('click', () => showDetails(room, segment, button));
        lane.append(button);
      }
      row.append(name, lane); return row;
    });
    const previousScroll = $('schedule-scroll').scrollLeft;
    $('timeline').replaceChildren(axis, ...rows);
    $('schedule-scroll').scrollLeft = previousScroll;
    $('schedule-scroll').hidden = rooms.length === 0;
    $('empty').hidden = rooms.length > 0;
    $('schedule-section').hidden = false;
    $('announcement').textContent = `Schedule updated: ${$('schedule-title').textContent}. ${$('schedule-summary').textContent}.`;
  } catch (error) { showError(error.message); }
}

function changeDay(offset) {
  try {
    const date = parseDate($('date').value);
    date.setUTCDate(date.getUTCDate() + offset);
    const next = date.toISOString().slice(0, 10);
    if (next < range.firstDate || next > range.lastDate) return;
    $('date').value = next; renderSchedule();
  } catch (error) { showError(error.message); }
}
$('previous-day').addEventListener('click', () => changeDay(-1));
$('next-day').addEventListener('click', () => changeDay(1));
function updateFloorOptions() {
  const floors = floorsForBuilding(schedule.rooms, $('building').value);
  $('floor-filter').replaceChildren(new Option('All floors', ''), ...floors.map(floor => new Option(`Floor ${floor}`, floor)));
  $('floor-filter').value = '';
}
$('building').addEventListener('change', () => { updateFloorOptions(); renderSchedule(); });
for (const id of ['date', 'floor-filter']) $(id).addEventListener('change', renderSchedule);
$('filter-toggle').addEventListener('click', () => {
  const expanded = $('filter-toggle').getAttribute('aria-expanded') !== 'true';
  $('filter-toggle').setAttribute('aria-expanded', String(expanded));
  $('filter-panel').hidden = !expanded;
});
$('reset-extra-filters').addEventListener('click', () => {
  $('floor-filter').value = '';
  $('time-choice').value = '';
  $('time-filter').value = '';
  $('custom-time-control').hidden = true;
  renderSchedule();
});
$('room-filter').addEventListener('input', renderSchedule);
const timeOptions = [new Option('Any time · All rooms', '')];
for (let minute = SCHEDULE_START; minute <= SCHEDULE_END; minute += 15) {
  const value = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  timeOptions.push(new Option(formatTime(minute), value));
}
timeOptions.push(new Option('Enter an exact time…', 'custom'));
$('time-choice').replaceChildren(...timeOptions);
$('time-choice').addEventListener('change', () => {
  const choice = $('time-choice').value;
  $('custom-time-control').hidden = choice !== 'custom';
  if (choice === 'custom') $('time-filter').focus();
  else $('time-filter').value = choice;
  renderSchedule();
});
$('time-filter').addEventListener('input', renderSchedule);
$('clear-time').addEventListener('click', () => {
  $('time-choice').value = '';
  $('time-filter').value = '';
  $('custom-time-control').hidden = true;
  renderSchedule();
  $('time-choice').focus();
});

async function loadSchedule() {
  try {
    const response = await fetch('./sjsu_fall_2026_room_schedule.json');
    if (!response.ok) throw new Error(`Could not load the classroom JSON (HTTP ${response.status}).`);
    const data = await response.json();
    range = validateSchedule(data);
    schedule = data;
    const buildings = [...new Set(schedule.rooms.map(room => room.building))].sort((a, b) => buildingLabel(a).localeCompare(buildingLabel(b)));
    $('building').replaceChildren(new Option('All buildings', ''), ...buildings.map(code => new Option(buildingLabel(code), code)));
    $('building').value = buildings.includes('ENG') ? 'ENG' : buildings[0];
    updateFloorOptions();
    $('date').min = range.firstDate; $('date').max = range.lastDate;
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const part = name => parts.find(value => value.type === name).value;
    const today = `${part('year')}-${part('month')}-${part('day')}`;
    $('date').value = today < range.firstDate ? range.firstDate : today > range.lastDate ? range.lastDate : today;
    $('term').textContent = schedule.term || 'Class schedule';
    $('data-status').textContent = `${schedule.rooms.length} rooms across ${buildings.length} buildings and facilities · ${dayLabel(range.firstDate)} – ${dayLabel(range.lastDate)} · Static schedule snapshot.`;
    $('dataset-summary').textContent = `${schedule.term || ''} · Static snapshot; no live updates`;
    controls.forEach(id => { $(id).disabled = false; });
    renderSchedule();
    // The first visible hour is 7 AM; room labels remain pinned while scrolling.
    $('schedule-scroll').scrollLeft = 0;
  } catch (error) {
    controls.forEach(id => { $(id).disabled = true; });
    $('data-status').textContent = 'Schedule unavailable.';
    showError(`${error.message} Keep the classroom JSON beside index.html and run the site through a web server. See README.md for setup.`);
  }
}
loadSchedule();
