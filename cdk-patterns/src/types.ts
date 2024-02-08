// Some kind of Typescript "technically correct but totally unreadable" jiggery-pokery which enables making nested properties Partial.
// Copy-pasted verbatim from: https://stackoverflow.com/a/47914631/723506
// Not currently used because this generates errors which are almost as unreadable as this type.
export type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

// Also tried: https://pendletonjones.com/deep-partial
// Seems like readonly (non-array) properties are throwing errors, but it's hard to decipher the output.
// type DeepPartial<T> = unknown extends T
//   ? T
//   : T extends object
//   ? {
//     [P in keyof T]?: T[P] extends Array<infer U>
//     ? Array<DeepPartial<U>>
//     : T[P] extends ReadonlyArray<infer U>
//     ? ReadonlyArray<DeepPartial<U>>
//     : DeepPartial<T[P]>;
//   }
//   : T;
