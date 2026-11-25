export interface FlightLeg {
  airport?: string;
  iata?: string;
  terminal?: string;
  gate?: string;
  baggage?: string;
  /** HH:mm at the airport */
  scheduled?: string;
  estimated?: string;
  actual?: string;
  /** Minutes */
  delay?: number;
}

export interface FlightStatus {
  /** Short state for the badge, e.g. "Delayed 25 min" */
  label: string;
  tone: 'ok' | 'warn' | 'bad';
  departure: FlightLeg;
  arrival: FlightLeg;
}

// shortcut: Aviationstack's flight object, typed from its long-standing format; its docs page was unreachable when this was written
interface AviationstackLeg {
  airport?: string | null;
  iata?: string | null;
  terminal?: string | null;
  gate?: string | null;
  baggage?: string | null;
  delay?: number | null;
  scheduled?: string | null;
  estimated?: string | null;
  actual?: string | null;
}

export interface AviationstackResponse {
  data?: {
    flight_date?: string;
    flight_status?: string;
    departure?: AviationstackLeg;
    arrival?: AviationstackLeg;
  }[];
  error?: { code?: string; message?: string };
}

/** Aviationstack writes local airport times with a +00:00 offset, so read the clock time as written */
const clock = (value?: string | null) => (value ? value.slice(11, 16) : undefined);
const text = (value?: string | null) => value?.trim() || undefined;

function leg(raw: AviationstackLeg = {}): FlightLeg {
  return {
    airport: text(raw.airport),
    iata: text(raw.iata),
    terminal: text(raw.terminal),
    gate: text(raw.gate),
    baggage: text(raw.baggage),
    scheduled: clock(raw.scheduled),
    estimated: clock(raw.estimated),
    actual: clock(raw.actual),
    delay: raw.delay ?? undefined,
  };
}

/** The flight on the given day (YYYY-MM-DD), or null: never shows another day's flight with the same number */
export function parseAviationstack(response: AviationstackResponse, date: string): FlightStatus | null {
  if (response.error) throw response.error.message ?? 'Flight status unavailable.';
  const flight = response.data?.find((f) => f.flight_date === date || f.departure?.scheduled?.startsWith(date));
  if (!flight) return null;

  const departure = leg(flight.departure);
  const arrival = leg(flight.arrival);
  const delay = departure.delay ?? 0;
  const status = flight.flight_status ?? 'scheduled';
  const [label, tone]: [string, FlightStatus['tone']] =
    status === 'cancelled' ? ['Cancelled', 'bad']
    : status === 'diverted' ? ['Diverted', 'bad']
    : status === 'incident' ? ['Incident', 'bad']
    : status === 'landed' ? ['Landed', 'ok']
    : status === 'active' ? ['In the air', 'ok']
    : delay >= 15 ? [`Delayed ${delay} min`, 'warn']
    : ['On time', 'ok'];
  return { label, tone, departure, arrival };
}
