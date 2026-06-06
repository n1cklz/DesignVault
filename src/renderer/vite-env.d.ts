/// <reference types="vite/client" />

import type { DesignVaultApi } from "../shared/types";

declare global {
  interface Window {
    designVault?: DesignVaultApi;
  }
}
