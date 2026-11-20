import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { zoneAt, zoneName } from "../../lib/game/contest";
import { totalScore } from "../../lib/game/score";
import { PX_PER_METER, createRun, snapshot, stepRun, type RunResult, type RunState } from "../../lib/game/simulate";
import { createSound, type GameSound } from "./audio";
import { drawFrame } from "./draw";

export type SantaFinish = RunResult;

type Props = {
  startMeters?: number;
  onExit: () => void;
  onFinish: (result: RunResult) => void;
};

type Viewport = { width: number; height: number; top: number; left: number };

function readViewport(): Viewport {
  const visual = window.visualViewport;
  return {
    width: Math.max(1, Math.round(visual?.width ?? window.innerWidth)),
    height: Math.max(1, Math.round(visual?.height ?? window.innerHeight)),
    top: Math.round(visual?.offsetTop ?? 0),
    left: Math.round(visual?.offsetLeft ?? 0),
  };
}

export function SantaRunner({ startMeters = 0, onExit, onFinish }: Props) {
  const insets = useSafeAreaInsets();
  const host = useRef<HTMLElement | null>(null);
  const distanceNode = useRef<HTMLElement | null>(null);
  const zoneNode = useRef<HTMLElement | null>(null);
  const soundRef = useRef<GameSound | null>(null);
  const releaseRef = useRef<() => void>(() => {});
  const pausedRef = useRef(false);
  const exitRef = useRef(onExit);
  const finishRef = useRef(onFinish);
  exitRef.current = onExit;
  finishRef.current = onFinish;
  const [paused, setPaused] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [view, setView] = useState<Viewport | null>(null);

  useEffect(() => {
    const node = host.current;
    if (!node || typeof document === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      width: "100%",
      height: "100%",
      display: "block",
      touchAction: "none",
      userSelect: "none",
    });
    canvas.style.setProperty("-webkit-user-select", "none");
    canvas.style.setProperty("-webkit-touch-callout", "none");
    node.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const seedBuffer = new Uint32Array(1);
    crypto.getRandomValues(seedBuffer);
    const state: RunState = createRun(seedBuffer[0] || 1, { startMeters });
    const sound = createSound();
    soundRef.current = sound;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let holding = false;
    let finished = false;
    let finishTimer = 0;
    const dt = 1 / 60;
    let box = readViewport();

    const blockMenu = (event: Event) => event.preventDefault();
    const blockMove = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault();
    };
    canvas.addEventListener("contextmenu", blockMenu);
    window.addEventListener("gesturestart", blockMenu);
    document.addEventListener("touchmove", blockMove, { passive: false });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    const writeHud = () => {
      const distance = Math.floor(state.camera / PX_PER_METER);
      const score = totalScore({
        distanceMeters: distance,
        photoPoints: state.photoPoints,
        arcs: state.arcsDone,
        nearMisses: state.nearMisses,
      });
      const zone = zoneName(zoneAt(distance));
      const distanceEl = distanceNode.current;
      const zoneEl = zoneNode.current;
      if (distanceEl) distanceEl.textContent = `${distance} m · ${score} pts`;
      if (zoneEl) zoneEl.textContent = state.saves > 0 ? `${zone} · fotito dorado` : zone;
    };

    const press = () => {
      if (pausedRef.current || finished || holding || !state.jumper.grounded) return;
      holding = true;
      state.inputs.push({ f: state.frame, d: 1 });
      sound.jump();
    };
    const release = () => {
      if (!holding) return;
      holding = false;
      state.inputs.push({ f: state.frame, d: 0 });
    };
    releaseRef.current = release;

    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      canvas.setPointerCapture?.(event.pointerId);
      press();
    };
    const onPointerUp = (event: PointerEvent) => {
      event.preventDefault();
      release();
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.code !== "ArrowUp") return;
      event.preventDefault();
      if (event.repeat) return;
      if (event.type === "keydown") press();
      else release();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);

    const onHide = () => {
      if (!document.hidden) return;
      release();
      pausedRef.current = true;
      setPaused(true);
    };
    document.addEventListener("visibilitychange", onHide);

    const fit = () => {
      const next = readViewport();
      box = next;
      setView((prev) => {
        if (prev && prev.width === next.width && prev.height === next.height && prev.top === next.top && prev.left === next.left) return prev;
        return next;
      });
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.floor(box.width * dpr));
      const height = Math.max(1, Math.floor(box.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("scroll", fit);

    const loop = (now: number) => {
      if (!canvas.isConnected) node.appendChild(canvas);
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!pausedRef.current && !finished) {
        acc += delta;
        let steps = 0;
        while (acc >= dt && steps < 5) {
          const beforePhotos = state.photosCaught;
          const beforeGolden = state.goldenCaught;
          const beforeEnded = state.ended;
          stepRun(state);
          if (state.goldenCaught && !beforeGolden) sound.golden();
          else if (state.photosCaught > beforePhotos) sound.photo();
          if (beforeEnded === "play" && state.ended === "crash") sound.crash();
          acc -= dt;
          steps += 1;
          if (state.ended !== "play") break;
        }
      }
      writeHud();
      drawFrame(ctx, state, box.width, box.height);
      if (!pausedRef.current) sound.tick(zoneAt(state.camera / PX_PER_METER), state.frame);
      if (!finished && state.ended !== "play") {
        finished = true;
        writeHud();
        const result = snapshot(state);
        finishTimer = window.setTimeout(() => finishRef.current(result), 420);
      }
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(finishTimer);
      releaseRef.current = () => {};
      soundRef.current = null;
      sound.stop();
      canvas.remove();
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = "";
      document.removeEventListener("touchmove", blockMove);
      window.removeEventListener("gesturestart", blockMenu);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("scroll", fit);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [startMeters]);

  const button = {
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,252,249,0.94)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  return (
    <View
      style={
        {
          position: "fixed",
          top: view?.top ?? 0,
          left: view?.left ?? 0,
          width: view?.width ?? "100%",
          height: view?.height ?? ("100dvh" as unknown as number),
          backgroundColor: "#071018",
          touchAction: "none",
        } as unknown as ViewStyle
      }
    >
      <View ref={host as never} style={{ flex: 1 }} />
      <View pointerEvents="box-none" style={{ position: "absolute", top: Math.max(insets.top, 8), left: 12, right: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View>
            <Text ref={distanceNode as never} style={chip}>
              {Math.floor(startMeters)} m · 0 pts
            </Text>
            <Text ref={zoneNode as never} style={[chip, { marginTop: 4, alignSelf: "flex-start" }]}>
              {zoneName(zoneAt(startMeters))}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={soundOn ? "Apagar sonido" : "Encender sonido"}
              onPress={() => setSoundOn(soundRef.current?.toggle() ?? false)}
              style={button}
            >
              <Text style={buttonText}>{soundOn ? "Sonido" : "Mudo"}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={paused ? "Seguir" : "Pausa"}
              onPress={() => {
                if (!pausedRef.current) releaseRef.current();
                pausedRef.current = !pausedRef.current;
                setPaused(pausedRef.current);
              }}
              style={button}
            >
              <Text style={buttonText}>{paused ? "Seguir" : "Pausa"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
      {paused ? (
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(20,12,14,0.45)", padding: 20 }}>
          <View style={{ backgroundColor: "#FFFCF9", borderRadius: 24, padding: 20, gap: 12, width: "100%", maxWidth: 360 }}>
            <Text style={{ fontFamily: "Fraunces_700Bold", fontSize: 32, color: "#241714", textAlign: "center" }}>Pausa</Text>
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 16, lineHeight: 22, color: "#6E564C", textAlign: "center" }}>
              Mantén pulsado para saltar más alto. Un toque corto es un salto chico.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Seguir jugando"
              onPress={() => {
                pausedRef.current = false;
                setPaused(false);
              }}
              style={{ minHeight: 48, borderRadius: 999, backgroundColor: "#C5363C", alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontFamily: "Outfit_700Bold", color: "white", fontSize: 16 }}>Seguir</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Salir del juego" onPress={() => exitRef.current()} style={{ minHeight: 48, borderRadius: 999, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: "Outfit_700Bold", color: "#241714", fontSize: 16 }}>Salir</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const chip = {
  color: "#241714",
  fontFamily: "Outfit_700Bold",
  fontSize: 16,
  backgroundColor: "rgba(255,252,249,0.88)",
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 12,
  overflow: "hidden" as const,
};

const buttonText = { fontFamily: "Outfit_700Bold", color: "#241714", fontSize: 14 };
