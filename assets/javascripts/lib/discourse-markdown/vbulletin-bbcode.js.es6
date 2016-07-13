import { registerOption } from 'pretty-text/pretty-text';
import { builders } from 'pretty-text/engines/discourse-markdown/bbcode';

registerOption((siteSettings, opts) => opts.features["vbulletin-bbcode"] = true);

function replaceFontColor (text) {
  while (text !== (text = text.replace(/\[color=([^\]]+)\]((?:(?!\[color=[^\]]+\]|\[\/color\])[\S\s])*)\[\/color\]/ig, function (match, p1, p2) {
    return `<font color='${p1}'>${p2}</font>`;
  })));
  return text;
}

function replaceFontSize (text) {
  while (text !== (text = text.replace(/\[size=([^\]]+)\]((?:(?!\[size=[^\]]+\]|\[\/size\])[\S\s])*)\[\/size\]/ig, function (match, p1, p2) {
    return `<font size='${p1}'>${p2}</font>`;
  })));
  return text;
}

function replaceFontFace (text) {
  while (text !== (text = text.replace(/\[font=([^\]]+)\]((?:(?!\[font=[^\]]+\]|\[\/font\])[\S\s])*)\[\/font\]/ig, function (match, p1, p2) {
    return `<font face='${p1}'>${p2}</font>`;
  })));
  return text;
}

export function setup(helper) {

  helper.whiteList([
    'div.highlight',
    'div.sepquote',
    'span.smallfont',
    'font[color=*]',
    'font[size=*]',
    'font[face=*]',
  ]);

  helper.whiteList({
    custom(tag, name, value) {
      if (tag === 'span' && name === 'style') {
        return /^font-size:.*$/.exec(value);
      }

      if (tag === 'div' && name === 'style') {
        return /^text-align:(center|left|right)$/.exec(value);
      }
    }
  });

  const { register, replaceBBCode, rawBBCode, replaceBBCodeParamsRaw } = builders(helper);

  replaceBBCode("small", contents => ['span', {'style': 'font-size:x-small'}].concat(contents));
  replaceBBCode("highlight", contents => ['div', {'class': 'highlight'}].concat(contents));

  ["left", "center", "right"].forEach(direction => {
    replaceBBCode(direction, contents => ['div', {'style': "text-align:" + direction}].concat(contents));
  });

  replaceBBCode('edit', contents =>  ['div', {'class': 'sepquote'}, ['span', { 'class': 'smallfont' }, "Edit:"], ['br'], ['br']].concat(contents));

  replaceBBCode('ot', contents =>  ['div', {'class': 'sepquote'}, ['span', { 'class': 'smallfont' }, "Off Topic:"], ['br'], ['br']].concat(contents));

  replaceBBCode('indent', contents => ['blockquote', ['div'].concat(contents)]);

  helper.addPreProcessor(replaceFontColor);
  helper.addPreProcessor(replaceFontSize);
  helper.addPreProcessor(replaceFontFace);

  register("aname", (contents, param) => ['a', {'name': param, 'data-bbcode': true}].concat(contents));
  register("jumpto", (contents, param) => ['a', {href: "#" + param, 'data-bbcode': true}].concat(contents));
  register("rule", (contents, param) => ['div', { 'style': "margin: 6px 0; height: 0; border-top: 1px solid " + contents + "; margin: auto; width: " + param }]);

  rawBBCode("noparse", contents => contents);
  rawBBCode('fphp', contents => ['a', {href: "http://www.php.net/manual-lookup.php?function=" + contents, 'data-bbcode': true}, contents]);
  replaceBBCodeParamsRaw("fphp", (param, contents) => ['a', {href: "http://www.php.net/manual-lookup.php?function=" + param, 'data-bbcode': true}, contents]);

  rawBBCode('google', contents => ['a', {href: "http://www.google.com/search?q=" + contents, 'data-bbcode': true}, contents]);

  helper.replaceBlock({
    start: /\[list=?(\w)?\]([\s\S]*)/igm,
    stop: /\[\/list\]/igm,
    emitter(blockContents, matches) {
      const contents = matches[1] ? ["ol", { "type": matches[1] }] : ["ul"];

      if (blockContents.length) {
        blockContents.forEach(bc => {
          const lines = bc.split(/\n/);
          lines.forEach(line => {
            if (line.indexOf("[*]") === 0) {
              const li = this.processInline(line.slice(3));
              if (li) {
                contents.push(["li"].concat(li));
              }
            }
          });
        });
      }

      return contents;
    }
  });
}
