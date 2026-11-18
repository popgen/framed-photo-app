import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Screen } from "../../components/ui";
import { colors, font } from "../../components/theme";
import { writeBoot, rememberWaOrder } from "../../lib/boot";
import { aspectParts, frameById } from "../../lib/catalog";
import { uid } from "../../lib/ids";
import { getRepo } from "../../lib/repo";
import { assessResolution, centeredCrop } from "../../lib/print-size";
import { useCart } from "../../lib/store";

export default function MagicLink() {
  const { token, pago } = useLocalSearchParams<{ token: string; pago?: string }>();
  const [error, setError] = useState<string | null>(null);
  const addMany = useCart((state) => state.addMany);
  const clear = useCart((state) => state.clear);

  useEffect(() => {
    void getRepo()
      .getWhatsAppDraft(String(token))
      .then((draft) => {
        if (!draft || !draft.photos.length) {
          setError("Ese enlace ya no tiene fotos. Mándanos la foto otra vez por WhatsApp.");
          return;
        }
        clear();
        const items = draft.photos.map((photo, index) => {
          const frame = frameById(draft.frameId || (draft.mode === "wall" && draft.photos.length >= 4 ? "square-black-20" : draft.mode === "wall" && index === 1 && draft.photos.length === 3 ? "black-30" : "wood-15"));
          const [aw, ah] = aspectParts(frame, "portrait");
          const crop = centeredCrop(photo.width, photo.height, aw, ah);
          const assessed = assessResolution({
            cropWidthPx: crop.width,
            cropHeightPx: crop.height,
            printWcm: frame.printWcm,
            printHcm: frame.printHcm,
            orientation: "portrait",
          });
          return {
            id: uid("ci_"),
            frameId: frame.id,
            photoId: photo.photoId,
            crop,
            orientation: "portrait" as const,
            dpi: Math.round(assessed.dpi),
            resolutionStatus: assessed.status,
            bundleId: draft.mode === "wall" ? draft.token : null,
            bundleLabel: draft.mode === "wall" ? "Muro de WhatsApp" : null,
          };
        });
        addMany(items);
        if (draft.orderId) rememberWaOrder(draft.orderId);
        writeBoot({
          frameId: draft.frameId,
          photo: { id: draft.photos[0].photoId, width: draft.photos[0].width, height: draft.photos[0].height },
          mode: draft.mode,
          orderId: draft.orderId,
          pago: typeof pago === "string" ? pago : null,
        });
        router.replace(draft.mode === "wall" ? "/muro" : `/crear`);
      })
      .catch((err: Error) => setError(err.message));
  }, [addMany, clear, pago, token]);

  return (
    <Screen>
      <View style={{ padding: 20 }}>
        <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>{error ?? "Abriendo tu foto en el marco…"}</Text>
      </View>
    </Screen>
  );
}
