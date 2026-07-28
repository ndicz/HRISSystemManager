// Must match `basePath` in next.config.ts exactly (kept as a separate
// literal there, not imported, since next.config.ts is loaded outside the
// app's module graph). Only needed for raw <a href>/<img src> tags and
// proxy.ts's manually-constructed redirect URLs — next/link, useRouter, and
// next/navigation's redirect() all apply this automatically already.
export const BASE_PATH = "/HRIS_APPS";
