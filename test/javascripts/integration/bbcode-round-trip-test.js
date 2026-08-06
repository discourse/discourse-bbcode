import { module, test } from "qunit";
import {
  registerRichEditorExtension,
  resetRichEditorExtensions,
} from "discourse/lib/composer/rich-editor-extensions";
import { cook } from "discourse/lib/text";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { setupRichEditor } from "discourse/tests/helpers/rich-editor-helper";
import richEditorExtension from "discourse/plugins/discourse-bbcode/discourse/lib/rich-editor-extension";

// sources the editor rewrites: what it writes back has to keep cooking to the
// same post. the second entry is the expected equivalent, which cook renders
// with the same styling under other tags. sources that round trip byte for byte
// belong in rich-editor-extension-test, which asserts them exactly.
const CASES = [
  ["[list=a]\n[*]outer\n\n[list=a]\n[*]inner\n[/list]\n[/list]"],
  ["[indent]\n\n[list]\n[*]indented item\n[/list]\n\n[/indent]"],
  ["before\n\n[center]\n\nmiddle\n\n[/center]\n\nafter"],
  ["[list]\n[*]one\n[*]two\n[/list]"],
  ["[ul]\n[*]one\n[*]two\n[/ul]"],
  ["[ol]\n[*]one\n[*]two\n[/ol]"],
  ["[list]\n[li]one[/li]\n[li]two[/li]\n[/list]"],
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

        // a declined parse leaves the editor empty and the source untouched,
        // which would satisfy the comparison below on its own
        assert.dom(".ProseMirror").hasAnyText();

        assert.strictEqual(
          (await cook(editorClass.value)).toString(),
          (await cook(equivalent)).toString(),
          `cooked output should be unchanged, got source ${JSON.stringify(editorClass.value)}`
        );
      });
    });
  }
);
