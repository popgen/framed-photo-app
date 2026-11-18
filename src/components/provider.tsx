import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { getRepo, type Repository } from "../lib/repo";
import { useCart } from "../lib/store";
import { colors, font } from "./theme";

const Ctx = createContext({ revision: 0, refresh: () => {} });

export function useApp() {
  return useContext(Ctx);
}

export function useRepo<T>(loader: (repo: Repository) => Promise<T>, deps: unknown[] = []) {
  const { revision } = useApp();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loader(getRepo())
      .then((value) => {
        if (live) setData(value);
      })
      .catch((err: Error) => {
        if (live) setError(err.message);
      });
    return () => {
      live = false;
    };
    // The loader identity is owned by the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, ...deps]);
  return { data, error };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const hydrate = useCart((state) => state.hydrate);
  useEffect(() => {
    getRepo()
      .init()
      .then(() => {
        hydrate();
        setReady(true);
      })
      .catch((err: Error) => setError(err.message));
  }, [hydrate]);
  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ fontFamily: font.display, fontSize: 28, color: colors.ink, textAlign: "center" }}>No pudimos abrir Recuerdo</Text>
        <Text style={{ fontFamily: font.body, color: colors.muted, marginTop: 8, textAlign: "center" }}>{error}</Text>
      </View>
    );
  }
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: font.display, fontSize: 28, color: colors.ink }}>Recuerdo</Text>
        <Text style={{ fontFamily: font.body, color: colors.muted, marginTop: 6 }}>Preparando tus marcos…</Text>
      </View>
    );
  }
  return <Ctx.Provider value={{ revision, refresh: () => setRevision((value) => value + 1) }}>{children}</Ctx.Provider>;
}
