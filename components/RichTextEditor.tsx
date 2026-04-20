import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, StyleSheet, View } from "react-native";

// Conditionally import WebView to prevent crashes on web
const WebView = Platform.OS !== "web" ? require("react-native-webview").WebView : null;

export interface RichTextEditorRef {
  getHTML: () => Promise<string>;
  setHTML: (html: string) => void;
}

interface Props {
  initialContent?: string;
  onChange?: (html: string) => void;
  readOnly?: boolean;
  enableTeacherTools?: boolean; // 🔥 NEW
}

const RichTextEditor = forwardRef<RichTextEditorRef, Props>(
  (
    {
      initialContent = "",
      onChange,
      readOnly = false,
      enableTeacherTools = false,
    },
    ref,
  ) => {
    const webRef = useRef<any>(null);
    const resolver = useRef<((html: string) => void) | null>(null);
    const lastHtml = useRef(initialContent);
    const isFirstMount = useRef(true);
    const [webViewHeight, setWebViewHeight] = useState(initialContent ? 400 : 200);

    const send = useCallback((script: string) => {
      if (Platform.OS === "web") {
        const iframe = document.getElementById(
          "rte-frame",
        ) as HTMLIFrameElement;
        iframe?.contentWindow?.postMessage(script, "*");
      } else {
        webRef.current?.injectJavaScript(script);
      }
    }, []);

    useImperativeHandle(ref, () => ({
      getHTML: () =>
        new Promise((resolve) => {
          resolver.current = resolve;
          send("window.__GET__()");
        }),
      setHTML: (html: string) => {
        lastHtml.current = html;
        send(`window.__SET__(${JSON.stringify(html)})`);
      },
    }));

    // Sync external changes to initialContent (e.g. clearing or loading drafts)
    // We only update if it's actually different to prevent cursor jumps/keyboard closing
    useEffect(() => {
      if (isFirstMount.current) {
        isFirstMount.current = false;
        return;
      }
      if (initialContent !== lastHtml.current) {
        send(`window.__SET__(${JSON.stringify(initialContent)})`);
        lastHtml.current = initialContent;
      }
    }, [initialContent, send]);

    const htmlContent = useMemo(() => `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, sans-serif;
}
.toolbar {
  display:${readOnly ? "none" : "flex"};
  flex-wrap: wrap;
  padding:8px;
  border-bottom:1px solid #ddd;
  background:#fafafa;
  gap: 4px;
  position: sticky;
  top: 0;
  z-index: 100;
}
button {
  padding:6px 10px;
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
}
button:active { background: #eee; }
#editor {
  padding:12px;
  outline:none;
  min-height: 100px;
}

/* Highlight */
.highlight { background: yellow; }

/* Comment */
.comment {
  background: #dbeafe;
  border-bottom: 2px dotted #2563eb;
  cursor: pointer;
}
</style>
</head>

<body>

<div class="toolbar">
<button onclick="cmd('bold')"><b>B</b></button>
<button onclick="cmd('italic')"><i>I</i></button>
<button onclick="cmd('underline')"><u>U</u></button>

<button onclick="cmd('insertUnorderedList')">•</button>
<button onclick="cmd('insertOrderedList')">1.</button>

<button onclick="cmd('justifyLeft')">L</button>
<button onclick="cmd('justifyCenter')">C</button>
<button onclick="cmd('justifyRight')">R</button>

${
  enableTeacherTools
    ? `
<button onclick="highlightText()" style="background:#fef08a">🟡 Highlight</button>
<button onclick="addComment()" style="background:#dbeafe">💬 Comment</button>
`
    : ""
}
</div>

<div id="editor" contenteditable="${!readOnly}"></div>

<script>
const editor = document.getElementById("editor");

// Initialize content ONCE from the variable captured at memoization time
editor.innerHTML = ${JSON.stringify(initialContent)};

function cmd(c){
  document.execCommand(c,false,null);
  sendUpdate();
  sendHeight();
}

function highlightText() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  document.execCommand("insertHTML", false,
    '<span class="highlight">' + selection.toString() + '</span>'
  );
  sendUpdate();
  sendHeight();
}

function addComment() {
  const selection = window.getSelection();
  const text = selection.toString();
  if (!text) return;

  const comment = prompt("Enter comment:");
  if (!comment) return;

  document.execCommand("insertHTML", false,
    '<span class="comment" data-comment="' + comment + '">' + text + '</span>'
  );

  sendUpdate();
  sendHeight();
}

editor.addEventListener("click", function(e){
  if(e.target.classList.contains("comment")){
    alert("Comment: " + e.target.getAttribute("data-comment"));
  }
});

function sendUpdate(){
  const data = JSON.stringify({
    type:"CHANGE",
    html: editor.innerHTML
  });
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(data);
  }
}

function sendHeight() {
  const height = document.body.scrollHeight || document.documentElement.scrollHeight;
  const data = JSON.stringify({
    type: "HEIGHT",
    height: height
  });
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(data);
  }
}

editor.addEventListener("input", () => {
  sendUpdate();
  sendHeight();
});

// Use ResizeObserver for more reliable height updates
if (window.ResizeObserver) {
  const ro = new ResizeObserver(sendHeight);
  ro.observe(document.body);
}

window.onload = sendHeight;
setTimeout(sendHeight, 500);

window.__GET__ = () => {
  const data = JSON.stringify({
    type:"GET",
    html: editor.innerHTML
  });
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(data);
  }
};

window.__SET__ = (html) => {
  editor.innerHTML = html;
};

// WEB SUPPORT - Listening for messages from parent
window.addEventListener("message", (e)=>{
  try {
    if (typeof e.data === 'string' && e.data.startsWith('window.')) {
       eval(e.data);
    }
  } catch(err) { console.error(err); }
});

// Polyfill for web
if(!window.ReactNativeWebView){
  window.ReactNativeWebView = {
    postMessage: (d) => window.parent.postMessage(d, "*")
  };
}
</script>

</body>
</html>
`, [readOnly, enableTeacherTools]); // DO NOT include initialContent here, it causes reload on typing

    const onMsg = useCallback((data: any) => {
      try {
        const msg = JSON.parse(typeof data === 'string' ? data : JSON.stringify(data));

        if (msg.type === "CHANGE") {
          lastHtml.current = msg.html;
          onChange?.(msg.html);
        }

        if (msg.type === "HEIGHT") {
          setWebViewHeight(msg.height);
        }

        if (msg.type === "GET") {
          resolver.current?.(msg.html);
        }
      } catch (err) {
        // console.warn("RTE onMsg error:", err);
      }
    }, [onChange]);

    useEffect(() => {
      if (Platform.OS === "web") {
        const handler = (e: MessageEvent) => onMsg(e.data);
        window.addEventListener("message", handler);
        return () => window.removeEventListener("message", handler);
      }
    }, [onMsg]);

    const source = useMemo(() => ({ html: htmlContent }), [htmlContent]);

    if (Platform.OS === "web") {
      return (
        <View style={styles.container}>
          <iframe
            id="rte-frame"
            srcDoc={htmlContent}
            style={{ flex: 1, border: "none", width: '100%', height: '100%' }}
          />
        </View>
      );
    }

    const WebViewComponent = WebView;
    return (
      <View style={styles.container}>
        <WebViewComponent
          ref={webRef}
          source={source}
          onMessage={(e: any) => onMsg(e.nativeEvent.data)}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={["*"]}
          scrollEnabled={false}
          style={{ height: webViewHeight }}
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    minHeight: 200,
    height: Platform.OS === "web" ? "100%" : undefined,
  },
});

export default RichTextEditor;
