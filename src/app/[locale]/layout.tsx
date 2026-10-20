import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { dict } from "@/content/dictionaries";
import { currentEdition, site } from "@/content/site";
import { htmlLang, isLocale, locales, type Locale } from "@/lib/i18n";
import { absolute, asset } from "@/lib/paths";

import "../globals.css";

/* Only `en` and `zh` exist; anything else 404s instead of being rendered. */
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: "#021a33",
  colorScheme: "dark",
};

export async function generateMetadata(props: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await props.params;
  const l: Locale = isLocale(locale) ? locale : "en";

  const title =
    l === "zh"
      ? `DIC ${currentEdition.year} · 上海纽约大学数字创新挑战赛`
      : `DIC ${currentEdition.year} · NYU Shanghai Digital Innovation Challenge`;
  const description = dict.heroBody[l];

  return {
    title: { default: title, template: `%s · DIC ${currentEdition.year}` },
    description,
    alternates: {
      canonical: absolute(`/${l}/`),
      languages: { en: absolute("/en/"), "zh-Hans": absolute("/zh/") },
    },
    openGraph: {
      type: "website",
      siteName: site.name,
      title,
      description,
      locale: l === "zh" ? "zh_CN" : "en_US",
      images: [{ url: absolute("/brand/og-default.png"), width: 1200, height: 630 }],
    },
    icons: {
      icon: [
        { url: asset("/brand/icon-32.png"), sizes: "32x32", type: "image/png" },
        { url: asset("/brand/icon-512.png"), sizes: "512x512", type: "image/png" },
      ],
      apple: asset("/brand/icon-180.png"),
    },
  };
}

export default async function RootLayout(props: LayoutProps<"/[locale]">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) notFound();

  return (
    // suppressHydrationWarning: the inline script below adds `js` to <html>
    // before React hydrates, which is intentional.
    <html lang={htmlLang[locale]} className="h-full" suppressHydrationWarning>
      <head>
        {/* Marks JS as available before first paint, so scroll reveals can hide
            content without ever hiding it from no-JS readers. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-lavender-200 focus:px-4 focus:py-2 focus:font-mono focus:text-sm focus:font-bold focus:text-navy-900"
        >
          {dict.skipToContent[locale]}
        </a>
        <SiteHeader locale={locale} />
        <main id="main" className="flex-1">
          {props.children}
        </main>
        <SiteFooter locale={locale} />
      </body>
    </html>
  );
}
