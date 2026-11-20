import { Link } from "expo-router";
import { Text, View } from "react-native";
import { H1, P, Screen } from "../../components/ui";
import { colors, font } from "../../components/theme";
import { CONTEST_CLOSE_LABEL, PRIZE_DETAIL, PRIZE_NAME } from "../../lib/game/contest";

export default function Bases() {
  return (
    <Screen>
      <View style={{ padding: 20, gap: 14 }}>
        <H1>Bases del concurso</H1>
        <P>
          Santa a la Carrera es un juego de Mi Fotito. Puedes jugar sin dejar datos. El premio es un {PRIZE_NAME}: {PRIZE_DETAIL}.
        </P>
        <Text style={heading}>Hasta cuándo</Text>
        <P>El concurso va desde su publicación hasta el {CONTEST_CLOSE_LABEL}. Después de esa hora se puede seguir publicando un puntaje, pero queda fuera de concurso.</P>
        <Text style={heading}>Quién gana</Text>
        <P>Gana el puntaje confirmado más alto al cierre. Si hay empate, gana quien lo alcanzó primero. Mi Fotito escribe al correo confirmado. Hay 7 días para responder. Si no hay respuesta, el premio pasa al siguiente puesto.</P>
        <Text style={heading}>Entrega</Text>
        <P>El premio se entrega dentro del Perú, a la dirección que indique la persona ganadora. No incluye envíos fuera del país.</P>
        <Text style={heading}>Cómo se publica un puntaje</Text>
        <P>El apodo (2 a 20 letras) se muestra en el ranking. El correo no se muestra: solo sirve para confirmar el puntaje y, si ganas, para escribirte. El puntaje entra al ranking cuando abres el enlace del correo. Hay un puntaje confirmado por correo; uno nuevo lo reemplaza solo si es más alto.</P>
        <P>Hay una casilla aparte, sin marcar, para recibir ofertas de Mi Fotito por correo. No hace falta marcarla para jugar ni para concursar.</P>
        <Text style={heading}>Juego limpio</Text>
        <P>Mi Fotito puede quitar del concurso un puntaje que no corresponda a una partida real, o a quien manipule el juego. El servidor vuelve a calcular la partida antes de aceptarla.</P>
        <P>Datos tratados según la Ley 29733. Más detalle en la política de privacidad.</P>
        <Link href="/privacidad" style={{ fontFamily: font.semibold, fontSize: 16, color: colors.red, minHeight: 44 }}>
          Política de privacidad
        </Link>
        <Link href="/juego" style={{ fontFamily: font.semibold, fontSize: 16, color: colors.ink, minHeight: 44 }}>
          Volver al juego
        </Link>
      </View>
    </Screen>
  );
}

const heading = { fontFamily: font.displaySoft, fontSize: 22, color: colors.ink, textAlign: "center" as const };
