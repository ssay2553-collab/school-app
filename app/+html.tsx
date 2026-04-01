//+html.tsx

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />

        {/* PWA Settings */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="EduEaz" />

        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root {
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100%;
                background-color: #F8FAFC;
              }

              #root {
                display: flex;
                flex-direction: column;
                min-height: 100%;
              }

              body {
                overflow: auto;
                -webkit-tap-highlight-color: transparent;
                padding-top: env(safe-area-inset-top);
                padding-bottom: env(safe-area-inset-bottom);
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
