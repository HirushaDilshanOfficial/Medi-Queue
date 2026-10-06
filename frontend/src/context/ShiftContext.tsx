import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface ShiftContextType {
  isShiftClosed: boolean;
  setIsShiftClosed: (closed: boolean) => void;
}

const ShiftContext = createContext<ShiftContextType>({
  isShiftClosed: false,
  setIsShiftClosed: () => {},
});

export const ShiftProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isShiftClosed, setIsShiftClosed] = useState<boolean>(false);

  return (
    <ShiftContext.Provider value={{ isShiftClosed, setIsShiftClosed }}>
      {children}
    </ShiftContext.Provider>
  );
};

export const useShiftContext = () => useContext(ShiftContext);
export default ShiftContext;
