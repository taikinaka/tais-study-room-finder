// Names checked against SJSU building access, campus maps, and facility pages.
// Keep the dataset's codes unchanged; names are presentation labels only.
export const BUILDING_NAMES = Object.freeze({
  AF: 'Art Foundry',
  ART: 'Art Building',
  BBC: 'Boccardo Business Complex',
  CCB: 'Central Classroom Building',
  CL: 'Clark Hall',
  DBH: 'Dwight Bentel Hall',
  DH: 'Duncan Hall',
  DMH: 'Dudley Moorhead Hall',
  ENG: 'Engineering Building',
  FO: 'Faculty Office Building',
  HB: 'Health Building',
  HGH: 'Hugh Gillis Hall',
  IS: 'Industrial Studies',
  ISB: 'Interdisciplinary Science Building',
  MD: 'Morris Dailey Auditorium',
  MH: 'MacQuarrie Hall',
  MUS: 'Music Building',
  RHV: 'Reid-Hillview Aviation Facility',
  SCI: 'Science Building',
  SH: 'Sweeney Hall',
  SPXC: 'Spartan Complex Central',
  SPXE: 'Spartan Complex East',
  WSQ: 'Washington Square Hall',
  YUH: 'Yoshihiro Uchida Hall'
});

export function buildingLabel(code) {
  return BUILDING_NAMES[code] ? `${BUILDING_NAMES[code]} (${code})` : code;
}

export const BUILDING_NAME_SOURCES = [
  'https://www.sjsu.edu/fdo/services/buildings/buildingaccess.php',
  'https://sjsu.edu/studentunion/docs/ord2025May12692_CampusMap_8.5x11_2025_Display.pdf',
  'https://www.sjsu.edu/cds/docs/SJSU_campus_map.pdf',
  'https://www.sjsu.edu/art/programs/spatial-art.php',
  'https://gs.sjsu.edu/classes/schedules/archive/subject-notes/archive/spring-2022.php',
  'https://itservicedesk.sjsu.edu/about/partnerships.php'
];
