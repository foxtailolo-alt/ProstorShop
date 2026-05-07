declare module "*.css";

type TelegramWebAppColorKey = "bg_color" | "secondary_bg_color" | "bottom_bar_bg_color";

type TelegramWebApp = {
	ready(): void;
	expand(): void;
	requestFullscreen?(): void;
	setHeaderColor(color: TelegramWebAppColorKey | `#${string}`): void;
	setBackgroundColor(color: TelegramWebAppColorKey | `#${string}`): void;
	setBottomBarColor(color: TelegramWebAppColorKey | `#${string}`): void;
	initDataUnsafe?: {
		auth_date?: number;
		hash?: string;
		user?: {
			id: number;
			first_name: string;
			last_name?: string;
			username?: string;
			photo_url?: string;
		};
	};
};

declare global {
	interface Window {
		Telegram?: {
			WebApp?: TelegramWebApp;
		};
	}
}

export {};