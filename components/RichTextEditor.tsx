import React, { forwardRef, useImperativeHandle, useRef } from "react";
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

    const send = (script: string) => {
      if (Platform.OS === "web") {
        const iframe = document.getElementById(
          "rte-frame",
        ) as HTMLIFrameElement;
        iframe?.contentWindow?.postMessage(script, "*");
      } else {
        webRef.current?.injectJavaScript(script);
      }
    };

    useImperativeHandle(ref, () => ({
      getHTML: () =>
        new Promise((resolve) => {
          resolver.current = resolve;
          send("window.__GET__()");
        }),
      setHTML: (html: string) => {
        send(`window.__SET__(${JSON.stringify(html)})`);
      },
    }));

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
body { margin:0; font-family: -apple-system, sans-serif; height: 100vh; display: flex; flex-direction: column; }
.toolbar {
  display:${readOnly ? "none" : "flex"};
  flex-wrap: wrap;
  padding:8px;
  border-bottom:1px solid #ddd;
  background:#fafafa;
  gap: 4px;
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
  flex: 1;
  padding:12px;
  outline:none;
  overflow-y: auto;
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

editor.innerHTML = ${JSON.stringify(initialContent)};

function cmd(c){
  document.execCommand(c,false,null);
  sendUpdate();
}

function highlightText() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  document.execCommand("insertHTML", false,
    '<span class="highlight">' + selection.toString() + '</span>'
  );
  sendUpdate();
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

editor.addEventListener("input", sendUpdate);

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
`;

    const onMsg = (data: any) => {
      try {
        const msg = JSON.parse(typeof data === 'string' ? data : JSON.stringify(data));

        if (msg.type === "CHANGE") {
          onChange?.(msg.html);
        }

        if (msg.type === "GET") {
          resolver.current?.(msg.html);
        }
      } catch (err) {
        // console.warn("RTE onMsg error:", err);
      }
    };

    if (Platform.OS === "web") {
      return (
        <View style={styles.container}>
          <iframe
            id="rte-frame"
            srcDoc={html}
            style={{ flex: 1, border: "none", width: '100%', height: '100%' }}
            onLoad={() => {
              window.addEventListener("message", (e) => {
                onMsg(e.data);
              });
            }}
          />
        </View>
      );
    }

    const WebViewComponent = WebView;
    return (
      <View style={styles.container}>
        <WebViewComponent
          ref={webRef}
          source={{ html }}
          onMessage={(e: any) => onMsg(e.nativeEvent.data)}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={["*"]}
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
});

export default RichTextEditor;
