import { apiInitializer } from "discourse/lib/api";
import richEditorExtension from "../lib/rich-editor-extension";

export default apiInitializer((api) => {
  api.registerRichEditorExtension(richEditorExtension);
});
