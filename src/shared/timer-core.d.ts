import type { Interval, TimerState, TimerStateInternal } from '../types/messages';

declare class TimerCore {
  intervals: Interval[];
  state: TimerStateInternal;

  constructor(intervals?: Interval[]);

  start(): TimerStateInternal;
  pause(): TimerStateInternal;
  stop(): TimerStateInternal;
  repeat(repeat?: boolean | null): TimerStateInternal;
  next(): TimerStateInternal;
  resume(): TimerStateInternal;
  sync(): TimerStateInternal;
  updateState(state: TimerState | TimerStateInternal): TimerStateInternal;
  updateIntervals(intervals: Interval[]): TimerStateInternal;
  getState(): TimerStateInternal;
  setState(state: TimerState | TimerStateInternal): void;
}

export default TimerCore;
