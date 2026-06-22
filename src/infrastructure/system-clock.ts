import type { Clock } from '../domain/ports/clock.ts';

export class SystemClock implements Clock {
  now(): string {
    return new Date().toISOString();
  }
}
