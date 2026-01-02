export type TColorItem = {
  key: string;
  label: string;
  textColor: string;
  backgroundColor: string;
};

export const COLORS_LIST: TColorItem[] = [
  {
    key: "gray",
    label: "Gray",
    textColor: "var(--color-text-gray)",
    backgroundColor: "var(--color-background-gray)",
  },
  {
    key: "peach",
    label: "Peach",
    textColor: "var(--color-text-peach)",
    backgroundColor: "var(--color-background-peach)",
  },
  {
    key: "pink",
    label: "Pink",
    textColor: "var(--color-text-pink)",
    backgroundColor: "var(--color-background-pink)",
  },
  {
    key: "orange",
    label: "Orange",
    textColor: "var(--color-text-orange)",
    backgroundColor: "var(--color-background-orange)",
  },
  {
    key: "green",
    label: "Green",
    textColor: "var(--color-text-green)",
    backgroundColor: "var(--color-background-green)",
  },
  {
    key: "light-blue",
    label: "Light Blue",
    textColor: "var(--color-text-light-blue)",
    backgroundColor: "var(--color-background-light-blue)",
  },
  {
    key: "dark-blue",
    label: "Dark Blue",
    textColor: "var(--color-text-dark-blue)",
    backgroundColor: "var(--color-background-dark-blue)",
  },
  {
    key: "purple",
    label: "Purple",
    textColor: "var(--color-text-purple)",
    backgroundColor: "var(--color-background-purple)",
  },
  {
    key: "red",
    label: "Red",
    textColor: "var(--color-text-red)",
    backgroundColor: "var(--color-background-red)",
  },
];

// Default color values for fallback
export const DEFAULT_TEXT_COLOR = "inherit";
export const DEFAULT_BACKGROUND_COLOR = "transparent";
