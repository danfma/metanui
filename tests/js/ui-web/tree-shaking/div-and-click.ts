// Bundle entry for the tree-shaking check: only Div and OnClick from the element vocabulary.
import { div, onClick, WebApp } from "metanui-ui-web/metanui/ui/web";

WebApp.render(() => div((box) => onClick(box, () => {})), document.body);
