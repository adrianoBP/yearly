import moment from 'moment';
import { Event } from '../../interfaces/event.interface';
import { bucketEventsByDay, dayKey } from './events-by-day';

const ev = (id: string, start: string, end: string) =>
  ({ id, title: id, startMoment: moment(start), endMoment: moment(end) }) as Event;

describe('bucketEventsByDay', () => {
  it('treats an all-day end at midnight as exclusive', () => {
    const map = bucketEventsByDay([ev('a', '2025-03-01', '2025-03-04')], 2025);
    const days = ['2-1', '2-2', '2-3'];
    expect(days.every((k) => map.get(k)?.length === 1)).toBeTrue();
    expect(map.has('2-4')).toBeFalse();
    expect(map.get('2-1')![0].isFirstDay).toBeTrue();
    expect(map.get('2-3')![0].isLastDay).toBeTrue();
    expect(map.get('2-1')![0].duration).toBe(3);
  });

  it('clamps events crossing year boundaries without marking ends', () => {
    const map = bucketEventsByDay([ev('a', '2024-12-30', '2026-01-02')], 2025);
    expect(map.size).toBe(365);
    expect(map.get(dayKey(new Date(2025, 0, 1)))![0].isFirstDay).toBeFalse();
    expect(map.get(dayKey(new Date(2025, 11, 31)))![0].isLastDay).toBeFalse();
  });

  it('keeps a timed event on its day and gives overlapping events separate lanes', () => {
    const map = bucketEventsByDay(
      [ev('short', '2025-06-10T10:00', '2025-06-10T11:00'), ev('long', '2025-06-09', '2025-06-12')],
      2025
    );
    expect(map.get('5-10')!.map((e) => [e.id, e.lane])).toEqual([['long', 0], ['short', 1]]);
    expect(map.get('5-10')![1].isFirstDay && map.get('5-10')![1].isLastDay).toBeTrue();
  });

  it('keeps an event in the same lane on every day and reuses freed lanes', () => {
    const map = bucketEventsByDay(
      [
        ev('a', '2025-01-01', '2025-01-03'),
        ev('b', '2025-01-02', '2025-01-06'),
        ev('c', '2025-01-04', '2025-01-05'),
      ],
      2025
    );
    const laneOf = (key: string, id: string) => map.get(key)!.find((e) => e.id === id)!.lane;
    expect(['0-2', '0-3', '0-4', '0-5'].map((k) => laneOf(k, 'b'))).toEqual([1, 1, 1, 1]);
    expect(laneOf('0-4', 'c')).toBe(0);
  });
});
