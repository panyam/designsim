export const KB_PER_MB = 1024;
export const KB_PER_GB = 1024 * KB_PER_MB;
export const KB_PER_TB = 1024 * KB_PER_GB;
export const KB_PER_PB = 1024 * KB_PER_TB;
export const KB_PER_XB = 1024 * KB_PER_PB;

export const BYTES_PER_KB = 1024;
export const BYTES_PER_MB = BYTES_PER_KB * KB_PER_MB;
export const BYTES_PER_GB = BYTES_PER_KB * KB_PER_GB;
export const BYTES_PER_TB = BYTES_PER_KB * KB_PER_TB;
export const BYTES_PER_PB = BYTES_PER_KB * KB_PER_PB;
export const BYTES_PER_XB = BYTES_PER_KB * KB_PER_XB;

export function ExaBytes(bytes: number): number {
  return bytes * BYTES_PER_XB;
}

export function PetaBytes(bytes: number): number {
  return bytes * BYTES_PER_PB;
}

export function TeraBytes(bytes: number): number {
  return bytes * BYTES_PER_TB;
}

export function GigaBytes(bytes: number): number {
  return bytes * BYTES_PER_GB;
}

export function MegaBytes(bytes: number): number {
  return bytes * BYTES_PER_MB;
}

export function KiloBytes(bytes: number): number {
  return bytes * BYTES_PER_KB;
}

export function StrToSize(value: string): number {
  value = value.toLowerCase();
  const intValue = parseInt(value);
  if (value.endsWith("xb")) {
    return ExaBytes(intValue);
  } else if (value.endsWith("pb")) {
    return PetaBytes(intValue);
  } else if (value.endsWith("tb")) {
    return TeraBytes(intValue);
  } else if (value.endsWith("gb")) {
    return GigaBytes(intValue);
  } else if (value.endsWith("mb")) {
    return MegaBytes(intValue);
  } else if (value.endsWith("kb")) {
    return KiloBytes(intValue);
  }
  return intValue;
}
