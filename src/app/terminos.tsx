import { LegalDocument } from "../components/LegalDocument";
import { termsDoc } from "../lib/legal";

export default function Terminos() {
  return <LegalDocument doc={termsDoc} />;
}
