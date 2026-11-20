import { Link, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { Pressable, Text, View } from "react-native";
import { Button, Card, Field, H1, P, Screen } from "../../components/ui";
import { colors, font } from "../../components/theme";
import { CONTEST_CLOSE_LABEL, PRIZE_DETAIL, PRIZE_NAME, ZONES, contestOpen } from "../../lib/game/contest";

type Finish = {
  score: number;
  distance: number;
  photos: number;
  zone: number;
  zoneName: string;
  submittable: boolean;
  runLog: { v: 1; seed: number; inputs: number[] };
};

type RunnerProps = {
  startMeters?: number;
  onExit: () => void;
  onFinish: (result: Finish) => void;
};

type Row = { nickname: string; score: number; zone: number; confirmedAt: string };

const BEST_KEY = "mifotito-santa-best";

function queryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function previewMeters(value: string): number | null {
  if (value === "1") return 0;
  if (value === "2") return 500;
  if (value === "3") return 1200;
  if (value === "4") return 2500;
  return null;
}

function readBest(): number {
  if (typeof localStorage === "undefined") return 0;
  const stored = Number(localStorage.getItem(BEST_KEY) || "0");
  return Number.isFinite(stored) ? stored : 0;
}

function remember(score: number): number {
  const best = Math.max(readBest(), score);
  if (typeof localStorage !== "undefined") localStorage.setItem(BEST_KEY, String(best));
  return best;
}

export default function Juego() {
  const params = useLocalSearchParams<{ vista?: string; confirmado?: string }>();
  const started = useRef(false);
  const [phase, setPhase] = useState<"lobby" | "espera" | "play" | "result">("lobby");
  const [Runner, setRunner] = useState<ComponentType<RunnerProps> | null>(null);
  const [startMeters, setStartMeters] = useState(0);
  const [result, setResult] = useState<Finish | null>(null);
  const [best, setBest] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [offers, setOffers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState("");
  const open = contestOpen(new Date());

  useEffect(() => {
    setBest(readBest());
    void fetch("/api/game")
      .then((response) => response.json())
      .then((body: { rows?: Row[] }) => setRows(Array.isArray(body.rows) ? body.rows : []))
      .catch(() => setRows([]));
  }, [phase]);

  async function begin(meters: number) {
    setProblem("");
    setPhase("espera");
    setStartMeters(meters);
    try {
      const mod = await import("../../components/game/SantaRunner");
      setRunner(() => mod.SantaRunner);
      setPhase("play");
    } catch {
      setPhase("lobby");
      setProblem("No se pudo abrir el juego. Vuelve a intentar.");
    }
  }

  useEffect(() => {
    const meters = previewMeters(queryValue(params.vista));
    if (meters == null || started.current) return;
    started.current = true;
    void begin(meters);
  }, [params.vista]);

  if (phase === "play" && Runner) {
    return (
      <Runner
        startMeters={startMeters}
        onExit={() => setPhase("lobby")}
        onFinish={(next) => {
          setResult(next);
          if (next.submittable) setBest(remember(next.score));
          setNote("");
          setProblem("");
          setPhase("result");
        }}
      />
    );
  }

  if (phase === "espera") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
        <Text style={{ fontFamily: font.display, fontSize: 28, color: colors.ink, textAlign: "center" }}>Preparando el juego…</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => setPhase("lobby")} style={{ minHeight: 48, minWidth: 48, justifyContent: "center" }}>
          <Text style={{ fontFamily: font.semibold, fontSize: 16, color: colors.ink }}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Screen>
      <View style={{ padding: 20, gap: 16 }}>
        <H1>Santa a la Carrera</H1>
        <P style={{ textAlign: "center" }}>
          Santa corre solo. Mantén pulsado para saltar más alto: un toque corto es un salto chico. Junta fotitos y esquiva lo que sale en la nieve.
        </P>
        {queryValue(params.confirmado) === "1" ? <Card><P style={{ textAlign: "center" }}>Recibimos tu confirmación.</P></Card> : null}
        {problem ? <Text style={{ fontFamily: font.medium, color: colors.bad, textAlign: "center" }}>{problem}</Text> : null}
        <Button label="Jugar" onPress={() => void begin(0)} />
        <Text style={{ fontFamily: font.body, color: colors.muted, textAlign: "center" }}>
          {open ? `Concurso abierto hasta el ${CONTEST_CLOSE_LABEL}.` : "El concurso ya cerró. Puedes publicar tu puntaje, fuera de concurso."} Premio: un {PRIZE_NAME} ({PRIZE_DETAIL}).
        </Text>
        <Link href="/juego/bases" style={{ fontFamily: font.semibold, fontSize: 16, color: colors.red, textAlign: "center", minHeight: 44 }}>
          Ver las bases
        </Link>
        {phase === "result" && result ? (
          <Card>
            <Text style={{ fontFamily: font.display, fontSize: 28, color: colors.ink, textAlign: "center" }}>{result.score} puntos</Text>
            <P style={{ textAlign: "center" }}>
              {result.distance} m · {result.photos} fotitos · {result.zoneName}
            </P>
            <P style={{ textAlign: "center" }}>Mejor puntaje en este teléfono: {best}</P>
            {result.submittable ? (
              <View style={{ gap: 12 }}>
                <Field label="Apodo" value={nickname} onChangeText={setNickname} maxLength={20} autoCapitalize="words" autoCorrect={false} />
                <Field label="Correo" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                <Text style={{ fontFamily: font.body, fontSize: 14, lineHeight: 20, color: colors.muted }}>
                  Tu apodo se publica en el ranking. El correo no se muestra. Usamos estos datos para confirmar el puntaje, según la Ley 29733.{" "}
                  <Link href="/privacidad" style={{ color: colors.red, textDecorationLine: "underline" }}>
                    Política de privacidad
                  </Link>
                </Text>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: offers }} onPress={() => setOffers((value) => !value)} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 18, color: colors.ink }}>{offers ? "☑" : "☐"}</Text>
                  <Text style={{ flex: 1, fontFamily: font.body, fontSize: 16, lineHeight: 22, color: colors.ink }}>Quiero recibir ofertas de Mi Fotito por correo.</Text>
                </Pressable>
                {note ? <Text style={{ fontFamily: font.medium, color: colors.good, textAlign: "center" }}>{note}</Text> : null}
                {problem ? <Text style={{ fontFamily: font.medium, color: colors.bad, textAlign: "center" }}>{problem}</Text> : null}
                <Button
                  label={busy ? "Enviando…" : "Publicar mi puntaje"}
                  disabled={busy}
                  onPress={() => void publish(result, { nickname, email, offers, setBusy, setNote, setProblem })}
                />
              </View>
            ) : (
              <P style={{ textAlign: "center" }}>Esta vista es solo para mirar la zona. No entra al ranking.</P>
            )}
            <Button label="Jugar de nuevo" tone="ghost" onPress={() => void begin(0)} />
            <Link href="/crear" style={{ fontFamily: font.bold, fontSize: 16, color: colors.red, textAlign: "center", minHeight: 48 }}>
              ¿Enmarcamos tus fotos de verdad?
            </Link>
          </Card>
        ) : null}
        <Text style={{ fontFamily: font.displaySoft, fontSize: 22, color: colors.ink, textAlign: "center" }}>Ranking</Text>
        {rows.length === 0 ? <P style={{ textAlign: "center" }}>Todavía no hay puntajes confirmados.</P> : null}
        {rows.map((row, index) => (
          <View key={`${row.nickname}-${row.confirmedAt}-${index}`} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 16, color: colors.ink }}>{index + 1}. {row.nickname}</Text>
            <Text style={{ fontFamily: font.body, fontSize: 14, color: colors.muted }}>{ZONES[(row.zone ?? 1) - 1]?.name ?? ""}</Text>
            <Text style={{ fontFamily: font.bold, fontSize: 16, color: colors.ink }}>{row.score}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

async function publish(
  result: Finish,
  form: {
    nickname: string;
    email: string;
    offers: boolean;
    setBusy: (value: boolean) => void;
    setNote: (value: string) => void;
    setProblem: (value: string) => void;
  },
) {
  form.setBusy(true);
  form.setNote("");
  form.setProblem("");
  try {
    const response = await fetch("/api/game", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nickname: form.nickname,
        email: form.email,
        marketingOptIn: form.offers,
        score: result.score,
        distance: result.distance,
        zone: result.zone,
        photos: result.photos,
        runLog: result.runLog,
      }),
    });
    const body = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
    if (!response.ok) form.setProblem(body?.error || "No pudimos publicar el puntaje.");
    else form.setNote(body?.message || "Listo.");
  } catch {
    form.setProblem("No pudimos publicar el puntaje.");
  } finally {
    form.setBusy(false);
  }
}
