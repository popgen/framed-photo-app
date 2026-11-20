import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { colors, font } from "../../components/theme";
import { ZONES } from "../../lib/game/contest";

type Row = {
  nickname: string;
  email: string;
  score: number;
  zone: number;
  distance: number;
  confirmedAt: string;
  inContest: boolean;
  marketingOptIn: boolean;
  pendingScore: number | null;
};

export default function AdminJuego() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { getSupabase } = await import("../../lib/supabase");
        const { data } = await getSupabase().auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          if (alive) setProblem("Entra como administrador para ver los correos.");
          return;
        }
        const response = await fetch("/api/game-admin", { headers: { Authorization: `Bearer ${token}` } });
        const body = (await response.json().catch(() => null)) as { rows?: Row[]; error?: string } | null;
        if (!alive) return;
        if (!response.ok) setProblem(body?.error || "No se pudo leer el ranking.");
        else setRows(body?.rows ?? []);
      } catch {
        if (alive) setProblem("No se pudo leer el ranking.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Concurso</Text>
      <Text style={{ fontFamily: font.body, color: colors.muted }}>Puntajes confirmados, con el correo de quien los publicó.</Text>
      {problem ? <Text style={{ fontFamily: font.medium, color: colors.bad }}>{problem}</Text> : null}
      {rows?.length === 0 ? <Text style={{ fontFamily: font.body, color: colors.muted }}>Todavía no hay puntajes confirmados.</Text> : null}
      {(rows ?? []).map((row) => (
        <View key={`${row.email}-${row.confirmedAt}`} style={{ backgroundColor: colors.white, borderRadius: 16, padding: 12, gap: 4 }}>
          <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{row.nickname} · {row.score} pts</Text>
          <Text style={{ fontFamily: font.body, color: colors.ink }}>{row.email}</Text>
          <Text style={{ fontFamily: font.body, color: colors.muted }}>
            {ZONES[(row.zone ?? 1) - 1]?.name ?? ""} · {row.distance} m · {row.inContest ? "En concurso" : "Fuera de concurso"}
            {row.marketingOptIn ? " · acepta ofertas" : ""}
            {row.pendingScore != null ? ` · pendiente ${row.pendingScore}` : ""}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
