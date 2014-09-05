//-------------------------- STANDARD ------------------------------------------

// [SMALL]...[/SMALL]
Discourse.BBCode.replaceBBCode("small", function(contents) { return ['span', {'style': 'font-size:x-small'}].concat(contents); });
Discourse.Markdown.whiteListTag('span', 'style', 'font-size:x-small');

// [HIGHLIGHT]...[/HIGHLIGHT]
Discourse.BBCode.replaceBBCode("highlight", function(contents) { return ['div', {'class': 'highlight'}].concat(contents); });
Discourse.Markdown.whiteListTag('div', 'class', 'highlight');

// [LEFT]...[/LEFT]
// [CENTER]...[/CENTER]
// [RIGHT]...[/RIGHT]
["left", "center", "right"].forEach(function(direction){
  Discourse.BBCode.replaceBBCode(direction, function(contents) { return ['div', {'style': "text-align:" + direction}].concat(contents); });
});
Discourse.Markdown.whiteListTag('div', 'style', /^text-align:.+$/);

// [EDIT]...[/EDIT]
Discourse.BBCode.replaceBBCode('edit', function(contents) { return ['div', {'class': 'sepquote'}, ['span', { 'class': 'smallfont' }, "Edit:"], ['br'], ['br']].concat(contents); });
// [OT]...[/OT]
Discourse.BBCode.replaceBBCode('ot', function(contents) { return ['div', {'class': 'sepquote'}, ['span', { 'class': 'smallfont' }, "Off Topic:"], ['br'], ['br']].concat(contents); });
Discourse.Markdown.whiteListTag('div', 'class', 'sepquote');
Discourse.Markdown.whiteListTag('span', 'class', 'smallfont');

Discourse.BBCode.replaceBBCode('indent', function(contents) { return ['blockquote', ['div'].concat(contents)]; });

//------------------------------- FONT -----------------------------------------

function replaceFontColor (text) {
  while (text != (text = text.replace(/\[color=([^\]]+)\]((?:(?!\[color=[^\]]+\]|\[\/color\])[\S\s])*)\[\/color\]/ig, function (match, p1, p2, offset, string) {
    return "<font color='" + p1 + "'>" + p2 + "</font>";
  })));
  return text;
}

function replaceFontSize (text) {
  while (text != (text = text.replace(/\[size=([^\]]+)\]((?:(?!\[size=[^\]]+\]|\[\/size\])[\S\s])*)\[\/size\]/ig, function (match, p1, p2, offset, string) {
    return "<font size='" + p1 + "'>" + p2 + "</font>";
  })));
  return text;
}

function replaceFontFace (text) {
  while (text != (text = text.replace(/\[font=([^\]]+)\]((?:(?!\[font=[^\]]+\]|\[\/font\])[\S\s])*)\[\/font\]/ig, function (match, p1, p2, offset, string) {
    return "<font face='" + p1 + "'>" + p2 + "</font>";
  })));
  return text;
}

Discourse.Dialect.addPreProcessor(replaceFontColor);
Discourse.Dialect.addPreProcessor(replaceFontSize);
Discourse.Dialect.addPreProcessor(replaceFontFace);

Discourse.Markdown.whiteListTag('font', 'color');
Discourse.Markdown.whiteListTag('font', 'size');
Discourse.Markdown.whiteListTag('font', 'face');

//-------------------------- WITH PARAMS ---------------------------------------

// [ANAME=...]...[/ANAME]
Discourse.BBCode.register("aname", function(contents, param) { return ['a', {'name': param, 'data-bbcode': true}].concat(contents); });

// [JUMPTO=...]...[/JUMPTO]
Discourse.BBCode.register("jumpto", function(contents, param) { return ['a', {href: "#" + param, 'data-bbcode': true}].concat(contents); });

// [RULE=...]...[/RULE]
Discourse.BBCode.register("rule", function(contents, param) { return ['div', { 'style': "margin: 6px 0; height: 0; border-top: 1px solid " + contents + "; margin: auto; width: " + param }]; });

//---------------------------------- RAW ---------------------------------------

// [NOPARSE]...[/NOPARSE]
Discourse.BBCode.rawBBCode("noparse", function(contents) { return contents; });

// [FPHP]...[/FPHP]
Discourse.BBCode.rawBBCode('fphp', function(contents) { return ['a', {href: "http://www.php.net/manual-lookup.php?function=" + contents, 'data-bbcode': true}, contents]; });
// [FPHP=...]...[/FPHP]
Discourse.BBCode.replaceBBCodeParamsRaw("fphp", function(param, contents) { return ['a', {href: "http://www.php.net/manual-lookup.php?function=" + param, 'data-bbcode': true}, contents]; });

// [GOOGLE]...[/GOOGLE]
Discourse.BBCode.rawBBCode('google', function(contents) { return ['a', {href: "http://www.google.com/search?q=" + contents, 'data-bbcode': true}, contents]; });

//--------------------------------- SPECIAL ------------------------------------

Discourse.Dialect.replaceBlock({
  start: /\[list=?(\w)?\]([\s\S]*)/igm,
  stop: /\[\/list\]/igm,
  emitter: function(blockContents, matches) {
    var contents = matches[1] ? ["ol", { "type": matches[1] }] : ["ul"];

    if (blockContents.length) {
      var self = this;
      blockContents.forEach(function(bc){
        var lines = bc.split(/\n/);
        lines.forEach(function(line) {
          if (line.indexOf("[*]") === 0) {
            var li = self.processInline(line.slice(3));
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
