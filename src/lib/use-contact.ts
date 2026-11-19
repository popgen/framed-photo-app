import { useRef, useState } from "react";
import { CONTACT_ERROR, submitContact } from "./contact";

export function useContactSend() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: Record<string, string>, options?: { before?: () => Promise<unknown>; after?: () => Promise<unknown> }): Promise<boolean> {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (options?.before) await options.before();
      const result = await submitContact(body);
      if (!result.ok) {
        setError(result.error);
        lock.current = false;
        return false;
      }
      if (options?.after) {
        try {
          await options.after();
        } catch {
          // The shop already has the message. A later save must not look like a failed send.
        }
      }
      setSent(true);
      return true;
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : CONTACT_ERROR);
      lock.current = false;
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, sent, error, setError, send };
}
