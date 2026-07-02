import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

export const usePersistedState = (key: string, defaultValue: any) => {
  const [state, setState] = useState(defaultValue);

  useEffect(() => {
    const load = async () => {
      const saved = await AsyncStorage.getItem(key);
      if (saved) setState(JSON.parse(saved));
    };
    load();
  }, [key]);

  const setPersistedState = useCallback(
    (val: any) => {
      setState(val);
      AsyncStorage.setItem(key, JSON.stringify(val));
    },
    [key],
  );

  return [state, setPersistedState];
};
