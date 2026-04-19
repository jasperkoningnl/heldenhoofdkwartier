// Helden Hoofdkwartier — Game Data
// Missie 1: De Vloedgolf

const HEROES = [
  {
    id: 'kapitein_holland',
    name: 'Kapitein Holland',
    KR: 7, IN: 7, SN: 7,
    color: 'orange',
    role: 'Frontline Defender',
    power: 'Water Might',
    powerDesc: 'Bij Water Level > 0: +1 op alle stats in die stad.',
    portrait: 'assets/hero-kapitein_holland.png'
  },
  {
    id: 'muisman',
    name: 'Muisman',
    KR: 1, IN: 6, SN: 9,
    color: 'grey',
    role: 'Infiltration Specialist',
    power: 'Infiltration',
    powerDesc: 'Snelste reistijden van alle helden.',
    portrait: 'assets/hero-muisman.png'
  },
  {
    id: 'polder_parel',
    name: 'Polder Parel',
    KR: 10, IN: 1, SN: 3,
    color: 'rwb',
    role: 'Elemental Support',
    power: 'Land Reclamation',
    powerDesc: 'Mitigate in Amsterdam: pauzeert ALLE waterstijging voor 2 beurten.',
    portrait: 'assets/hero-polder_prinses.png'
  },
  {
    id: 'gloeidraad',
    name: 'Gloeidraad',
    KR: 2, IN: 10, SN: 4,
    color: 'ywb',
    role: 'Kinetic Specialist',
    power: 'Data Hack',
    powerDesc: 'Analyze vanuit HQ: reveal ALLE steden in één actie.',
    portrait: 'assets/hero-gloeidraad.png'
  }
];

// Travel times in turns, from Amsterdam to destination (mirror for return).
const TRAVEL_TIMES = {
  kapitein_holland: { den_helder: 1, renesse: 2, amsterdam: 0 },
  muisman:          { den_helder: 1, renesse: 1, amsterdam: 0 },
  polder_parel:     { den_helder: 2, renesse: 3, amsterdam: 0 },
  gloeidraad:       { den_helder: 2, renesse: 3, amsterdam: 0 }
};

function makeInitialLocations() {
  return {
    amsterdam: {
      id: 'amsterdam',
      name: 'Amsterdam',
      subtitle: 'HQ',
      waterLevel: 0,
      saved: false,
      flooded: false,
      analyzed: true,
      requirement: { or: [ { stat: 'KR', min: 7 }, { stat: 'SN', min: 7 } ] },
      x: 38, y: 38
    },
    den_helder: {
      id: 'den_helder',
      name: 'Den Helder',
      subtitle: 'Marinebasis',
      waterLevel: 0,
      saved: false,
      flooded: false,
      analyzed: false,
      requirement: { stat: 'KR', min: 7 },
      x: 30, y: 19
    },
    renesse: {
      id: 'renesse',
      name: 'Renesse',
      subtitle: 'Toeristen',
      waterLevel: 0,
      saved: false,
      flooded: false,
      analyzed: false,
      requirement: { stat: 'SN', min: 8 },
      x: 20, y: 67
    }
  };
}

const MISSION1_BRIEFING =
  'MISSIE 1: DE VLOEDGOLF — Een mysterieuze storm teistert Nederland! ' +
  'Voorkom een ramp in Renesse, Den Helder en Amsterdam voordat het water wint.';
