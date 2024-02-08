// Some kind of Typescript "technically correct but totally unreadable" jiggery-pokery which enables making nested properties Partial.
// Copy-pasted verbatim from: https://stackoverflow.com/a/47914631/723506
export type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};
