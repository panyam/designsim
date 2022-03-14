export const INFINITY = 1e48;
export type UUIDType = number;
export type Name = string;
export type Metrics = {
  Latency: number;
  Availability: number;
};

export type Callback = (eventName: string, data: any) => void;
