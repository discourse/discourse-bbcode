import { setupTest } from "ember-qunit";
import { module, test } from "qunit";
import { cook } from "discourse/lib/text";

function cookedDocument(html) {
  return new DOMParser().parseFromString(html, "text/html");
}

module("Unit | Lib | discourse-bbcode cooking", function (hooks) {
  setupTest(hooks);

  test("sepquote tags include their structural type", async function (assert) {
    const cooked = await cook("[edit]\nnote\n[/edit]");

    assert.strictEqual(
      cookedDocument(cooked).querySelector(".sepquote").dataset.tag,
      "edit",
      "the cooked block identifies the edit tag"
    );
  });
});
