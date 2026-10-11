# Tai's Study Room Finder

A daily room schedule built with HTML, CSS, and plain JavaScript using your unchanged Fall 2026 classroom JSON. No installation or API key is required.

Created to help students find potential study spaces when library study rooms are booked or the two-hour daily reservation limit is too short. Library booking policy: https://sjlibrary.org/policies-procedures/reservable-spaces.

## Run locally

Clone this repository or extract the downloaded ZIP, then open the project folder in your terminal.

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. Stop the server with Control+C.

Use a web server rather than double-clicking `index.html`; the JavaScript loads the JSON using `fetch()`. No build step or npm install is needed to run the website.

## Using the schedule

- A notice opens every time the page is loaded or revisited. It explains that this is not an official SJSU website and that no scheduled class does not guarantee access or permission to study. Dismiss it with I understand or Escape; dismissal is not saved.
- The building selector shows full names with schedule codes, sorted by name. The underlying JSON and filter values keep their original codes.
- The default theme is dark. The top-right toggle switches to a white/light theme and remembers your choice in this browser when local storage is available.
- Select a building and calendar day. The schedule updates automatically; there is no search button.
- Use the arrows to move one day back or forward within the dataset date range.
- Type a room code or number to filter the rows immediately.
- Building, Day, and Room stay visible. Click **Filters** to expand the optional time and floor controls. The button shows how many extra filters are active even when the panel is collapsed. **Reset filters** clears time and floor while retaining your building, day, and room search.
- Floor options are derived from rooms in the selected building: the first digit of the three-digit room number is used (ENG301 → Floor 3; AF001 → Floor 0). Letter suffixes such as 301A are supported. These labels follow the room-number convention and are not verified physical floor plans. Changing buildings refreshes the options and resets the floor to All floors. All buildings offers the combined floor numbers.
- Optionally choose a time in **Free at** (7 AM–10:30 PM, in 15-minute increments) to show only rooms with no class scheduled at that moment. Choose **Enter an exact time…** if you need a specific minute. The displayed rooms keep their daily timelines. Choose **Any time** or press Clear to show all rooms matching your building and room filters. This checks a single moment, not whether the room remains class-free for a full study session. A class beginning at the selected time blocks the room; a class ending at that time does not.
- Rooms are rows, and hours run horizontally from 7 AM to 10:30 PM in Pacific campus time. Scroll right for later hours. Room labels and hour headers stay visible when scrolling.
- Amber marks gaps between classes strictly shorter than 60 minutes. Gaps of exactly one hour or longer, time before the first class, and time after the last class are green. The color uses the actual gap length, even when a gap is clipped by the 7 AM–10:30 PM display window. Blue blocks contain classes. Select any block for exact times and details, including the next class time. Overlapping and back-to-back classes are merged into continuous occupied blocks, with each meeting listed in the details.

## Files to edit

- `dist/index.html`: structure, filters, and theme toggle.
- `dist/styles.css`: dark/light theme variables and responsive schedule layout.
- `dist/app.js`: load JSON, render the daily timeline, and handle controls.
- `dist/buildings.js`: building names and SJSU source references.
- `dist/filters.js`: room-number floor extraction and building-specific floor options.
- `dist/schedule.js`: date handling, class overlaps, and daily interval calculations.
- `dist/sjsu_fall_2026_room_schedule.json`: your unchanged classroom dataset.

The `dist` folder is the complete standalone website. You can copy its seven files into your existing project folder.

## Data and access

Only rooms in the provided dataset are displayed, preserving its room and building codes. Full names are mapped from SJSU's building-access list, campus maps, Art Foundry page, aviation schedule notes, and facility information. See `BUILDING_NAME_SOURCES` in `dist/buildings.js` for links. Art Foundry and Reid-Hillview are off-campus facilities. The app does not infer room types or permission to study.

This static Fall 2026 export contains 459 rooms and 4,331 meetings. The dataset reports one failed source row and excludes rows without a timed physical room. It is not a complete campus room inventory. Replace the JSON with an updated export in the same schema and reload to update the site; there is no live feed from SJSU.

The day filter checks weekdays and each meeting's inclusive start/end dates, including partial-semester classes. Some multi-session source rows may describe date-specific meetings rather than an ordinary weekly pattern. Events, exams, closures, and other exceptions are not included.

Green means **no scheduled class in the provided data**. It does not confirm that a room is unlocked, unoccupied, or approved for studying. Confirm access before using a room.

## Tests

With Node.js installed, run `npm test` from the project root. Tests cover interval boundaries, weekday codes, partial-semester dates, invalid input, merging overlapping classes, timeline clipping, and distinguishing gaps with a later class from gaps with no more classes.
