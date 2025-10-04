export const now = () => {
  return Date.now();
};

export const toEpochMilli = (value: number | Date) => {
  if (value instanceof Date) {
    return value.getTime();
  }

  return value;
};

