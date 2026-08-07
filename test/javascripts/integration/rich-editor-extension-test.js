import { settled } from "@ember/test-helpers";
import { module, test } from "qunit";
import {
  registerRichEditorExtension,
  resetRichEditorExtensions,
} from "discourse/lib/composer/rich-editor-extensions";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { setupRichEditor } from "discourse/tests/helpers/rich-editor-helper";
import { i18n } from "discourse-i18n";
import richEditorExtension from "discourse/plugins/discourse-bbcode/discourse/lib/rich-editor-extension";

// the browser occasionally reserializes style attributes on editor elements
// ("color:red" -> "color: red;", hex colors -> rgb()), so compare both sides
// in a canonical form
function normalizeStyles(html) {
  return html.replace(/ style="([^"]*)"/g, (_, style) => {
    const normalized = style
      .replace(/\s*:\s*/g, ":")
      .replace(/;\s*$/, "")
      .replace(/&quot;|["']/g, "")
      .replace(
        /rgb\((\d+),\s*(\d+),\s*(\d+)\)/g,
        (__, r, g, b) =>
          "#" +
          [r, g, b].map((n) => (+n).toString(16).padStart(2, "0")).join("")
      );
    return ` style="${normalized}"`;
  });
}

async function testMarkdown(assert, markdown, expectedHtml, expectedMarkdown) {
  const [editorClass, html] = await setupRichEditor(assert, markdown);

  assert.strictEqual(
    normalizeStyles(html),
    normalizeStyles(expectedHtml),
    `HTML should match for "${markdown}"`
  );

  assert.strictEqual(
    editorClass.value,
    expectedMarkdown,
    `Markdown should match for "${markdown}"`
  );
}

module(
  "Integration | Component | prosemirror-editor - discourse-bbcode extension",
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(async function () {
      await resetRichEditorExtensions();
      registerRichEditorExtension(richEditorExtension);
    });

    Object.entries({
      size: [
        "Some [size=150]large[/size] text",
        '<p>Some <span style="font-size:150%">large</span> text</p>',
        "Some [size=150]large[/size] text",
      ],
      font: [
        "In [font=courier]monospace[/font] rendering",
        "<p>In <span style=\"font-family:'courier'\">monospace</span> rendering</p>",
        "In [font=courier]monospace[/font] rendering",
      ],
      "font with spaces": [
        "In [font='Times New Roman']serif[/font] rendering",
        "<p>In <span style=\"font-family:'Times New Roman'\">serif</span> rendering</p>",
        'In [font="Times New Roman"]serif[/font] rendering',
      ],
      color: [
        "Some [color=red]red text[/color] here",
        '<p>Some <span style="color:red">red text</span> here</p>',
        "Some [color=red]red text[/color] here",
      ],
      "hex color": [
        "Some [color=#eeff00]colored text[/color] here",
        '<p>Some <span style="color:#eeff00">colored text</span> here</p>',
        "Some [color=#eeff00]colored text[/color] here",
      ],
      // pasting the same value is declined, since from a browser it means
      // "no color" rather than an authored choice
      "transparent color": [
        "Some [color=transparent]text[/color] here",
        '<p>Some <span style="color:transparent">text</span> here</p>',
        "Some [color=transparent]text[/color] here",
      ],
      bgcolor: [
        "Some [bgcolor=yellow]highlighted text[/bgcolor] here",
        '<p>Some <span style="background-color:yellow">highlighted text</span> here</p>',
        "Some [bgcolor=yellow]highlighted text[/bgcolor] here",
      ],
      highlight: [
        "Some [highlight]highlighted text[/highlight] here",
        '<p>Some <span class="highlight">highlighted text</span> here</p>',
        "Some [highlight]highlighted text[/highlight] here",
      ],
      // a same-type tag with the same value adds nothing, so dropping it
      // renders identically
      "nested highlight": [
        "[highlight]outer [highlight]inner[/highlight] outer[/highlight]",
        '<p><span class="highlight">outer inner outer</span></p>',
        "[highlight]outer inner outer[/highlight]",
      ],
      "nested identical color": [
        "[color=red]outer [color=red]inner[/color] outer[/color]",
        '<p><span style="color:red">outer inner outer</span></p>',
        "[color=red]outer inner outer[/color]",
      ],
      "highlight nested in color": [
        "[color=red]a [highlight]b[/highlight] c[/color]",
        '<p><span style="color:red">a <span class="highlight">b</span> c</span></p>',
        "[color=red]a [highlight]b[/highlight] c[/color]",
      ],
      small: [
        "Some [small]tiny text[/small] here",
        '<p>Some <span style="font-size:x-small">tiny text</span> here</p>',
        "Some [small]tiny text[/small] here",
      ],
      "nested inline bbcode": [
        "[color=red][size=200]both[/size][/color]",
        '<p><span style="font-size:200%"><span style="color:red">both</span></span></p>',
        "[size=200][color=red]both[/color][/size]",
      ],
      "sequential same-type marks": [
        "[color=red]outer[/color] [color=blue]inner[/color] [color=red]outer[/color]",
        '<p><span style="color:red">outer</span> <span style="color:blue">inner</span> <span style="color:red">outer</span></p>',
        "[color=red]outer[/color] [color=blue]inner[/color] [color=red]outer[/color]",
      ],
      aname: [
        "An [aname=target]anchor[/aname] here",
        '<p>An <a name="target">anchor</a> here</p>',
        "An [aname=target]anchor[/aname] here",
      ],
      "aname with a bracket": [
        "[aname='a]b']anchor[/aname]",
        '<p><a name="a]b">anchor</a></p>',
        '[aname="a]b"]anchor[/aname]',
      ],
      jumpto: [
        "A [jumpto=target]jump link[/jumpto] here",
        '<p>A <a href="#target">jump link</a> here</p>',
        "A [jumpto=target]jump link[/jumpto] here",
      ],
      "jumpto with a bracket": [
        "[jumpto='a]b']jump[/jumpto]",
        '<p><a href="#a]b">jump</a></p>',
        '[jumpto="a]b"]jump[/jumpto]',
      ],
      left: [
        "[left]\n\naligned left\n\n[/left]",
        '<div style="text-align:left"><p>aligned left</p></div>',
        "[left]\naligned left\n[/left]",
      ],
      center: [
        "[center]\n\naligned center\n\n[/center]",
        '<div style="text-align:center"><p>aligned center</p></div>',
        "[center]\naligned center\n[/center]",
      ],
      right: [
        "[right]\n\naligned right\n\n[/right]",
        '<div style="text-align:right"><p>aligned right</p></div>',
        "[right]\naligned right\n[/right]",
      ],
      indent: [
        "[indent]\n\nindented text\n\n[/indent]",
        '<blockquote class="indent"><p>indented text</p></blockquote>',
        "[indent]\nindented text\n[/indent]",
      ],
      ot: [
        "[ot]\n\nan off-topic aside\n\n[/ot]",
        '<div class="sepquote" data-tag="ot"><p>an off-topic aside</p></div>',
        "[ot]\nan off-topic aside\n[/ot]",
      ],
      edit: [
        "[edit]\n\nan edit note\n\n[/edit]",
        '<div class="sepquote" data-tag="edit"><p>an edit note</p></div>',
        "[edit]\nan edit note\n[/edit]",
      ],
      "typed list": [
        "[list=1]\n[*]first\n[*]second\n[/list]",
        '<ol type="1"><li><p>first</p></li><li><p>second</p></li></ol>',
        "[list=1]\n[*]first\n[*]second\n[/list]",
      ],
      "alpha typed list": [
        "[list=a]\n[*]first\n[*]second\n[/list]",
        '<ol type="a"><li><p>first</p></li><li><p>second</p></li></ol>',
        "[list=a]\n[*]first\n[*]second\n[/list]",
      ],
      "typed list with a bracket": [
        "[list='a]b']\n[*]item\n[/list]",
        '<ol type="a]b"><li><p>item</p></li></ol>',
        '[list="a]b"]\n[*]item\n[/list]',
      ],
      "plain list": [
        "[list]\n[*]first\n[*]second\n[/list]",
        '<ul data-tight="true"><li><p>first</p></li><li><p>second</p></li></ul>',
        "* first\n* second",
      ],
      "li list items": [
        "[list]\n[li]first[/li]\n[li]second[/li]\n[/list]",
        '<ul data-tight="true"><li><p>first</p></li><li><p>second</p></li></ul>',
        "* first\n* second",
      ],
      "uppercase tags": [
        "Some [COLOR=red]red text[/COLOR] here",
        '<p>Some <span style="color:red">red text</span> here</p>',
        "Some [color=red]red text[/color] here",
      ],
      "ul list": [
        "[ul]\n[*]first\n[*]second\n[/ul]",
        '<ul data-tight="true"><li><p>first</p></li><li><p>second</p></li></ul>',
        "* first\n* second",
      ],
      "ol list": [
        "[ol]\n[*]first\n[*]second\n[/ol]",
        '<ol data-tight="true"><li><p>first</p></li><li><p>second</p></li></ol>',
        "1. first\n2. second",
      ],
      "markdown list still works": [
        "1. first\n2. second",
        '<ol data-tight="true"><li><p>first</p></li><li><p>second</p></li></ol>',
        "1. first\n2. second",
      ],
      "markdown bullet list still works": [
        "* first\n* second",
        '<ul data-tight="true"><li><p>first</p></li><li><p>second</p></li></ul>',
        "* first\n* second",
      ],
    }).forEach(([name, [markdown, html, expectedMarkdown]]) => {
      test(name, async function (assert) {
        await testMarkdown(assert, markdown, html, expectedMarkdown);
      });
    });

    // the editor's clipboard round-trips through toDOM/parseDOM, so pasted
    // HTML must resolve to the bbcode nodes, not the more generic defaults
    Object.entries({
      "pasted indent html": [
        '<blockquote class="indent"><p>indented</p></blockquote>',
        "[indent]\nindented\n[/indent]",
      ],
      "pasted typed list html": [
        '<ol type="a"><li><p>first</p></li><li><p>second</p></li></ol>',
        "[list=a]\n[*]first\n[*]second\n[/list]",
      ],
      "pasted jumpto html": [
        '<p>go <a href="#target">here</a></p>',
        "go [jumpto=target]here[/jumpto]",
      ],
      "pasted edit html": [
        '<div class="sepquote" data-tag="edit"><p>an edit note</p></div>',
        "[edit]\nan edit note\n[/edit]",
      ],
      "pasted normalized font html": [
        '<p><span style="font-family: &quot;Times New Roman&quot;;">serif</span></p>',
        '[font="Times New Roman"]serif[/font]',
      ],
      "pasted bare font html": [
        '<p><span style="font-family: courier;">mono</span></p>',
        "[font=courier]mono[/font]",
      ],
      // the size and small marks both claim font-size, so the keyword has to
      // fall past the percentage rule
      "pasted x-small html": [
        '<p><span style="font-size: x-small;">tiny</span></p>',
        "[small]tiny[/small]",
      ],
      "pasted rgb color html": [
        '<p><span style="color: rgb(238, 255, 0);">bright</span></p>',
        "[color=#eeff00]bright[/color]",
      ],
      "pasted rgb bgcolor html": [
        '<p><span style="background-color: rgb(255, 255, 0);">marked</span></p>',
        "[bgcolor=#ffff00]marked[/bgcolor]",
      ],
      "pasted normalized align html": [
        '<div style="text-align: center;"><p>middle</p></div>',
        "[center]\nmiddle\n[/center]",
      ],
      "pasted font stack html is not claimed": [
        '<p><span style="font-family: Arial, sans-serif;">stacked</span></p>',
        "stacked",
      ],
      // the cooked value is always quoted, which would turn the generic
      // family into a literal font named "monospace"
      "pasted generic font html is not claimed": [
        '<p><span style="font-family: monospace;">mono</span></p>',
        "mono",
      ],
      // a quoted family is already a literal name, exactly what cook produces
      "pasted quoted generic font html": [
        "<p><span style=\"font-family: 'monospace';\">mono</span></p>",
        "[font=monospace]mono[/font]",
      ],
      // an item holds a single line: content the cook can't represent inside
      // one is reshaped to the closest structure that keeps cooking correctly
      "pasted typed list with a nested list": [
        '<ol type="a"><li><p>first</p><ol type="a"><li><p>second</p></li></ol></li></ol>',
        "[list=a]\n[*]first\n[/list]\n\n[list=a]\n[*]second\n[/list]",
      ],
      "pasted typed list item with two paragraphs": [
        '<ol type="1"><li><p>one</p><p>two</p></li></ol>',
        "[list=1]\n[*]one\n[*]two\n[/list]",
      ],
      "pasted cooked edit html": [
        `<div class="sepquote">\n<span class="smallfont">${i18n("bbcode.edit")}</span>\n<br>\n<br>\n<p>an edit note</p>\n</div>`,
        "[edit]\nan edit note\n[/edit]",
      ],
      "pasted cooked edit html from another locale is not mislabeled": [
        '<div class="sepquote">\n<span class="smallfont">Editar:</span>\n<br>\n<br>\n<p>an edit note</p>\n</div>',
        "an edit note",
      ],
      "pasted transparent background html": [
        '<p><span style="background-color: rgba(0, 0, 0, 0);">plain</span></p>',
        "plain",
      ],
      "pasted unknown sepquote tag html": [
        '<div class="sepquote" data-tag="script"><p>note</p></div>',
        "note",
      ],
      "pasted quoted aname html": [
        '<p>An <a name="O\'Brien x">anchor</a> here</p>',
        'An [aname="O\'Brien x"]anchor[/aname] here',
      ],
      // a value needing quotes that uses every delimiter leaves the serializer
      // no pair to wrap it in, and its fallback drops the double quotes. the
      // trailing one is the boundary: the wrapper's closing quote lands where
      // it was, so the written tag still looks like it holds the value
      "pasted aname that can't be quoted losslessly": [
        `<p>An <a name="a '«»“”‘’„‚‹› b&quot;">anchor</a> here</p>`,
        "An anchor here",
      ],
      "pasted quoted jumpto html": [
        '<p>go <a href="#tar\'get">here</a> now</p>',
        "go [jumpto=tar'get]here[/jumpto] now",
      ],
      "pasted quoted list type html": [
        '<ol type="a\'b"><li><p>first</p></li></ol>',
        "[list=a'b]\n[*]first\n[/list]",
      ],
      "pasted spaced list type html": [
        '<ol type="a b"><li><p>first</p></li></ol>',
        '[list="a b"]\n[*]first\n[/list]',
      ],
    }).forEach(([name, [html, expectedMarkdown]]) => {
      test(name, async function (assert) {
        const [editorClass] = await setupRichEditor(assert, "");

        editorClass.view.pasteHTML(html);
        await settled();

        assert.strictEqual(
          editorClass.value,
          expectedMarkdown,
          `Markdown should match for pasted "${html}"`
        );
      });
    });

    // content the editor can't represent exactly falls back to the markdown
    // editor with its source untouched, rather than being rewritten: nested
    // [size] compounds when cooked, so flattening it would resize the text
    [
      "[color=red;position:fixed]unsafe[/color]",
      "[font=bad!font]x[/font]",
      "[color=red]outer [color=blue]inner[/color] outer[/color]",
      "[size=200]outer [size=150]inner[/size] outer[/size]",
    ].forEach((markdown) => {
      test(`declines "${markdown}"`, async function (assert) {
        await setupRichEditor(assert, markdown);

        // a declined parse leaves nothing behind and hands the post back to the
        // markdown editor. dropping the tag instead would render its content.
        assert.dom(".ProseMirror").hasNoText();
      });
    });
  }
);
