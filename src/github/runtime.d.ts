// Globals Herdr's QuickJS provides beyond ES2022 (checked by test/smoke). Only what the mod uses.
interface URL {
  readonly href: string;
  readonly protocol: string;
}
declare var URL: {
  prototype: URL;
  /** WHATWG URL resolution; throws TypeError on an invalid URL. */
  new(url: string, base?: string): URL;
};
