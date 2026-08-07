import { i18n } from "discourse-i18n";
import {
  ABSOLUTE_SIZE,
  ALIGNMENTS,
  COLOR,
  FONT,
  SIZE,
} from "discourse/plugins/discourse-bbcode/lib/discourse-markdown/bbcode-values";

const SPAN_STYLE = new RegExp(
  `^(font-size:(${ABSOLUTE_SIZE}|${SIZE})|background-color:${COLOR}|color:${COLOR}|font-family:'${FONT}')$`
);
const DIV_STYLE = new RegExp(`^text-align:(${ALIGNMENTS.join("|")})$`);

function wrap(tag, attr, callback) {
  return function (startToken, finishToken, tagInfo) {
    startToken.tag = finishToken.tag = tag;
    startToken.content = finishToken.content = "";

    startToken.type = "bbcode_open";
    finishToken.type = "bbcode_close";

    startToken.nesting = 1;
    finishToken.nesting = -1;

    startToken.attrs = [
      [attr, callback ? callback(tagInfo) : tagInfo.attrs._default],
    ];
  };
}

function setupMarkdownIt(md) {
  const ruler = md.inline.bbcode.ruler;

  ruler.push("size", {
    tag: "size",

    wrap: wrap(
      "span",
      "style",
      (tagInfo) => "font-size:" + tagInfo.attrs._default.trim() + "%"
    ),
  });

  ruler.push("font", {
    tag: "font",

    wrap: wrap(
      "span",
      "style",
      (tagInfo) => `font-family:'${tagInfo.attrs._default.trim()}'`
    ),
  });

  ruler.push("color", {
    tag: "color",

    wrap: wrap(
      "span",
      "style",
      (tagInfo) => "color:" + tagInfo.attrs._default.trim()
    ),
  });

  ruler.push("bgcolor", {
    tag: "bgcolor",

    wrap: wrap(
      "span",
      "style",
      (tagInfo) => "background-color:" + tagInfo.attrs._default.trim()
    ),
  });

  ruler.push("highlight", {
    tag: "highlight",
    wrap: "span.highlight",
  });

  ruler.push("small", {
    tag: "small",
    wrap: wrap("span", "style", () => "font-size:x-small"),
  });

  ruler.push("aname", {
    tag: "aname",
    wrap: wrap("a", "name"),
  });

  ruler.push("jumpto", {
    tag: "jumpto",
    wrap: wrap("a", "href", (tagInfo) => "#" + tagInfo.attrs._default),
  });

  ALIGNMENTS.forEach((dir) => {
    md.block.bbcode.ruler.push(dir, {
      tag: dir,
      wrap: function (token) {
        token.attrs = [["style", "text-align:" + dir]];
        return true;
      },
    });
  });

  md.block.bbcode.ruler.push("indent", {
    tag: "indent",
    wrap: "blockquote.indent",
  });

  ["ot", "edit"].forEach((tag) => {
    md.block.bbcode.ruler.push("ot", {
      tag,
      before: function (state) {
        let token = state.push("sepquote_open", "div", 1);
        token.attrs = [
          ["class", "sepquote"],
          ["data-tag", tag],
        ];

        token = state.push("span_open", "span", 1);
        token.block = false;
        token.attrs = [["class", "smallfont"]];

        token = state.push("text", "", 0);
        token.content = i18n("bbcode." + tag);

        token = state.push("span_close", "span", -1);

        state.push("soft_break", "br", 0);
        state.push("soft_break", "br", 0);
      },
      after: function (state) {
        state.push("sepquote_close", "div", -1);
      },
    });
  });

  ["list", "ul", "ol"].forEach((tag) => {
    md.block.bbcode.ruler.push(tag, {
      tag,
      replace: function (state, tagInfo, content) {
        let ol = tag === "ol" || (tag === "list" && tagInfo.attrs._default);
        let type = ol ? tagInfo.attrs._default : null;
        let token;

        if (type) {
          token = state.push("bbcode_list_open", "ol", 1);
          token.attrs = [["type", type]];
        } else if (ol) {
          state.push("ordered_list_open", "ol", 1);
        } else {
          state.push("bullet_list_open", "ul", 1);
        }

        let lines = content.split("\n");
        let list = [null];
        let index = 0;

        for (let i = 0; i < lines.length; i++) {
          let line = lines[i];

          let match = line.match(/^\s*\[?\*\]?(.*)/);
          if (match) {
            index++;
            list[index] = match[1];
            continue;
          }

          match = line.match(/\s*\[li\](.*)\[\/li\]\s*$/);
          if (match) {
            index++;
            list[index] = match[1];
            continue;
          }

          if (list[index]) {
            list[index] += "\n" + line;
          } else {
            list[index] = line;
          }
        }

        // typed list items get their own token type: an item holds a single
        // line, which the editor models as a more constrained node
        const itemToken = type ? "bbcode_list_item" : "list_item";

        list.forEach((li) => {
          if (li !== null) {
            state.push(`${itemToken}_open`, "li", 1);

            // hidden, as markdown-it wraps tight list items: renders as
            // nothing, but makes the item's content a paragraph like anywhere
            // else, instead of a bare inline token
            state.push("paragraph_open", "p", 1).hidden = true;

            // a bit lazy, we could use a block parser here
            // but it means a lot of fussing with line marks
            token = state.push("inline", "", 0);
            token.content = li;
            token.children = [];

            state.push("paragraph_close", "p", -1).hidden = true;

            state.push(`${itemToken}_close`, "li", -1);
          }
        });

        if (type) {
          state.push("bbcode_list_close", "ol", -1);
        } else if (ol) {
          state.push("ordered_list_close", "ol", -1);
        } else {
          state.push("bullet_list_close", "ul", -1);
        }

        return true;
      },
    });
  });
}

export function setup(helper) {
  helper.allowList([
    "div.highlight",
    "span.highlight",
    "div.sepquote",
    "span.smallfont",
    "blockquote.indent",
    "ol[type=*]",
  ]);

  helper.allowList({
    custom(tag, name, value) {
      if (tag === "span" && name === "style") {
        return SPAN_STYLE.exec(value);
      }

      if (tag === "div" && name === "style") {
        return DIV_STYLE.exec(value);
      }
    },
  });

  helper.registerOptions((opts) => {
    opts.features["bbcode"] = true;
  });

  helper.registerPlugin(setupMarkdownIt);
}
