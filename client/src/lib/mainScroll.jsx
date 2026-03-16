import { createContext, useContext } from "react";

const MainScrollContext = createContext(null);

export function MainScrollProvider({ value, children }) {
  return (
    <MainScrollContext.Provider value={value}>
      {children}
    </MainScrollContext.Provider>
  );
}

export function useMainScrollElement() {
  return useContext(MainScrollContext);
}
