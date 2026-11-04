// The parts of Google Identity Services (accounts.google.com/gsi/client) this app uses.
interface Window {
  google?: {
    accounts: {
      id: {
        initialize(config: {
          client_id: string;
          callback: (response: { credential: string }) => void;
        }): void;
        renderButton(
          parent: HTMLElement,
          options: {
            theme: "outline" | "filled_blue" | "filled_black";
            size: "small" | "medium" | "large";
            text: "signin_with" | "continue_with";
            shape: "rectangular" | "pill";
            logo_alignment: "left" | "center";
            width: number;
          },
        ): void;
      };
    };
  };
}
