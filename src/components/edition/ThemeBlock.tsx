import Image from "next/image";

import Window from "@/components/ui/Window";
import { theme } from "@/content/data/edition2026";
import type { Locale } from "@/lib/i18n";
import { asset } from "@/lib/paths";

/** The OPC statement beside the campaign illustration. */
export default function ThemeBlock({ locale }: { locale: Locale }) {
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
      <div className="space-y-5 text-base text-paper sm:text-[1.0625rem]">
        <p className="text-mist-300">{theme.intro[locale]}</p>
        <p className="border-l-2 border-orchid-400 pl-4 font-semibold text-lavender-200">{theme.question[locale]}</p>
        <p>{theme.invitation[locale]}</p>
      </div>

      <Window title="opc_world.png" as="aside" bodyClassName="bg-navy-900">
        <picture>
          <source srcSet={asset("/campaign/opc-world.webp")} type="image/webp" />
          <Image
            src={asset("/campaign/opc-world.jpg")}
            alt={
              locale === "zh"
                ? "像素插画：一位创作者坐在工作台前，通过电路连接商业、可信 AI、机器人与健康四个窗口"
                : "Pixel illustration: one creator at a workstation, wired to four windows — business, trustworthy AI, robotics and health"
            }
            width={1536}
            height={1024}
            className="block h-auto w-full"
          />
        </picture>
      </Window>
    </div>
  );
}
