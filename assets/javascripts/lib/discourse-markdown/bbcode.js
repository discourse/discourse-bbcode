import { i18n } from "discourse-i18n";

const LIST_OPEN =
  /^\[(?:list|ul|ol)(?:=(?:'[^']+'|"[^"]+"|«[^»]+»|“[^”]+”|”[^”]+”|‘[^’]+’|„[^“]+“|‚[^’]+’|‹[^›]+›|[^\s\]]+))?\]$/i;
const LIST_CLOSE = /^\[\/(?:list|ul|ol)\]$/i;

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

function splitListItems(content) {
  const items = [null];
  let index = 0;
  let nestedListDepth = 0;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    const listNesting = LIST_OPEN.test(trimmed)
      ? 1
      : LIST_CLOSE.test(trimmed)
        ? -1
        : 0;

    if (nestedListDepth === 0) {
      let match = line.match(/^\s*\[\*\](.*)/);
      if (match) {
        index++;
        items[index] = match[1];
        continue;
      }

      match = line.match(/\s*\[li\](.*)\[\/li\]\s*$/);
      if (match) {
        index++;
        items[index] = match[1];
        continue;
      }

      match = line.match(/^\s*\*\s?(.*)/);
      if (match) {
        index++;
        items[index] = match[1];
        continue;
      }
    }

    if (items[index]) {
      items[index] += "\n" + line;
    } else {
      items[index] = line;
    }

    if (listNesting) {
      nestedListDepth += listNesting;
    }
  }

  return items;
}

function parseListItem(state, content) {
  const tokens = [];
  state.md.block.parse(content, state.md, state.env, tokens);
  const topLevelParagraphs = tokens.filter(
    (token) => token.level === 0 && token.type === "paragraph_open"
  ).length;

  for (const token of tokens) {
    if (
      topLevelParagraphs === 1 &&
      token.level === 0 &&
      (token.type === "paragraph_open" || token.type === "paragraph_close")
    ) {
      token.hidden = true;
    }
    token.level += state.level;
  }

  state.tokens.push(...tokens);
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

  ["left", "right", "center"].forEach((dir) => {
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

        splitListItems(content).forEach((li) => {
          if (li !== null) {
            state.push("list_item_open", "li", 1);
            parseListItem(state, li);
            state.push("list_item_close", "li", -1);
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
        return /^(font-size:(xx-small|x-small|small|medium|large|x-large|xx-large|[0-9]{1,3}%)|background-color:#?[a-zA-Z0-9]+|color:#?[a-zA-Z0-9]+|font-family:'[a-zA-Z0-9\s-]+')$/.exec(
          value
        );
      }

      if (tag === "div" && name === "style") {
        return /^text-align:(center|left|right)$/.exec(value);
      }
    },
  });

  helper.registerOptions((opts) => {
    opts.features["bbcode"] = true;
  });

  helper.registerPlugin(setupMarkdownIt);
}
