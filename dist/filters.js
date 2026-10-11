// Floors follow the user's room-number convention, not a verified floor plan.
export function roomFloor(room) {
  if (!room.room.startsWith(room.building)) return null;
  const number = room.room.slice(room.building.length).trim();
  const match = number.match(/^(\d)\d{2}[A-Za-z]?$/);
  return match ? match[1] : null;
}

export function floorsForBuilding(rooms, building = '') {
  return [...new Set(rooms.filter(room => !building || room.building === building)
    .map(roomFloor).filter(floor => floor !== null))].sort((a, b) => Number(a) - Number(b));
}
