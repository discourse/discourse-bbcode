import { serializeBBCodeAttr } from "discourse/lib/text";
import { parseAttributesString } from "discourse/lib/wrap-utils";
import { i18n } from "discourse-i18n";
import {
  ALIGNMENTS,
  COLOR,
  FONT,
  SIZE,
} from "discourse/plugins/discourse-bbcode/lib/discourse-markdown/bbcode-values";

const SIZE_VALUE = new RegExp(`^${SIZE}$`);
const FONT_VALUE = new RegExp(`^${FONT}$`);
const COLOR_VALUE = new RegExp(`^${COLOR}$`);

// from a browser these mean "no color", unlike an authored [color=transparent]
const NON_COLORS = [
  "transparent",
  "currentcolor",
  "inherit",
  "initial",
  "unset",
  "revert",
];

function normalizeColor(value) {
  const rgb = value.match(
    /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\)/
  );
  if (rgb) {
    // bbcode can't express partial transparency
    if (rgb[4] !== undefined && parseFloat(rgb[4]) < 1) {
      return null;
    }
    return (
      "#" +
      rgb
        .slice(1, 4)
        .map((channel) => (+channel).toString(16).padStart(2, "0"))
        .join("")
    );
  }
  if (NON_COLORS.includes(value.toLowerCase())) {
    return null;
  }
  return COLOR_VALUE.test(value) ? value : null;
}

// generic families and CSS keywords: cooked values are always quoted, which
// would turn one of these into a literal font name and change its meaning
const NON_FONTS = [
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "math",
  "emoji",
  "fangsong",
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
];

function unquoteFont(value) {
  const [, quote, font] = value.match(/^(['"]?)(.+)\1$/) ?? [];
  if (!font || (!quote && NON_FONTS.includes(font.toLowerCase()))) {
    return null;
  }
  return FONT_VALUE.test(font) ? font : null;
}

// a Map, so a property named like an Object member can't hit the prototype
const SPAN_MARKS = new Map([
  [
    "font-size",
    (value, marks) =>
      value === "x-small"
        ? marks.bbcode_small.create()
        : SIZE_VALUE.test(value) &&
          marks.bbcode_size.create({ size: parseInt(value, 10) }),
  ],
  [
    "font-family",
    (value, marks) => {
      const font = unquoteFont(value);
      return font && marks.bbcode_font.create({ font });
    },
  ],
  [
    "color",
    (value, marks) =>
      COLOR_VALUE.test(value) && marks.bbcode_color.create({ color: value }),
  ],
  [
    "background-color",
    (value, marks) =>
      COLOR_VALUE.test(value) && marks.bbcode_bgcolor.create({ color: value }),
  ],
]);

const INLINE_TAGS = ["span", "a"];

function inlineMarkFor(token, schema) {
  if (token.tag === "span") {
    const [, property, value] =
      token.attrGet("style")?.match(/^([\w-]+):(.+)$/) ?? [];

    return SPAN_MARKS.get(property)?.(value, schema.marks) || null;
  }

  if (token.tag === "a") {
    const name = serializableAttr(token.attrGet("name"));
    if (name) {
      return schema.marks.bbcode_aname.create({ name });
    }

    const href = token.attrGet("href");
    if (href?.startsWith("#")) {
      const anchor = serializableAttr(href.slice(1));
      return anchor && schema.marks.bbcode_jumpto.create({ anchor });
    }
  }

  return null;
}

// a bbcode tag is a single line, so no quoting can hold a newline. a value
// needing quotes that leaves no quote pair unused loses its double quotes to
// the serializer's fallback, so accept only what parses back to itself
function serializableAttr(value) {
  if (!value || value.includes("\n")) {
    return null;
  }

  // the attribute name plays no part in how the value is quoted
  const written = serializeBBCodeAttr(value, "attr");
  return parseAttributesString(written).attr === value ? value : null;
}

// every open we see pushes an entry, so the matching close knows whether it was
// ours: a mark we opened, null for one we swallowed, false for one we passed on
// to another extension. without that an unclaimed open would leave its close to
// end whichever mark happened to be on top.
function openInlineMark(state, mark) {
  const open = (state.bbcodeInlineMarks ??= []);
  const enclosing = mark && open.find((entry) => entry?.type === mark.type);

  // a mark set holds one per type: an identical nesting adds nothing, a
  // differing one can't be represented. declining leaves the token to the other
  // bbcode_open handlers, and with none of them claiming it the parse fails and
  // the post stays in the markdown editor with its source intact.
  if (!mark || (enclosing && !enclosing.eq(mark))) {
    open.push(false);
    return false;
  }

  if (!enclosing) {
    state.openMark(mark);
  }

  open.push(enclosing ? null : mark);
  return true;
}

function closeInlineMark(state) {
  if (!state.bbcodeInlineMarks?.length) {
    return false;
  }

  const mark = state.bbcodeInlineMarks.pop();
  if (mark) {
    state.closeMark(mark);
  }

  return mark !== false;
}

function inSepquote(state) {
  return state.top()?.type.name === "bbcode_sepquote";
}

function wrapInTag(state, node, tag) {
  state.write(`[${tag}]\n`);
  state.renderContent(node);
  state.flushClose(1);
  state.write(`[/${tag}]`);
  state.closeBlock(node);
}

function colorMark(property) {
  return {
    attrs: { color: {} },
    parseDOM: [
      {
        style: property,
        getAttrs: (value) => {
          const color = normalizeColor(value);
          return color ? { color } : false;
        },
      },
    ],
    toDOM: (mark) => ["span", { style: `${property}:${mark.attrs.color}` }, 0],
  };
}

// String() so a numeric value isn't mistaken for an absent one
function bbcodeTag(tag, value) {
  return `[${serializeBBCodeAttr(String(value), tag).trim()}]`;
}

function attrSerializer(tag, attr) {
  return {
    open: (state, mark) => bbcodeTag(tag, mark.attrs[attr]),
    close: `[/${tag}]`,
    mixable: true,
    expelEnclosingWhitespace: true,
  };
}

/** @type {RichEditorExtension} */
const extension = {
  markSpec: {
    bbcode_size: {
      attrs: { size: {} },
      parseDOM: [
        {
          style: "font-size",
          getAttrs: (value) =>
            SIZE_VALUE.test(value) ? { size: parseInt(value, 10) } : false,
        },
      ],
      toDOM: (mark) => ["span", { style: `font-size:${mark.attrs.size}%` }, 0],
    },
    bbcode_font: {
      attrs: { font: {} },
      parseDOM: [
        {
          style: "font-family",
          getAttrs: (value) => {
            const font = unquoteFont(value);
            return font ? { font } : false;
          },
        },
      ],
      toDOM: (mark) => [
        "span",
        { style: `font-family:'${mark.attrs.font}'` },
        0,
      ],
    },
    bbcode_color: colorMark("color"),
    bbcode_bgcolor: colorMark("background-color"),
    bbcode_highlight: {
      parseDOM: [{ tag: "span.highlight" }],
      toDOM: () => ["span", { class: "highlight" }, 0],
    },
    bbcode_small: {
      parseDOM: [{ style: "font-size=x-small" }],
      toDOM: () => ["span", { style: "font-size:x-small" }, 0],
    },
    bbcode_aname: {
      attrs: { name: {} },
      parseDOM: [
        {
          tag: "a[name]",
          getAttrs: (dom) => {
            const name = serializableAttr(dom.getAttribute("name"));
            return name ? { name } : false;
          },
        },
      ],
      toDOM: (mark) => ["a", { name: mark.attrs.name }, 0],
    },
    bbcode_jumpto: {
      attrs: { anchor: {} },
      parseDOM: [
        {
          tag: "a[href^='#']",
          priority: 60,
          getAttrs: (dom) => {
            const anchor = serializableAttr(dom.getAttribute("href").slice(1));
            return anchor ? { anchor } : false;
          },
        },
      ],
      toDOM: (mark) => ["a", { href: `#${mark.attrs.anchor}` }, 0],
    },
  },

  nodeSpec: {
    bbcode_align: {
      attrs: { align: {} },
      group: "block",
      content: "block+",
      defining: true,
      createGapCursor: true,
      parseDOM: [
        {
          tag: "div[style*=text-align]",
          getAttrs: (dom) =>
            ALIGNMENTS.includes(dom.style.textAlign)
              ? { align: dom.style.textAlign }
              : false,
        },
      ],
      toDOM: (node) => ["div", { style: `text-align:${node.attrs.align}` }, 0],
    },
    bbcode_indent: {
      group: "block",
      content: "block+",
      defining: true,
      createGapCursor: true,
      parseDOM: [{ tag: "blockquote.indent", priority: 60 }],
      toDOM: () => ["blockquote", { class: "indent" }, 0],
    },
    bbcode_sepquote: {
      attrs: { tag: { default: "ot" } },
      group: "block",
      content: "block+",
      defining: true,
      createGapCursor: true,
      parseDOM: [
        {
          tag: "div.sepquote",
          getAttrs: (dom) => {
            if (["edit", "ot"].includes(dom.dataset.tag)) {
              return { tag: dom.dataset.tag };
            }

            const label = dom
              .querySelector("span.smallfont")
              ?.textContent.trim();
            if (label === i18n("bbcode.edit")) {
              return { tag: "edit" };
            }
            if (label === i18n("bbcode.ot")) {
              return { tag: "ot" };
            }

            return false;
          },
        },
        // cooked sepquotes decorate the content with a localized label
        { tag: "div.sepquote > span.smallfont", ignore: true },
      ],
      toDOM: (node) => [
        "div",
        { class: "sepquote", "data-tag": node.attrs.tag },
        0,
      ],
    },
    // an ordered list with an explicit list-style type, e.g. [list=a]
    bbcode_list: {
      attrs: { type: {}, tight: { default: true } },
      group: "block",
      content: "bbcode_list_item+",
      parseDOM: [
        {
          tag: "ol[type]",
          priority: 60,
          getAttrs: (dom) => {
            const type = serializableAttr(dom.getAttribute("type"));
            return type ? { type } : false;
          },
        },
      ],
      toDOM: (node) => ["ol", { type: node.attrs.type }, 0],
    },
    // a single paragraph, as the cook reads a line per item: anything more
    // (nested lists, extra paragraphs) would cook as literal text
    bbcode_list_item: {
      content: "paragraph",
      defining: true,
      parseDOM: [{ tag: "li", context: "bbcode_list/", priority: 60 }],
      toDOM: () => ["li", 0],
    },
  },

  parse: {
    bbcode_open(state, token) {
      return (
        INLINE_TAGS.includes(token.tag) &&
        openInlineMark(state, inlineMarkFor(token, state.schema))
      );
    },

    bbcode_close(state, token) {
      return INLINE_TAGS.includes(token.tag) && closeInlineMark(state);
    },

    bbcode_highlight_open(state) {
      return openInlineMark(
        state,
        state.schema.marks.bbcode_highlight.create()
      );
    },

    bbcode_highlight_close(state) {
      return closeInlineMark(state);
    },

    // shared with any wrapping block bbcode tag, so track which opens were ours
    wrap_bbcode(state, token) {
      if (token.nesting === 1) {
        let opened = false;

        if (token.tag === "div") {
          const align = token
            .attrGet("style")
            ?.match(/^text-align:(\w+)$/)?.[1];

          if (ALIGNMENTS.includes(align)) {
            state.openNode(state.schema.nodes.bbcode_align, { align });
            opened = true;
          }
        } else if (
          token.tag === "blockquote" &&
          token.attrGet("class") === "indent"
        ) {
          state.openNode(state.schema.nodes.bbcode_indent);
          opened = true;
        }

        (state.bbcodeWraps ??= []).push(opened);
        if (opened) {
          return true;
        }
      } else if (token.nesting === -1 && state.bbcodeWraps?.length) {
        if (state.bbcodeWraps.pop()) {
          state.closeNode();
          return true;
        }
      }
    },

    sepquote_open(state, token, tokens, i) {
      // the localized label is regenerated on cook; expected token order:
      // sepquote_open span_open text span_close soft_break²
      const label = tokens[i + 2];
      if (label?.type === "text") {
        label.content = "";
      }

      state.openNode(state.schema.nodes.bbcode_sepquote, {
        tag: token.attrGet("data-tag") === "edit" ? "edit" : "ot",
      });
      return true;
    },

    sepquote_close(state) {
      if (inSepquote(state)) {
        state.closeNode();
        return true;
      }
    },

    span_open(state, token) {
      return token.attrGet("class") === "smallfont" && inSepquote(state);
    },

    span_close(state) {
      return inSepquote(state);
    },

    soft_break(state) {
      return inSepquote(state);
    },

    bbcode_list: {
      block: "bbcode_list",
      getAttrs: (token) => ({ type: token.attrGet("type") }),
    },

    bbcode_list_item: { block: "bbcode_list_item" },
  },

  keymap: ({ schema, pmSchemaList: { splitListItem } }) => ({
    Enter: splitListItem(schema.nodes.bbcode_list_item),
  }),

  plugins: ({ pmState: { Plugin } }) =>
    new Plugin({
      props: {
        // an ignored <br> still opens a textblock while parsing, so the
        // cooked label's separators have to go before that
        transformPastedHTML(html) {
          if (!html.includes("sepquote")) {
            return html;
          }

          const doc = new DOMParser().parseFromString(html, "text/html");
          doc
            .querySelectorAll("div.sepquote > br")
            .forEach((br) => br.remove());
          return doc.body.innerHTML;
        },
      },
    }),

  serializeMark: {
    bbcode_size: attrSerializer("size", "size"),
    bbcode_font: attrSerializer("font", "font"),
    bbcode_color: attrSerializer("color", "color"),
    bbcode_bgcolor: attrSerializer("bgcolor", "color"),
    bbcode_aname: attrSerializer("aname", "name"),
    bbcode_jumpto: attrSerializer("jumpto", "anchor"),
    bbcode_highlight: {
      open: "[highlight]",
      close: "[/highlight]",
      mixable: true,
      expelEnclosingWhitespace: true,
    },
    bbcode_small: {
      open: "[small]",
      close: "[/small]",
      mixable: true,
      expelEnclosingWhitespace: true,
    },
  },

  serializeNode: {
    bbcode_align(state, node) {
      wrapInTag(state, node, node.attrs.align);
    },

    bbcode_indent(state, node) {
      wrapInTag(state, node, "indent");
    },

    bbcode_sepquote(state, node) {
      wrapInTag(state, node, node.attrs.tag);
    },

    bbcode_list(state, node) {
      state.write(`${bbcodeTag("list", node.attrs.type)}\n`);
      state.renderList(node, "", () => "[*]");
      state.flushClose(1);
      state.write("[/list]");
      state.closeBlock(node);
    },

    bbcode_list_item(state, node) {
      state.renderContent(node);
    },
  },
};

export default extension;
