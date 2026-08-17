import { module, test } from "qunit";
import {
  registerRichEditorExtension,
  resetRichEditorExtensions,
} from "discourse/lib/composer/rich-editor-extensions";
import toMarkdown from "discourse/lib/to-markdown";
import richEditorExtension from "discourse/plugins/discourse-bbcode/discourse/lib/rich-editor-extension";

module("discourse-bbcode | Unit | to-markdown", function (hooks) {
  hooks.beforeEach(async function () {
    await resetRichEditorExtensions();
    registerRichEditorExtension(richEditorExtension);
  });

  // copying rendered content inlines theme colors onto the copied elements
  test("ignores styles the browser inlined on copied content", async function (assert) {
    assert.strictEqual(
      await toMarkdown(
        `<a class="mention" href="/u/someone" style="color: #112233; background-color: #eef2ee;">@someone</a> <code style="color: #112233; background-color: #f4f4f4;">a command</code>`
      ),
      "@someone `a command`"
    );
  });

  test("keeps a cooked bbcode span", async function (assert) {
    assert.strictEqual(
      await toMarkdown(`<span style="color:red">red</span> text`),
      "[color=red]red[/color] text"
    );
  });
});
