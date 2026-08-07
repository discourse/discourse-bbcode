// the charsets a tag value may use, shared so the cook sanitizer and the rich
// editor can't drift. lives under discourse-markdown/ as only that path is
// loaded into the server-side cooking context; no setup export keeps it out
// of the feature list.

export const SIZE = "\\d{1,3}%";
export const ABSOLUTE_SIZE =
  "xx-small|x-small|small|medium|large|x-large|xx-large";
export const COLOR = "#?[a-zA-Z0-9]+";
export const FONT = "[a-zA-Z0-9\\s-]+";

export const ALIGNMENTS = ["left", "right", "center"];
