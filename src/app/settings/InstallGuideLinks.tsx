import Link from "next/link";
import { Package, Smartphone, TabletSmartphone } from "lucide-react";
import { GUIDE_LINKS } from "@/features/help/install-links";
import s from "./Settings.module.css";

/** Links to the FAQ's install guides (Fix list 2026-10-30 #4), drawn on the server. */
export function InstallGuideLinks() {
  return (
    <div className={s.guides}>
      <p className={s.note}>Step-by-step guides:</p>
      <Link href={GUIDE_LINKS.iphone}>
        <Smartphone aria-hidden /> Install on iPhone or iPad
      </Link>
      <Link href={GUIDE_LINKS.android}>
        <TabletSmartphone aria-hidden /> Install on Android
      </Link>
      <Link href={GUIDE_LINKS.apk}>
        <Package aria-hidden /> Android app file (APK): download and install
      </Link>
    </div>
  );
}
