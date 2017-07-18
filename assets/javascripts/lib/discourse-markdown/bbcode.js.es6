import { registerOption } from 'pretty-text/pretty-text';

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

function wrap(tag, attr, callback) {
  return function(startToken, finishToken, tagInfo) {
    startToken.tag = finishToken.tag = tag;
    startToken.content = finishToken.content = '';

    startToken.type = 'bbcode_open';
    finishToken.type = 'bbcode_close';

    startToken.nesting = 1;
    finishToken.nesting = -1;

    startToken.attrs = [[attr, callback ? callback(tagInfo) : tagInfo.attrs._default]];
  };
}

function setupMarkdownIt(md) {
  const ruler = md.inline.bbcode.ruler;

  ruler.push('size', {
    tag: 'size',
    wrap: wrap('font', 'size')
  });

  ruler.push('font', {
    tag: 'font',
    wrap: wrap('font', 'face')
  });

  ruler.push('color', {
    tag: 'color',
    wrap: wrap('font', 'color')
  });

  ruler.push('bgcolor', {
    tag: 'bgcolor',

    wrap: wrap('span', 'style', tagInfo => 'background-color:' + tagInfo.attrs._default.trim())
  });

  ruler.push('highlight',{
    tag: 'highlight',
    wrap: 'span.highlight'
  });

  ruler.push('small',{
    tag: 'small',
    wrap: wrap('span', 'style', ()=>'font-size:x-small')
  });

  ruler.push('aname', {
    tag: 'aname',
    wrap: wrap('a', 'name')
  });

  ruler.push('jumpto', {
    tag: 'jumpto',
    wrap: wrap('a', 'href', tagInfo => '#' + tagInfo.attrs._default)
  });

  ['left','right','center'].forEach(dir=>{
    md.block.bbcode.ruler.push(dir, {
      tag: dir,
      wrap: function(token) {
        token.attrs = [['style', 'text-align:' + dir]];
        return true;
      }
    });
  });

  md.block.bbcode.ruler.push('indent', {
    tag: 'indent',
    wrap: 'blockquote.indent'
  });

  ['ot', 'edit'].forEach(tag => {
    md.block.bbcode.ruler.push('ot', {
      tag: tag,
      before: function(state) {
        let token = state.push('sepquote_open', 'div', 1);
        token.attrs = [['class', 'sepquote']];

        token = state.push('span_open', 'span', 1);
        token.block = false;
        token.attrs = [['class', 'smallfont']];

        token = state.push('text', '', 0);
        token.content = I18n.t('bbcode.' + tag);

        token = state.push('span_close', 'span', -1);

        state.push('soft_break', 'br', 0);
        state.push('soft_break', 'br', 0);
      },
      after: function(state) {
        state.push('sepquote_close', 'div', -1);
      }
    });
  });

  ['list', 'ul', 'ol'].forEach(tag =>{
    md.block.bbcode.ruler.push(tag, {
      tag: tag,
      replace: function(state, tagInfo, content) {
        let ol = tag === 'ol' || (tag === 'list' && tagInfo.attrs._default);
        let token;

        if (ol) {
          token = state.push('ordered_list_open', 'ol', 1);
          if (tagInfo.attrs._default) {
            token.attrs = [['type', tagInfo.attrs._default]];
          }
        } else {
          state.push('bullet_list_open', 'ul', 1);
        }

        let lines = content.split("\n");
        let list = [null];
        let index = 0;

        for(let i=0; i<lines.length; i++) {
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
            list[index] += '\n' + line;
          } else {
            list[index] = line;
          }
        }

        list.forEach(li => {
          if (li !== null) {
            state.push('list_item_open', 'li', 1);
            // a bit lazy, we could use a block parser here
            // but it means a lot of fussing with line marks
            token = state.push('inline', '', 0);
            token.content = li;
            token.children = [];

            state.push('list_item_close', 'li', -1);
          }
        });

        if (ol) {
          state.push('ordered_list_close', 'ol', -1);
        } else {
          state.push('bullet_list_close', 'ul', -1);
        }

        return true;
      }
    });
  });

}

export function setup(helper) {

  helper.whiteList([
    'div.highlight',
    'span.highlight',
    'div.sepquote',
    'span.smallfont',
    'blockquote.indent',
    'font[color=*]',
    'font[size=*]',
    'font[face=*]',
    'ol[type=*]'
  ]);



  helper.whiteList({
    custom(tag, name, value) {
      if (tag === 'span' && name === 'style') {
        return /^font-size:.*|background-color:#?[a-zA-Z0-9]+$/.exec(value);
      }

      if (tag === 'div' && name === 'style') {
        return /^text-align:(center|left|right)$/.exec(value);
      }
    }
  });

  if (helper.markdownIt) {
    helper.registerPlugin(setupMarkdownIt);
    return;
  }

  const builders = requirejs('pretty-text/engines/discourse-markdown/bbcode').builders;
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
