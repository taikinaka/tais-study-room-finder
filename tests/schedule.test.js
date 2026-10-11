import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { roomFloor, floorsForBuilding } from '../dist/filters.js';
import { findAvailableRooms, meetingsOnDate, validateSchedule, toMinutes, daySegments, visibleDaySegments, roomHasNoClassAt } from '../dist/schedule.js';

const meeting = { days: ['M', 'W'], start_time: '09:00', end_time: '10:15', start_date: '2026-08-19', end_date: '2026-12-07' };
const data = { timezone: 'America/Los_Angeles', rooms: [
  { building: 'DMH', room: 'DMH227', meetings: [meeting] },
  { building: 'ENG', room: 'ENG301', meetings: [{ ...meeting, start_time: '12:00', end_time: '13:15' }] }
] };
const query = { date: '2026-10-05', time: '09:00', duration: 60 };
const codes = q => findAvailableRooms(data, { ...query, ...q }).map(room => room.room);

test('overlapping classes are excluded, and the building filter narrows results', () => {
  assert.deepEqual(codes({}), ['ENG301']);
  assert.deepEqual(codes({ building: 'DMH' }), []);
  assert.deepEqual(codes({ building: 'ENG' }), ['ENG301']);
});
test('exact endpoints are allowed; partial and contained overlaps are blocked', () => {
  assert.ok(codes({ time: '10:15' }).includes('DMH227'));
  assert.ok(codes({ time: '08:00' }).includes('DMH227'));
  assert.ok(!codes({ time: '08:30' }).includes('DMH227'));
  assert.ok(!codes({ time: '10:00' }).includes('DMH227'));
  assert.ok(!codes({ time: '08:00', duration: 180 }).includes('DMH227'));
});
test('weekday codes including Thursday and Saturday are interpreted correctly', () => {
  assert.deepEqual(codes({ date: '2026-10-06' }), ['DMH227', 'ENG301']);
  const room = { meetings: [{ ...meeting, days: ['R', 'S'] }] };
  assert.equal(meetingsOnDate(room, '2026-10-08').length, 1);
  assert.equal(meetingsOnDate(room, '2026-10-10').length, 1);
  assert.equal(meetingsOnDate(room, '2026-10-09').length, 0);
});
test('partial-semester dates are inclusive and classes outside the range are ignored', () => {
  const room = { meetings: [{ ...meeting, days: ['M'], start_date: '2026-10-05', end_date: '2026-10-12' }] };
  for (const date of ['2026-10-05', '2026-10-12']) assert.equal(meetingsOnDate(room, date).length, 1);
  for (const date of ['2026-09-28', '2026-10-19']) assert.equal(meetingsOnDate(room, date).length, 0);
});
test('all meetings in the study window are considered; next class is chronological', () => {
  const room = { ...data.rooms[0], meetings: [{ ...meeting, start_time: '12:00', end_time: '13:00' }, meeting] };
  const custom = { rooms: [room] };
  assert.equal(findAvailableRooms(custom, { ...query, time: '10:15' })[0].nextMeeting.start_time, '12:00');
  assert.equal(findAvailableRooms(custom, { ...query, time: '10:15', duration: 120 }).length, 0);
});
test('invalid input fails instead of returning false availability', () => {
  assert.throws(() => codes({ date: '2026-02-30' }));
  assert.throws(() => codes({ time: '25:00' }));
  assert.throws(() => codes({ time: '23:45', duration: 30 }));
  assert.throws(() => codes({ duration: 0 }));
  assert.equal(toMinutes('00:00'), 0);
  assert.equal(toMinutes('12:00'), 720);
});
test('malformed schedule meetings are rejected at load', () => {
  assert.throws(() => validateSchedule({ ...data, rooms: [{ ...data.rooms[0], meetings: [{ ...meeting, start_time: 'TBA' }] }] }));
});
test('actual JSON validates and every returned room has no overlapping meeting', () => {
  const actual = JSON.parse(fs.readFileSync(new URL('../dist/sjsu_fall_2026_room_schedule.json', import.meta.url)));
  const range = validateSchedule(actual);
  assert.equal(actual.rooms.length, 459);
  assert.equal(range.meetingCount, 4331);
  for (const date of ['2026-10-05', '2026-10-08', '2026-10-12']) {
    const found = findAvailableRooms(actual, { date, time: '12:00', duration: 60 });
    assert.ok(found.length > 0);
    for (const room of found) {
      assert.ok(meetingsOnDate(room, date).every(m => toMinutes(m.start_time) >= 780 || toMinutes(m.end_time) <= 720));
    }
  }
});

test('day timeline covers the whole day with gaps before and after classes', () => {
  assert.deepEqual(daySegments(data.rooms[0], query.date).map(({type,start,end}) => ({type,start,end})), [
    {type:'free',start:0,end:540}, {type:'busy',start:540,end:615}, {type:'free',start:615,end:1440}
  ]);
  assert.deepEqual(daySegments(data.rooms[0], '2026-10-06'), [{type:'free',start:0,end:1440,meetings:[]}]);
});
test('overlapping, contained and adjacent meetings are merged without inventing gaps', () => {
  const room = { meetings: [
    {...meeting,start_time:'10:00',end_time:'11:00'},
    {...meeting,start_time:'09:00',end_time:'10:15'},
    {...meeting,start_time:'09:30',end_time:'09:45'},
    {...meeting,start_time:'11:00',end_time:'12:00'}
  ] };
  const segments = daySegments(room, query.date);
  assert.deepEqual(segments.map(s=>[s.type,s.start,s.end]), [['free',0,540],['busy',540,720],['free',720,1440]]);
  assert.equal(segments[1].meetings.length,4);
});
test('timeline clips meetings to display window and rejects invalid windows', () => {
  assert.deepEqual(daySegments(data.rooms[0], query.date, 600, 660).map(s=>[s.type,s.start,s.end]), [['busy',600,615],['free',615,660]]);
  assert.throws(()=>daySegments(data.rooms[0],query.date,700,600));
});
test('actual timelines form a contiguous partition; gaps never overlap a class', () => {
  const actual = JSON.parse(fs.readFileSync(new URL('../dist/sjsu_fall_2026_room_schedule.json', import.meta.url)));
  for (const date of ['2026-10-05','2026-10-08','2026-10-12']) for (const room of actual.rooms) {
    const segments = daySegments(room,date);
    assert.equal(segments[0].start,0);
    assert.equal(segments.at(-1).end,1440);
    segments.forEach((segment,i)=>{
      assert.ok(segment.start<segment.end);
      if (i) assert.equal(segment.start,segments[i-1].end);
      if (segment.type==='free') assert.ok(meetingsOnDate(room,date).every(m=>toMinutes(m.start_time)>=segment.end || toMinutes(m.end_time)<=segment.start));
    });
  }
});

test('visible schedule runs from 7 AM to 10:30 PM and distinguishes later classes', () => {
  const segments = visibleDaySegments(data.rooms[0],query.date);
  assert.equal(segments[0].start,420);
  assert.equal(segments.at(-1).end,1350);
  assert.equal(segments[0].nextMeeting.start_time,'09:00');
  assert.equal(segments.at(-1).nextMeeting,null);
  const noClasses = visibleDaySegments(data.rooms[0],'2026-10-06');
  assert.equal(noClasses.length,1);
  assert.equal(noClasses[0].nextMeeting,null);
});
test('later classes outside the display window still distinguish the gap', () => {
  const room = {meetings:[{...meeting,start_time:'23:00',end_time:'23:30'}]};
  const segments = visibleDaySegments(room,query.date);
  assert.equal(segments.length,1);
  assert.equal(segments[0].type,'free');
  assert.equal(segments[0].nextMeeting.start_time,'23:00');
  const expired = {meetings:[{...meeting,end_date:'2026-09-01'}]};
  assert.equal(visibleDaySegments(expired,query.date)[0].nextMeeting,null);
});

test('amber is only for gaps between classes strictly shorter than one hour', () => {
  for (const gap of [30,59,60,90]) {
    const start = 600 + gap;
    const time = `${String(Math.floor(start/60)).padStart(2,'0')}:${String(start%60).padStart(2,'0')}`;
    const room = {meetings:[{...meeting,start_time:'09:00',end_time:'10:00'},{...meeting,start_time:time,end_time:'13:00'}]};
    const segments = visibleDaySegments(room,query.date);
    const middle = segments.find(s=>s.type==='free' && s.start===600);
    assert.equal(middle.isShortGap,gap<60);
    assert.equal(middle.gapMinutes,gap);
    assert.equal(segments[0].isShortGap,false);
    assert.equal(segments.at(-1).isShortGap,false);
  }
});
test('gap colors use actual duration rather than its clipped visible length', () => {
  const long = {meetings:[{...meeting,start_time:'06:00',end_time:'06:15'},{...meeting,start_time:'07:30',end_time:'08:00'}]};
  const gap = visibleDaySegments(long,query.date)[0];
  assert.equal(gap.end-gap.start,30);
  assert.equal(gap.gapMinutes,75);
  assert.equal(gap.isShortGap,false);
  const short = {meetings:[{...meeting,start_time:'06:00',end_time:'06:50'},{...meeting,start_time:'07:10',end_time:'08:00'}]};
  assert.equal(visibleDaySegments(short,query.date)[0].isShortGap,true);
});

test('an empty time filter keeps all rooms; a time excludes occupied rooms', () => {
  assert.deepEqual(data.rooms.filter(room=>roomHasNoClassAt(room,query.date,'')),data.rooms);
  assert.deepEqual(data.rooms.filter(room=>roomHasNoClassAt(room,query.date,'09:30')).map(r=>r.room),['ENG301']);
});
test('point-in-time filter blocks class start and permits exact class end', () => {
  assert.equal(roomHasNoClassAt(data.rooms[0],query.date,'09:00'),false);
  assert.equal(roomHasNoClassAt(data.rooms[0],query.date,'10:14'),false);
  assert.equal(roomHasNoClassAt(data.rooms[0],query.date,'10:15'),true);
  assert.equal(roomHasNoClassAt(data.rooms[0],query.date,'08:59'),true);
});
test('time filter observes weekdays and partial-semester dates', () => {
  assert.equal(roomHasNoClassAt(data.rooms[0],'2026-10-06','09:30'),true);
  const expired = {meetings:[{...meeting,end_date:'2026-09-01'}]};
  assert.equal(roomHasNoClassAt(expired,query.date,'09:30'),true);
  assert.throws(()=>roomHasNoClassAt(data.rooms[0],query.date,'25:00'));
});

test('floor extraction uses the first digit of a three-digit room number', () => {
  assert.equal(roomFloor({building:'ENG',room:'ENG301'}),'3');
  assert.equal(roomFloor({building:'ISB',room:'ISB201A'}),'2');
  assert.equal(roomFloor({building:'AF',room:'AF001'}),'0');
  assert.equal(roomFloor({building:'ENG',room:'ENG12'}),null);
  assert.equal(roomFloor({building:'ENG',room:'ENG1201'}),null);
});
test('floor options are unique and scoped to the selected building', () => {
  const rooms=[{building:'ENG',room:'ENG301'},{building:'ENG',room:'ENG103'},{building:'ENG',room:'ENG305'},{building:'ART',room:'ART201'}];
  assert.deepEqual(floorsForBuilding(rooms,'ENG'),['1','3']);
  assert.deepEqual(floorsForBuilding(rooms,'ART'),['2']);
  assert.deepEqual(floorsForBuilding(rooms),['1','2','3']);
});
