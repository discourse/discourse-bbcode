import { module, test } from "qunit";
import {
  registerRichEditorExtension,
  resetRichEditorExtensions,
} from "discourse/lib/composer/rich-editor-extensions";
import { cook } from "discourse/lib/text";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { setupRichEditor } from "discourse/tests/helpers/rich-editor-helper";
import richEditorExtension from "discourse/plugins/discourse-bbcode/discourse/lib/rich-editor-extension";

// the source may be normalized, but it has to keep cooking to the same post.
// the second entry is the equivalent source for tags the editor rewrites to
// markdown, which cook renders with the same styling under other tags.
const CASES = [
  ["[color=red]red[/color] text"],
  ["[color=#ff0000]hex[/color] text"],
  ["[bgcolor=yellow]marked[/bgcolor] text"],
  ["[size=150]large[/size] text"],
  ["[font=courier]mono[/font] text"],
  ["[small]tiny[/small] text"],
  ["[highlight]marked[/highlight] text"],
  ["[u]underline[/u] text"],
  ["[aname=top]anchor[/aname] text"],
  ["[jumpto=top]jump[/jumpto] text"],
  ["[color=red]a[/color] plain [color=blue]b[/color]"],
  ["[center]\n\ncentered\n\n[/center]"],
  ["[left]\n\nleft\n\n[/left]"],
  ["[right]\n\nright\n\n[/right]"],
  ["[indent]\n\nindented\n\n[/indent]"],
  ["[ot]\n\naside\n\n[/ot]"],
  ["[edit]\n\nnote\n\n[/edit]"],
  ["[quote]\n\nquoted\n\n[/quote]"],
  ["[list]\n[*]one\n[*]two\n[/list]"],
  ["[ul]\n[*]one\n[*]two\n[/ul]"],
  ["[ol]\n[*]one\n[*]two\n[/ol]"],
  ["[list=1]\n[*]one\n[*]two\n[/list]"],
  ["[list=a]\n[*]one\n[*]two\n[/list]"],
  ["[list]\n[li]one[/li]\n[li]two[/li]\n[/list]"],
  ["[list=a]\n[*]outer\n\n[list=a]\n[*]inner\n[/list]\n[/list]"],
  ["[indent]\n\n[list]\n[*]indented item\n[/list]\n\n[/indent]"],
  ["before\n\n[center]\n\nmiddle\n\n[/center]\n\nafter"],
  ["text with an ![image](https://example.com/a.png)"],
  ["[b]bold[/b] text", "**bold** text"],
  ["[i]italic[/i] text", "*italic* text"],
  ["[s]strike[/s] text", "~~strike~~ text"],
  ["[url=https://example.com]link[/url]", "[link](https://example.com)"],
  ["[code]\nraw [b]not bold[/b]\n[/code]", "```\nraw [b]not bold[/b]\n```"],
  [
    "[color=red]red [b]and bold[/b][/color]",
    "[color=red]red **and bold**[/color]",
  ],
  [
    "[b]bold [color=red]and red[/color][/b]",
    "**bold [color=red]and red[/color]**",
  ],
  [
    "[size=200][b][i]all three[/i][/b][/size]",
    "***[size=200]all three[/size]***",
  ],
  [
    "[center]\n\n[b]centered bold[/b]\n\n[/center]",
    "[center]\n**centered bold**\n[/center]",
  ],
  [
    "[list]\n[*][b]bold item[/b]\n[*][color=red]red item[/color]\n[/list]",
    "* **bold item**\n* [color=red]red item[/color]",
  ],
  [
    "a **markdown bold** and [b]bbcode bold[/b]",
    "a **markdown bold** and **bbcode bold**",
  ],
];

module(
  "Integration | Component | prosemirror-editor - discourse-bbcode fidelity",
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(async function () {
      await resetRichEditorExtensions();
      registerRichEditorExtension(richEditorExtension);
    });

    CASES.forEach(([markdown, equivalent = markdown]) => {
      test(`round trips ${JSON.stringify(markdown)}`, async function (assert) {
        const [editorClass] = await setupRichEditor(assert, markdown);

        assert.strictEqual(
          (await cook(editorClass.value)).toString(),
          (await cook(equivalent)).toString(),
          `cooked output should be unchanged, got source ${JSON.stringify(editorClass.value)}`
        );
      });
    });
  }
);
