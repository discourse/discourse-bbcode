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

  test("nested typed lists retain their structure", async function (assert) {
    const cooked = await cook(
      "[list=a]\n[*]outer\n\n[list=a]\n[*]inner\n[/list]\n[/list]"
    );
    const document = cookedDocument(cooked);
    const outerList = document.querySelector("ol[type='a']");
    const outerItem = outerList.querySelector(":scope > li");
    const nestedList = outerItem.querySelector(":scope > ol[type='a']");

    assert.strictEqual(
      outerItem.childNodes[0].textContent.trim(),
      "outer",
      "the outer item remains intact"
    );
    assert.strictEqual(
      nestedList?.querySelector(":scope > li")?.textContent.trim(),
      "inner",
      "the nested item remains inside the outer item"
    );
  });

  test("mixed list markers retain sibling items", async function (assert) {
    const cooked = await cook("[list=a]\n[*]first\n* second\n[/list]");
    const document = cookedDocument(cooked);

    assert.deepEqual(
      [...document.querySelectorAll("ol[type='a'] > li")].map((item) =>
        item.textContent.trim()
      ),
      ["first", "second"],
      "a bare marker following a bracketed marker starts a sibling item"
    );
  });
});
