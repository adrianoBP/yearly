// shortcut: hand-picked common airlines and airports; swap for the OpenFlights/OurAirports datasets if users hit gaps
export const AIRLINES: Record<string, string> = {
  A3: 'Aegean Airlines', AA: 'American Airlines', AC: 'Air Canada', AF: 'Air France', AI: 'Air India',
  AM: 'Aeroméxico', AR: 'Aerolíneas Argentinas', AS: 'Alaska Airlines', AV: 'Avianca', AY: 'Finnair',
  AZ: 'ITA Airways', B6: 'JetBlue', BA: 'British Airways', BT: 'airBaltic', BY: 'TUI Airways',
  CA: 'Air China', CX: 'Cathay Pacific', CZ: 'China Southern', DE: 'Condor', DL: 'Delta Air Lines',
  DY: 'Norwegian', EI: 'Aer Lingus', EK: 'Emirates', EN: 'Air Dolomiti', ET: 'Ethiopian Airlines',
  EW: 'Eurowings', EY: 'Etihad Airways', FI: 'Icelandair', FR: 'Ryanair', HV: 'Transavia',
  I2: 'Iberia Express', IB: 'Iberia', JL: 'Japan Airlines', JQ: 'Jetstar', KE: 'Korean Air',
  KL: 'KLM', LA: 'LATAM', LG: 'Luxair', LH: 'Lufthansa', LO: 'LOT Polish Airlines',
  LS: 'Jet2', LX: 'Swiss', MS: 'EgyptAir', MU: 'China Eastern', NH: 'ANA', NZ: 'Air New Zealand',
  OS: 'Austrian Airlines', OU: 'Croatia Airlines', OZ: 'Asiana Airlines', PC: 'Pegasus', QF: 'Qantas',
  QR: 'Qatar Airways', RK: 'Ryanair UK', SA: 'South African Airways', SK: 'SAS', SN: 'Brussels Airlines',
  SQ: 'Singapore Airlines', TK: 'Turkish Airlines', TO: 'Transavia France', TP: 'TAP Air Portugal',
  U2: 'easyJet', UA: 'United Airlines', V7: 'Volotea', VA: 'Virgin Australia', VS: 'Virgin Atlantic',
  VY: 'Vueling', W6: 'Wizz Air', W9: 'Wizz Air UK', WK: 'Edelweiss', WN: 'Southwest Airlines',
  X3: 'TUI fly', '6E': 'IndiGo',
};

export const AIRPORTS: Record<string, string> = {
  ABZ: 'Aberdeen', ACE: 'Lanzarote', AGP: 'Málaga', ALC: 'Alicante', AMS: 'Amsterdam Schiphol',
  ARN: 'Stockholm Arlanda', ATH: 'Athens', ATL: 'Atlanta', AUH: 'Abu Dhabi', AYT: 'Antalya',
  BCN: 'Barcelona', BER: 'Berlin Brandenburg', BFS: 'Belfast International', BGY: 'Milan Bergamo',
  BHX: 'Birmingham', BKK: 'Bangkok Suvarnabhumi', BLQ: 'Bologna', BOD: 'Bordeaux', BOH: 'Bournemouth',
  BOM: 'Mumbai', BOS: 'Boston', BRI: 'Bari', BRS: 'Bristol', BRU: 'Brussels', BSL: 'Basel',
  BUD: 'Budapest', BVA: 'Paris Beauvais', CAG: 'Cagliari', CDG: 'Paris Charles de Gaulle',
  CGN: 'Cologne Bonn', CIA: 'Rome Ciampino', CPH: 'Copenhagen', CPT: 'Cape Town', CRL: 'Brussels Charleroi',
  CTA: 'Catania', DBV: 'Dubrovnik', DEL: 'Delhi', DFW: 'Dallas Fort Worth', DOH: 'Doha', DUB: 'Dublin',
  DUS: 'Düsseldorf', DXB: 'Dubai', EDI: 'Edinburgh', EMA: 'East Midlands', EWR: 'Newark', EXT: 'Exeter',
  FAO: 'Faro', FCO: 'Rome Fiumicino', FLR: 'Florence', FRA: 'Frankfurt', GLA: 'Glasgow', GVA: 'Geneva',
  HAM: 'Hamburg', HEL: 'Helsinki', HER: 'Heraklion', HKG: 'Hong Kong', HND: 'Tokyo Haneda', IBZ: 'Ibiza',
  IST: 'Istanbul', JFK: 'New York JFK', JNB: 'Johannesburg', KEF: 'Reykjavík Keflavík', KRK: 'Kraków',
  LAX: 'Los Angeles', LBA: 'Leeds Bradford', LCY: 'London City', LGA: 'New York LaGuardia',
  LGW: 'London Gatwick', LHR: 'London Heathrow', LIN: 'Milan Linate', LIS: 'Lisbon', LPA: 'Gran Canaria',
  LPL: 'Liverpool', LTN: 'London Luton', LYS: 'Lyon', MAD: 'Madrid', MAN: 'Manchester', MCO: 'Orlando',
  MEL: 'Melbourne', MIA: 'Miami', MLA: 'Malta', MRS: 'Marseille', MUC: 'Munich', MXP: 'Milan Malpensa',
  NAP: 'Naples', NCE: 'Nice', NCL: 'Newcastle', NRT: 'Tokyo Narita', OPO: 'Porto', ORD: "Chicago O'Hare",
  ORK: 'Cork', ORY: 'Paris Orly', OSL: 'Oslo', OTP: 'Bucharest', PMI: 'Palma de Mallorca', PMO: 'Palermo',
  PRG: 'Prague', PSA: 'Pisa', RAK: 'Marrakesh', SAW: 'Istanbul Sabiha Gökçen', SEA: 'Seattle',
  SEN: 'London Southend', SFO: 'San Francisco', SIN: 'Singapore Changi', SNN: 'Shannon', SOF: 'Sofia',
  SOU: 'Southampton', SPU: 'Split', STN: 'London Stansted', STR: 'Stuttgart', SVQ: 'Seville',
  SYD: 'Sydney', TFS: 'Tenerife South', TLS: 'Toulouse', TLV: 'Tel Aviv', TRN: 'Turin', VCE: 'Venice',
  VIE: 'Vienna', VLC: 'Valencia', WAW: 'Warsaw Chopin', YUL: 'Montréal', YVR: 'Vancouver',
  YYZ: 'Toronto Pearson', ZRH: 'Zurich',
};

export interface Airport {
  code: string;
  name: string;
}

export interface FlightInfo {
  /** e.g. "FR 1234" */
  flight: string;
  airline: string;
  from?: Airport;
  to?: Airport;
  /** Public tracking page, no key needed */
  trackUrl: string;
}

const FLIGHT = /\b([A-Z][A-Z0-9]|[0-9][A-Z])\s?(\d{1,4})\b/g;

/** Finds a known airline's flight number, plus any known airport codes, in the event's text */
export function findFlight(text: string): FlightInfo | null {
  // Lower-case codes only count next to the word "flight", so "dinner at 7" isn't Royal Air Maroc's AT 7
  const candidates = [...text.matchAll(FLIGHT)];
  if (/flight|✈/i.test(text)) candidates.push(...text.toUpperCase().matchAll(FLIGHT));
  const match = candidates.find((m) => AIRLINES[m[1]]);
  if (!match) return null;

  const [code, number] = [match[1], match[2]];
  const airports = [...new Set(text.match(/\b[A-Z]{3}\b/g) ?? [])]
    .filter((c) => AIRPORTS[c])
    .map((c) => ({ code: c, name: AIRPORTS[c] }));

  return {
    flight: `${code} ${number}`,
    airline: AIRLINES[code],
    from: airports[0],
    to: airports[1],
    trackUrl: `https://www.flightradar24.com/data/flights/${(code + number).toLowerCase()}`,
  };
}
