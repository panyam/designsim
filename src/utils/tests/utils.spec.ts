import { range } from "../numberutils";

describe("Range Tests", () => {
  test("Simple Range", () => {
    expect(range(5)).toEqual([0, 1, 2, 3, 4]);
  });
  test("Simple -ve Range", () => {
    expect(range(-5)).toEqual([-4, -3, -2, -1, 0]);
  });
  test("A->B Incr +ve Range", () => {
    expect(range(2, 4)).toEqual([2, 3, 4]);
  });
  test("A->B Decr +ve Range", () => {
    expect(range(4, 2)).toEqual([4, 3, 2]);
  });
  test("A->B Incr -ve Range", () => {
    expect(range(-5, -3)).toEqual([-5, -4, -3]);
  });
  test("A->B Decr -ve Range", () => {
    expect(range(-3, -5)).toEqual([-3, -4, -5]);
  });
});
