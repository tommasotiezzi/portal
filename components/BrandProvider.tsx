"use client";
import { createContext, useContext } from "react";

export interface Brand {
  slug: string;
  name: string;
  accent: string;
  logoUrl: string | null;
}

export const DEFAULT_BRAND: Brand = {
  slug: "algo",
  name: "Algo Fantacalcio",
  accent: "#35d07f",
  logoUrl: null, // null = asset di default nel repo
};

const BrandContext = createContext<Brand>(DEFAULT_BRAND);

/** Brand dell'app servita da questo hostname.
 *  Risolto server-side nel root layout (cache 5'), zero fetch client. */
export function useBrand(): Brand {
  return useContext(BrandContext);
}

export function BrandProvider({ brand, children }: { brand: Brand; children: React.ReactNode }) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}