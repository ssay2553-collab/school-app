// This file is used to customize the root HTML for the web platform.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        
        {/* PWA Settings */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="EduEaz" />
        <meta name="format-detection" content="telephone=no" />

        {/* CSS Reset for better PWA feel on iOS Safari */}
        <style dangerouslySetInnerHTML={{ __html: `
          html, body, #root {
            height: 100%;
            width: 100%;
            margin: 0;
            padding: 0;
            overflow: hidden; /* Prevent scrolling on body to fix iOS bounce */
            background-color: #F8FAFC;
            -webkit-tap-highlight-color: transparent;
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            user-select: none;
          }

          /* Allow scrolling only in specific containers if needed, 
             but generally we want the React Native components to handle it */
          #root > div {
            height: 100%;
            display: flex;
            flex-direction: column;
          }

          /* Fix for Safari full height */
          @supports (-webkit-touch-callout: none) {
            html, body, #root {
              height: -webkit-fill-available;
            }
          }
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
