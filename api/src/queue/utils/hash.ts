export const hashStringToPositiveNumber = (value: string) => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    const charCode = value.charCodeAt(index);
    hash = ((hash << 5) - hash + charCode) | 0;
  }

  return Math.abs(hash);
};
