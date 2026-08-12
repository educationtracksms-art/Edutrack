export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>EduTrack</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: Arial, sans-serif;
        background: #f8fafc;
        color: #0f172a;
      }
      .card {
        max-width: 32rem;
        margin: 1.5rem;
        padding: 2rem;
        border: 1px solid #e2e8f0;
        border-radius: 1rem;
        background: white;
        box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
        text-align: center;
      }
      h1 { margin: 0 0 0.75rem; font-size: 1.5rem; }
      p { margin: 0; line-height: 1.5; color: #475569; }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Something went wrong</h1>
      <p>The app hit an error while loading. Please try again from a clean page instead of being redirected in a loop.</p>
    </main>
  </body>
</html>`;
}
