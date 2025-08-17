declare global {
  var advanceTime: (milliseconds: number) => number;
  var setMockTime: (timestamp: number) => number;
}
export {};
