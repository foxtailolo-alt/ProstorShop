declare module "*.css";

type TelegramWebAppColorKey = "bg_color" | "secondary_bg_color" | "bottom_bar_bg_color";

type TelegramWebApp = {
	ready(): void;
	expand(): void;
	setHeaderColor(color: TelegramWebAppColorKey | `#${string}`): void;
	setBackgroundColor(color: TelegramWebAppColorKey | `#${string}`): void;
	setBottomBarColor(color: TelegramWebAppColorKey | `#${string}`): void;
};

declare global {
	interface Window {
		Telegram?: {
			WebApp?: TelegramWebApp;
		};
	}
}

export {};