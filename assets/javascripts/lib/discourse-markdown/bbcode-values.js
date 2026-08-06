// the charsets a tag value may use. the cook sanitizer builds its allowlist
// from these, and the rich editor declines anything looser, so the editor can
// never show styling the rendered post drops.
//
// lives under discourse-markdown/ because only that path is loaded into the
// server-side cooking context; exporting no setup keeps it out of the feature list.

export const SIZE = "\\d{1,3}%";
export const ABSOLUTE_SIZE =
  "xx-small|x-small|small|medium|large|x-large|xx-large";
export const COLOR = "#?[a-zA-Z0-9]+";
export const FONT = "[a-zA-Z0-9\\s-]+";

export const ALIGNMENTS = ["left", "right", "center"];
