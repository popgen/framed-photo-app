import { serviceSupabase } from "../../src/lib/service-supabase.ts";
import { PHOTO_BUCKET, planPhotoPurge } from "../../src/lib/photo-retention.ts";

export const config = { schedule: "0 8 * * *" };

const PAGE = 500;

export default async function handler(req) {
  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (!body?.next_run) {
    return json(401, { error: "Solo el horario." });
  }
  const context = process.env.CONTEXT;
  if (context && context !== "production") {
    return json(200, { skipped: true, reason: context });
  }
  const supabase = serviceSupabase();
  if (!supabase) return json(500, { error: "Falta SUPABASE_SERVICE_ROLE_KEY." });

  const now = new Date();
  const orders = await page(supabase, "orders", "id, status, updated_at");
  const items = await pageItems(supabase);
  const claims = await page(supabase, "claims", "id, order_id, photo_path");
  const notes = await page(supabase, "voice_notes", "token, storage_path, selfie_path, created_at");
  const objects = await listObjects(supabase);
  const plan = planPhotoPurge({ orders, items, claims, notes, objects, now });

  for (const batch of chunks(plan.deletePaths, 100)) {
    const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(batch);
    if (error) throw new Error(error.message);
  }
  for (const patch of plan.itemPatches) {
    const row = { photo_path: null, original_path: null, print_path: null };
    if ("card" in patch) row.card = patch.card;
    if ("voice" in patch) row.voice = patch.voice;
    let update = await supabase.from("order_items").update(row).eq("id", patch.id);
    if (update.error && /original_path|print_path|schema cache/i.test(update.error.message)) {
      const fallback = { photo_path: null };
      if ("card" in patch) fallback.card = patch.card;
      if ("voice" in patch) fallback.voice = patch.voice;
      update = await supabase.from("order_items").update(fallback).eq("id", patch.id);
    }
    if (update.error) throw new Error(update.error.message);
  }
  for (const batch of chunks(plan.clearClaimIds, 80)) {
    const { error } = await supabase.from("claims").update({ photo_path: null }).in("id", batch);
    if (error) throw new Error(error.message);
  }
  for (const batch of chunks(plan.clearNoteTokens, 80)) {
    const { error } = await supabase.from("voice_notes").update({ selfie_path: null }).in("token", batch);
    if (error) throw new Error(error.message);
  }

  return json(200, {
    deleted: plan.deletePaths.length,
    items: plan.itemPatches.length,
    claims: plan.clearClaimIds.length,
    selfies: plan.clearNoteTokens.length,
  });
}

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function chunks(values, size) {
  const batches = [];
  for (let i = 0; i < values.length; i += size) batches.push(values.slice(i, i + size));
  return batches;
}

async function page(supabase, table, select) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function pageItems(supabase) {
  try {
    return await page(supabase, "order_items", "id, order_id, photo_path, original_path, print_path, card, voice");
  } catch (error) {
    if (!/original_path|print_path|schema cache/i.test(error instanceof Error ? error.message : "")) throw error;
    return page(supabase, "order_items", "id, order_id, photo_path, card, voice");
  }
}

async function listObjects(supabase) {
  const found = [];
  async function walk(prefix) {
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await supabase.storage.from(PHOTO_BUCKET).list(prefix, {
        limit: 100,
        offset,
        sortBy: { column: "created_at", order: "asc" },
      });
      if (error) throw new Error(error.message);
      if (!data?.length) break;
      for (const entry of data) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (!entry.id) await walk(path);
        else found.push({ path, createdAt: entry.created_at || null });
      }
      if (data.length < 100) break;
    }
  }
  await walk("uploads");
  return found;
}
