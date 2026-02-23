import { createContext, useContext } from 'react';

export interface SpaceInfo {
  id: number;
  slug: string;   // e.g. "Spaces-1"
  name: string;
}

interface SpaceContextType {
  space: SpaceInfo;
}

const defaultSpace: SpaceInfo = { id: 1, slug: 'Spaces-1', name: 'Default' };

export const SpaceContext = createContext<SpaceContextType>({ space: defaultSpace });

export const useSpace = () => useContext(SpaceContext);
