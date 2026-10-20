import PagePlaceholder from "@/components/PagePlaceholder";
import { stubs } from "@/content/placeholders";
import { isLocale, type Locale } from "@/lib/i18n";

const stub = stubs.partners;

export async function generateMetadata(props: PageProps<"/[locale]/partners">) {
  const { locale } = await props.params;
  const l: Locale = isLocale(locale) ? locale : "en";
  return { title: stub.title[l], description: stub.intro[l] };
}

export default async function Page(props: PageProps<"/[locale]/partners">) {
  const { locale } = await props.params;
  const l: Locale = isLocale(locale) ? locale : "en";
  return (
    <PagePlaceholder
      locale={l}
      label={stub.label}
      title={stub.title[l]}
      intro={stub.intro[l]}
      planned={stub.planned[l]}
    />
  );
}
