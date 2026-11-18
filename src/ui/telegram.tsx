/**
 * Bottom actions: Telegram MainButton/BackButton inside a real Telegram client, ordinary page
 * buttons elsewhere (plain browser, tests). Outside Telegram, telegram-web-app.js reports the
 * platform "unknown" and draws no native buttons, so page buttons are used there.
 */
import { createContext, useContext, useEffect, useRef } from "react";
import type { TelegramWebApp } from "../telegram/webapp";
import { t } from "./i18n/ru";

const TelegramContext = createContext<TelegramWebApp | null>(null);
export const TelegramProvider = TelegramContext.Provider;

/** Client details for diagnostics (no user identity: initData is never read). */
export function useTelegramClient(): { version: string; platform: string } | null {
  const webApp = useContext(TelegramContext);
  return webApp ? { version: webApp.version, platform: webApp.platform } : null;
}

function useNativeWebApp(): TelegramWebApp | null {
  const webApp = useContext(TelegramContext);
  return webApp && webApp.platform !== "unknown" ? webApp : null;
}

export interface Action {
  label: string;
  onClick: () => void;
}

export interface BottomActionsProps {
  primary: Action;
  /** Shown as Telegram's BackButton or a secondary page button. */
  back?: Action | null | undefined;
}

export function BottomActions({ primary, back }: BottomActionsProps) {
  const native = useNativeWebApp();
  const primaryRef = useRef(primary.onClick);
  const backRef = useRef(back?.onClick);
  useEffect(() => {
    primaryRef.current = primary.onClick;
    backRef.current = back?.onClick;
  });

  const hasBack = Boolean(back);
  useEffect(() => {
    if (!native) return;
    const button = native.mainButton;
    const onMain = () => primaryRef.current();
    button.setText(primary.label);
    button.show();
    button.onClick(onMain);
    return () => {
      button.offClick(onMain);
      button.hide();
    };
  }, [native, primary.label]);

  useEffect(() => {
    if (!native || !hasBack) return;
    const button = native.backButton;
    const onBack = () => backRef.current?.();
    button.show();
    button.onClick(onBack);
    return () => {
      button.offClick(onBack);
      button.hide();
    };
  }, [native, hasBack]);

  if (native) return null;
  return (
    <>
      {back && (
        <button type="button" className="secondary" onClick={back.onClick}>
          {back.label || t("common.back")}
        </button>
      )}
      <button type="button" onClick={primary.onClick}>
        {primary.label}
      </button>
    </>
  );
}
