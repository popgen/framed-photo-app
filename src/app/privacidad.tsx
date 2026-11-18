import { LegalDocument } from "../components/LegalDocument";
import { privacyDoc } from "../lib/legal";

export default function Privacidad() {
  return <LegalDocument doc={privacyDoc} />;
}
