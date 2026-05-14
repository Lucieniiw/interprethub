/** Browser-facing origin used in invitation links, magic email links, and HTML fallback pages. */
export function publicBrowserOrigin(): string {
  return (
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.FRONTEND_ORIGIN?.trim() ||
    "http://localhost:5175"
  ).replace(/\/$/, "");
}
